import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { scale } from '@cocon/quantity';
import { cuisineOf, MAX_VARIANTS, RecipeInput, type Json } from '@cocon/schemas';
import { defineTool, ToolError, type ToolContext } from '../../src/tools.js';
import { familyRecipe, readRecipe, stepAddOns } from './get.js';
import {
  ADD_ON_WRITING,
  checkStep,
  INGREDIENT_WRITING,
  IngredientIn,
  ingredientRows,
  mentionsIn,
  mentionTargets,
  STEP_WRITING,
  StepIn,
  stepAmountWarning,
  stepFields,
  stepRows,
  ThermometerCheck,
  VARIANT_WRITING,
  VariantIn,
  variantRows,
  type IngredientOut,
  type StepOut,
  type VariantSaveRow,
} from './input.js';
import { cuisineKey, RecipeId } from './shared.js';

/** The recipe's details as assistants send them (spec 004's RecipeInput, in their words). */
const details = {
  name: z.string().max(80).describe('The recipe’s name.'),
  description: z.string().max(140).nullable().optional().describe('One short line about it. Never numbers that scale with the servings ("500 g of pasta"): they won’t update when the cook changes the servings.'),
  serves: z.int().min(1).max(50).describe('How many it serves. If the member didn’t say, ask them; never guess.'),
  total_minutes: z.int().min(1).max(10080).nullable().optional().describe('Total time in minutes, start to finish.'),
  prep_minutes: z.int().min(1).max(10080).nullable().optional().describe('Hands-on time in minutes.'),
  cuisine: z.string().max(40).nullable().optional().describe('A cuisine key: american, british, caribbean, chinese, french, german, greek, indian, italian, japanese, korean, latin_american, mexican, middle_eastern, moroccan, portuguese, scandinavian, spanish, thai, turkish, vietnamese, west_african. Leave empty if none fits.'),
  source_text: z.string().max(200).nullable().optional().describe('Where it comes from: "Mum", a book, a website.'),
  best_months: z.array(z.int().min(1).max(12)).max(12).optional().describe('Months it’s best in, 1–12. Leave empty for all year.'),
};

/** RecipeInput from what was sent, on top of what's there, or the sentence to fix it. */
function recipeInput(sent: Partial<Record<keyof typeof details, unknown>>, current?: Record<string, unknown>) {
  // A stored cuisine outside the list reads as Other (spec 006), so it never blocks another change.
  const merged: Record<string, unknown> = { best_months: [], ...current, ...(current ? { cuisine: cuisineOf(current.cuisine as string | null) } : {}) };
  for (const [k, v] of Object.entries(sent)) if (v !== undefined) merged[k] = v;
  if (typeof sent.cuisine === 'string') merged.cuisine = sent.cuisine.trim() ? cuisineKey(sent.cuisine, false) : null;
  if (Array.isArray(merged.best_months)) merged.best_months = [...new Set(merged.best_months)].sort((a, b) => a - b);
  const parsed = RecipeInput.safeParse(merged);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new ToolError(`${issue?.path.join('.') || 'The recipe'}: ${(issue?.message ?? 'isn’t valid').replace(/\.$/, '')}. Fix it and try again.`);
  }
  return parsed.data;
}

const detailKeys = Object.keys(details) as (keyof typeof details)[];
const pickDetails = (args: Record<string, unknown>) => Object.fromEntries(detailKeys.filter((k) => args[k] !== undefined).map((k) => [k, args[k]]));

/** Saves the whole ingredient and step lists through the app's RPCs (one transaction each). */
async function saveIngredients(ctx: Pick<ToolContext, 'db'>, recipeId: string, rows: readonly IngredientOut[]) {
  const { error } = await ctx.db.rpc('save_recipe_ingredients', { p_recipe_id: recipeId, p_ingredients: rows.map(({ plural: _p, ...r }) => r) as unknown as Json });
  if (error) throw error;
}
async function saveSteps(ctx: Pick<ToolContext, 'db'>, recipeId: string, rows: readonly StepOut[]) {
  const { error } = await ctx.db.rpc('save_recipe_steps', { p_recipe_id: recipeId, p_steps: rows as unknown as Json });
  if (error) throw error;
}
/** The whole variant list (spec 017's save_recipe_variants): variants left out are removed. */
async function saveVariants(ctx: Pick<ToolContext, 'db'>, recipeId: string, rows: readonly VariantSaveRow[]) {
  const { error } = await ctx.db.rpc('save_recipe_variants', { p_recipe_id: recipeId, p_variants: rows as unknown as Json });
  if (error) throw error;
}

const variantsField = z.array(VariantIn).max(MAX_VARIANTS);

/** The saved recipe, with amounts in its steps for the assistant to check (`stepAmountWarning`). */
const withWarnings = <R extends object>(recipe: R, warnings: readonly string[]) => (warnings.length ? { ...recipe, warnings } : recipe);

export const createRecipe = defineTool({
  name: 'create_recipe',
  title: 'Save a new recipe',
  access: 'write',
  needs: 'recipes_edit',
  description: [
    [
      'Save a new recipe. It shows in the app as added by the member, through you. Returns it with its link: share the link.',
      'You can’t see the app, so work in this order (update_recipe follows the same rules):',
      '1. Know how many it serves and each amount and unit as the member gave them. Ask rather than guess.',
      '2. Ingredients, most important first.',
      '3. Steps, then step by step: where a timer, a temperature check or a tip applies and helps.',
      '4. Variants: save the ones given; after saving, suggest others.',
    ].join('\n'),
    INGREDIENT_WRITING,
    STEP_WRITING,
    ADD_ON_WRITING,
    VARIANT_WRITING,
  ].join('\n\n'),
  input: z.strictObject({
    ...details,
    ingredients: z.array(IngredientIn).max(100).describe('Every ingredient, most important first.'),
    steps: z.array(StepIn).max(100).describe('The method, one step each, in order.'),
    variants: variantsField.optional().describe('Versions and options the member gave.'),
  }),
  async run(args, ctx) {
    const input = recipeInput(pickDetails(args));
    const warnings: string[] = [];
    const ingredients = await ingredientRows(ctx, args.ingredients, new Set(), warnings);
    const targets = mentionTargets(ingredients);
    const steps = stepRows(args.steps, targets, undefined, warnings);
    const variants = await variantRows(ctx, args.variants ?? [], { ingredients: targets, steps }, [], warnings);

    const id = randomUUID();
    const { error } = await ctx.db.from('recipes').insert({ id, family_id: ctx.familyId, ...input });
    if (error) throw error;
    try {
      await saveIngredients(ctx, id, ingredients);
      await saveSteps(ctx, id, steps);
      if (variants.length) await saveVariants(ctx, id, variants);
    } catch (e) {
      // Never leave half a recipe: set it aside the app's way (Recently deleted, then gone).
      await ctx.db.from('recipes').update({ deleted_at: new Date().toISOString() }).eq('id', id);
      throw e;
    }
    return withWarnings(await readRecipe(ctx, id), warnings);
  },
});

const StepChange = z.strictObject({
  step: z.int().min(1).max(100).describe('The step’s number in for_editing.'),
  name: z.string().max(60).nullable().optional().describe('A new title, or null to remove it.'),
  text: z.string().min(1).max(2000).optional().describe('New text. Start from the step’s text in for_editing.'),
  timer_minutes: z.number().positive().max(1440).nullable().optional().describe('A new timer, or null to remove it.'),
  timer_label: z.string().max(40).nullable().optional(),
  tip: z.string().max(200).nullable().optional().describe('A new tip, or null to remove it.'),
  thermometer_check: ThermometerCheck.nullable().optional().describe('A new temperature check, or null to remove it.'),
});

export const updateRecipe = defineTool({
  name: 'update_recipe',
  title: 'Change a recipe',
  access: 'write',
  needs: 'recipes_edit',
  description: [
    'Change a recipe. Send only what changes: details, the whole ingredient list, the whole step list, step_changes (some steps, by number: "add a tip to step 5") or the whole variant list. Write them by create_recipe’s rules.',
    '- scale_to makes it serve more or fewer by default, rescaling every amount. serves alone corrects the number only.',
    '- Start from get_recipe’s for_editing. Whole lists replace what’s there: items with an id are kept, items without one are new, items left out are removed (a removed ingredient leaves the steps too). Send kept ingredients complete. A kept step keeps its title, timer, tip and temperature check unless you send a new one, or null to remove it. Variants are matched by name; [] removes them all.',
    '- Every change shows in the app’s activity, where the member can undo it. Returns the updated recipe.',
  ].join('\n'),
  input: z.strictObject({
    id: RecipeId,
    ...Object.fromEntries(Object.entries(details).map(([k, v]) => [k, v.optional()])),
    ingredients: z.array(IngredientIn).max(100).optional().describe('The whole new ingredient list.'),
    steps: z.array(StepIn).max(100).optional().describe('The whole new step list.'),
    step_changes: z.array(StepChange).max(100).optional().describe('Changes to some steps, by their number in for_editing. Not with steps.'),
    scale_to: z.int().min(1).max(50).optional().describe('Make the recipe for this many by default: sets serves and rescales every amount. Not with serves or ingredients.'),
    variants: variantsField.optional().describe('The whole new variant list.'),
  }) as z.ZodObject<{ id: typeof RecipeId } & { [K in keyof typeof details]: z.ZodOptional<(typeof details)[K]> } & {
    ingredients: z.ZodOptional<z.ZodArray<typeof IngredientIn>>;
    steps: z.ZodOptional<z.ZodArray<typeof StepIn>>;
    step_changes: z.ZodOptional<z.ZodArray<typeof StepChange>>;
    scale_to: z.ZodOptional<z.ZodInt>;
    variants: z.ZodOptional<typeof variantsField>;
  }>,
  async run(args, ctx) {
    if (args.steps && args.step_changes) throw new ToolError('Send either steps (the whole list) or step_changes (some steps), not both.');
    if (args.scale_to !== undefined && (args.serves !== undefined || args.ingredients)) throw new ToolError('Send scale_to on its own, without serves or ingredients: it sets both.');
    const before = await familyRecipe(ctx, args.id);
    const sent = pickDetails(args);
    if (args.scale_to !== undefined) sent.serves = args.scale_to;
    const changingDetails = Object.keys(sent).length > 0;
    if (!changingDetails && !args.ingredients && !args.steps && !args.step_changes && !args.variants) throw new ToolError('Nothing to change: send the fields that change.');

    // Read and check everything before writing anything.
    const { id: _id, ingredients: _i, steps: _s, variants: _v, facts: _f, created_by: _c, source: _src, deleted_at: _d, deleted_by: _db, ...current } = before;
    const input = changingDetails ? recipeInput(sent, current) : null;
    const warnings: string[] = [];
    let ingredients = args.ingredients ? await ingredientRows(ctx, args.ingredients, new Set(before.ingredients.map((i) => i.id)), warnings) : null;
    if (args.scale_to !== undefined && args.scale_to !== before.serves) {
      // FR-003: the quantity engine rescales, as the app's servings do; the rows keep everything else.
      const scaled = scale(
        { serves: before.serves, ingredients: before.ingredients.map((i) => ({ ...i, facts: i.catalog_key ? before.facts[i.catalog_key] : null })) },
        { servings: args.scale_to },
      );
      ingredients = scaled.ingredients.map(({ facts, ...row }) => ({ ...row, plural: facts?.plural ?? null }));
    }
    const targets = mentionTargets(ingredients ?? before.ingredients.map((i) => ({ ...i, plural: i.catalog_key ? (before.facts[i.catalog_key]?.plural ?? null) : null })));
    let steps: StepOut[] | null = null;
    if (args.steps) {
      // A kept step keeps its photo: assistants can't add or change photos (spec 016's are the app's).
      const photos = new Map(before.steps.map((s) => [s.id, s.photo_path ?? null]));
      // A kept step keeps its title and add-ons unless the assistant sends new ones (or null).
      const stored = new Map(before.steps.map((s) => [s.id, stepAddOns(s)]));
      const sent = args.steps.map((st) => (typeof st === 'object' && st.id && stored.has(st.id) ? { ...stored.get(st.id), ...st } : st));
      steps = stepRows(sent, targets, new Set(photos.keys()), warnings).map((s) => ({ ...s, photo_path: photos.get(s.id) ?? null }));
    }
    if (args.step_changes) {
      const rows: StepOut[] = before.steps.map((s) => ({
        id: s.id,
        name: s.name ?? null,
        body: s.body,
        timer_seconds: s.timer_seconds ?? null,
        timer_label: s.timer_label ?? null,
        temp_check_c: s.temp_check_c ?? null,
        temp_check_text: s.temp_check_text ?? null,
        tip: s.tip ?? null,
        photo_path: s.photo_path ?? null,
      }));
      for (const change of args.step_changes) {
        const at = change.step - 1;
        const row = rows[at];
        if (!row) throw new ToolError(`This recipe has ${rows.length} steps, so there’s no step ${change.step}.`);
        const where = `Step ${change.step}`;
        let warning: string | null = null;
        if (change.text !== undefined) {
          // Each ingredient goes in one step: what the other steps mention stays theirs.
          const fields = stepFields({ text: change.text }, where, targets, mentionsIn(rows, at));
          warning = fields.warning;
          row.body = fields.body;
        }
        if (change.name !== undefined) row.name = change.name?.trim() || null;
        if (change.timer_minutes !== undefined) row.timer_seconds = change.timer_minutes === null ? null : Math.round(change.timer_minutes * 60);
        if (change.timer_label !== undefined) row.timer_label = change.timer_label?.trim() || null;
        if (!row.timer_seconds) row.timer_label = null;
        if (change.tip !== undefined) row.tip = change.tip?.trim() || null;
        // The text was checked with its tokens above; a new title or tip here. One warning per step.
        warning ??= stepAmountWarning(where, '', change.name, change.tip);
        if (warning) warnings.push(warning);
        if (change.thermometer_check !== undefined) {
          row.temp_check_c = change.thermometer_check?.celsius ?? null;
          row.temp_check_text = change.thermometer_check?.text?.trim() || null;
        }
        checkStep(row, where, at);
      }
      steps = rows;
    }
    const variants = args.variants
      ? await variantRows(ctx, args.variants, { ingredients: targets, steps: steps ?? before.steps }, before.variants, warnings)
      : null;

    const saved: string[] = [];
    const parts: [string, () => Promise<void>][] = [];
    if (input)
      parts.push([
        'details',
        async () => {
          const { photo_path: _photo, ...fields } = input;
          const { error } = await ctx.db.from('recipes').update(fields).eq('id', args.id);
          if (error) throw error;
        },
      ]);
    if (ingredients) parts.push(['ingredients', () => saveIngredients(ctx, args.id, ingredients)]);
    if (steps) parts.push(['steps', () => saveSteps(ctx, args.id, steps)]);
    if (variants) parts.push(['variants', () => saveVariants(ctx, args.id, variants)]);
    for (const [part, save] of parts) {
      try {
        await save();
      } catch {
        if (!saved.length) throw new ToolError(`Couldn’t save the ${part}. Nothing changed; try again.`);
        // What did save is in the activity log (the database logs every write), so it can be undone.
        throw new ToolError(`Saved the ${saved.join(' and ')}, but couldn’t save the ${part}. Try that part again.`);
      }
      saved.push(part);
    }
    return withWarnings(await readRecipe(ctx, args.id), warnings);
  },
});

export const deleteRecipe = defineTool({
  name: 'delete_recipe',
  title: 'Delete a recipe',
  access: 'delete',
  needs: 'recipes_delete',
  description:
    'Delete a recipe. It goes to Recently deleted in the app for 30 days, where the member can restore it (Settings › Recently deleted); after that it’s gone. Make sure the member means this recipe.',
  input: z.strictObject({ id: RecipeId }),
  async run(args, ctx) {
    const recipe = await familyRecipe(ctx, args.id);
    // The app's soft delete (spec 018): the database stamps who and when.
    const { data, error } = await ctx.db.from('recipes').update({ deleted_at: new Date().toISOString() }).eq('id', args.id).is('deleted_at', null).select('id');
    if (error) throw error;
    if (data.length === 0) throw new ToolError('There’s no recipe with that id in this family. Use search_recipes to find it.');
    ctx.tracker.track('recipe_deleted', { source: ctx.assistant });
    return { deleted: true, name: recipe.name, restore: 'It’s in Recently deleted for 30 days: the member can restore it from Settings › Recently deleted in the app.' };
  },
});
