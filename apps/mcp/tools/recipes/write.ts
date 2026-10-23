import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { scale } from '@cocon/quantity';
import { cuisineOf, MAX_VARIANTS, RecipeInput, type Json } from '@cocon/schemas';
import { defineTool, ToolError, type ToolContext } from '../../src/tools.js';
import { familyRecipe, readRecipe } from './get.js';
import {
  checkStep,
  checkStepAmounts,
  IngredientIn,
  ingredientRows,
  mentionsIn,
  mentionTargets,
  STEP_WRITING,
  StepIn,
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
  description: z.string().max(140).nullable().optional().describe('One short line about it.'),
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

export const createRecipe = defineTool({
  name: 'create_recipe',
  title: 'Save a new recipe',
  access: 'write',
  description: [
    'Save a new recipe to the family’s Our Cocon. It shows in the app as added by the member, through you.',
    'Before calling, make sure you know how many it serves and each ingredient’s amount and unit as the member gave them; ask rather than guess.',
    'Ingredients: one written line each ("2 leeks, sliced", "200 ml double cream", "salt to taste") or structured rows.',
    STEP_WRITING,
    VARIANT_WRITING,
    'Returns the saved recipe with its link: share the link.',
  ].join(' '),
  input: z.strictObject({
    ...details,
    ingredients: z.array(IngredientIn).max(100).describe('Every ingredient, in order.'),
    steps: z.array(StepIn).max(100).describe('The method, one step each, in order.'),
    variants: variantsField.optional().describe('Versions and options of the recipe, if it has any.'),
  }),
  async run(args, ctx) {
    const input = recipeInput(pickDetails(args));
    const ingredients = await ingredientRows(ctx, args.ingredients);
    const targets = mentionTargets(ingredients);
    const steps = stepRows(args.steps, targets);
    const variants = await variantRows(ctx, args.variants ?? [], { ingredients: targets, stepIds: steps.map((st) => st.id) });

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
    return readRecipe(ctx, id);
  },
});

const StepChange = z.strictObject({
  step: z.int().min(1).max(100).describe('The step’s number, as get_recipe shows it (without variants).'),
  name: z.string().max(60).nullable().optional().describe('A new title, or null to remove it.'),
  text: z.string().min(1).max(2000).optional().describe('New text. Start from the step’s text_for_editing.'),
  timer_minutes: z.number().positive().max(1440).nullable().optional().describe('A new timer, or null to remove it.'),
  timer_label: z.string().max(40).nullable().optional(),
  tip: z.string().max(200).nullable().optional().describe('A new tip, or null to remove it.'),
  thermometer_check: ThermometerCheck.nullable().optional().describe('A new thermometer check, or null to remove it.'),
});

export const updateRecipe = defineTool({
  name: 'update_recipe',
  title: 'Change a recipe',
  access: 'write',
  description: [
    'Change a recipe. Send only what changes: details, the whole ingredient list, the whole step list, step_changes for small edits to some steps ("add a tip to step 5"), or the whole variant list.',
    'To make the recipe for more or fewer people by default ("make it serve 8"), send scale_to: every amount is rescaled for you. serves alone only corrects the number and leaves the amounts as they are.',
    'In whole lists, items with an id (from get_recipe) are kept and changed, items without one are new, and anything left out is removed (a removed ingredient is taken out of the steps too). Variants are kept by name: to add or change one, send get_recipe’s variants back with the change; [] removes them all.',
    STEP_WRITING,
    VARIANT_WRITING,
    'Every change shows in the app’s activity, where the member can undo it. Returns the updated recipe.',
  ].join(' '),
  input: z.strictObject({
    id: RecipeId,
    ...Object.fromEntries(Object.entries(details).map(([k, v]) => [k, v.optional()])),
    ingredients: z.array(IngredientIn).max(100).optional().describe('The whole new ingredient list.'),
    steps: z.array(StepIn).max(100).optional().describe('The whole new step list.'),
    step_changes: z.array(StepChange).max(100).optional().describe('Changes to some steps, by number. Not with steps.'),
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
    let ingredients = args.ingredients ? await ingredientRows(ctx, args.ingredients, new Set(before.ingredients.map((i) => i.id))) : null;
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
      steps = stepRows(args.steps, targets, new Set(photos.keys())).map((s) => ({ ...s, photo_path: photos.get(s.id) ?? null }));
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
        if (change.text !== undefined) {
          // Each ingredient goes in one step: what the other steps mention stays theirs.
          const { body } = stepFields({ text: change.text, ...(row.timer_seconds ? { timer_minutes: row.timer_seconds / 60 } : {}) }, where, targets, mentionsIn(rows, at));
          row.body = body;
        }
        if (change.name !== undefined) {
          checkStepAmounts(where, '', change.name);
          row.name = change.name?.trim() || null;
        }
        if (change.timer_minutes !== undefined) row.timer_seconds = change.timer_minutes === null ? null : Math.round(change.timer_minutes * 60);
        if (change.timer_label !== undefined) row.timer_label = change.timer_label?.trim() || null;
        if (!row.timer_seconds) row.timer_label = null;
        if (change.tip !== undefined) {
          checkStepAmounts(where, '', change.tip);
          row.tip = change.tip?.trim() || null;
        }
        if (change.thermometer_check !== undefined) {
          row.temp_check_c = change.thermometer_check?.celsius ?? null;
          row.temp_check_text = change.thermometer_check?.text?.trim() || null;
        }
        checkStep(row, where, at);
      }
      steps = rows;
    }
    const variants = args.variants
      ? await variantRows(ctx, args.variants, { ingredients: targets, stepIds: (steps ?? before.steps).map((st) => st.id) }, before.variants)
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
    return readRecipe(ctx, args.id);
  },
});

export const deleteRecipe = defineTool({
  name: 'delete_recipe',
  title: 'Delete a recipe',
  access: 'delete',
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
