import { z } from 'zod';
import { loadRecipe, type RecipeDetail } from '@cocon/data';
import { format, renderStep, renderTemperatureCheck, scale, type FormatOptions } from '@cocon/quantity';
import { applyVariants, normalizeText, type VariantChoice } from '@cocon/schemas';
import { defineTool, ToolError, type ToolContext } from '../../src/tools.js';
import { addedBy, loadMembers, MONTHS, RecipeId, recipeLink } from './shared.js';

const input = z.strictObject({
  id: RecipeId,
  servings: z.number().min(0.5).max(200).optional().describe('Scale the amounts to this many servings. Leave out for the recipe’s own.'),
  variants: z
    .array(z.string().max(60))
    .max(20)
    .optional()
    .describe('Variants to apply, by name or id (see list_variants): at most one version, and any options.'),
  units: z.enum(['metric', 'imperial']).optional().describe('Amounts in metric (default) or US imperial units.'),
});

/** The chosen variants by name or id; an unknown one says which exist. */
export function variantChoice(recipe: Pick<RecipeDetail, 'variants'>, wanted: readonly string[]): VariantChoice {
  const choice: { version: string | null; options: string[] } = { version: null, options: [] };
  for (const w of wanted) {
    const v = recipe.variants.find((x) => x.id === w || normalizeText(x.name) === normalizeText(w.trim()));
    if (!v) {
      const names = recipe.variants.map((x) => x.name);
      throw new ToolError(names.length ? `This recipe has no variant '${w}'. Its variants: ${names.join(', ')}.` : `This recipe has no variants, so '${w}' can’t be applied.`);
    }
    if (v.kind === 'version') {
      if (choice.version && choice.version !== v.id) throw new ToolError('Pick at most one version at a time; options can be combined.');
      choice.version = v.id;
    } else if (!choice.options.includes(v.id)) choice.options.push(v.id);
  }
  return choice;
}

/** A recipe the member's family has and hasn't deleted, or the sentence saying it isn't there. */
export async function familyRecipe(ctx: Pick<ToolContext, 'db'>, id: string): Promise<RecipeDetail> {
  const recipe = await loadRecipe(ctx.db, id);
  // RLS hides other families' recipes, so "not found" covers both (spec 023 SC-002).
  if (!recipe || recipe.deleted_at) throw new ToolError('There’s no recipe with that id in this family. Use search_recipes to find it.');
  return recipe;
}

/**
 * The recipe as the app's page shows it (specs 008, 009): variants applied, amounts scaled and
 * written by the quantity engine, temperatures in both scales. Assistants never work out amounts.
 */
export const getRecipe = defineTool({
  name: 'get_recipe',
  title: 'Get a recipe',
  access: 'read',
  description:
    'Read one recipe: ingredients with amounts, steps (amounts and temperatures written in), timers, tips and thermometer checks. Scale it with servings and apply variants by name. Quote amounts exactly as given; never work them out yourself. Ingredient and step ids are for changing the recipe.',
  input,
  async run(args, ctx) {
    const [recipe, members] = await Promise.all([familyRecipe(ctx, args.id), loadMembers(ctx)]);
    const choice = variantChoice(recipe, args.variants ?? []);
    const options: FormatOptions = { system: args.units ?? 'metric', scale: true };
    const applied = applyVariants(recipe, recipe.variants, choice);
    const scaled = scale(
      { serves: recipe.serves, ingredients: applied.ingredients.map((i) => ({ ...i, facts: i.catalog_key ? recipe.facts[i.catalog_key] : null })) },
      { servings: args.servings ?? recipe.serves },
    );
    const names = new Map(applied.ingredients.map((i) => [i.id, i.name]));

    return {
      id: recipe.id,
      name: recipe.name,
      description: recipe.description,
      link: recipeLink(ctx, recipe.id),
      serves: recipe.serves,
      servings: scaled.servings,
      total_minutes: recipe.total_minutes,
      cuisine: recipe.cuisine,
      best_months: recipe.best_months.map((m) => MONTHS[m - 1]),
      added_by: addedBy(recipe.created_by, recipe.source, members),
      variants_applied: recipe.variants.filter((v) => v.id === choice.version || choice.options.includes(v.id)).map((v) => v.name),
      variants_available: recipe.variants.map((v) => ({ id: v.id, name: v.name, kind: v.kind })),
      ingredients: scaled.ingredients.map((i) => {
        const f = format(i, options);
        return {
          id: i.id,
          text: i.prep_note ? `${f.phrase}, ${i.prep_note}` : f.phrase,
          amount: [f.amount, f.unit].filter(Boolean).join(' ') || null,
          weight: f.sub,
          name: i.name,
          from_variant: i.fromVariant,
        };
      }),
      steps: applied.steps.map((s, index) => ({
        id: s.id,
        number: index + 1,
        name: s.name ?? null,
        text: renderStep(s.body, scaled.ingredients, options)
          .map((seg) => (seg.type === 'missing' ? (names.get(seg.ingredientId) ?? 'an ingredient') : seg.text))
          .join(''),
        timer_minutes: s.timer_seconds ? Math.round((s.timer_seconds / 60) * 10) / 10 : null,
        timer_label: s.timer_label ?? null,
        thermometer_check: renderTemperatureCheck(s.temp_check_text ?? null, s.temp_check_c ?? null, options.system),
        thermometer_check_c: s.temp_check_c ?? null,
        tip: s.tip ?? null,
        from_variant: s.fromVariant,
      })),
    };
  },
});
