import { z } from 'zod';
import { addFromRecipe, matchIngredients, recipeGroceryLines, type RecipeGroceryLine } from '@cocon/data';
import { normaliseName } from '@cocon/schemas';
import { defineTool, ToolError, type ToolContext } from '../../src/tools.js';
import { familyRecipe, variantChoice } from '../recipes/get.js';
import { RecipeId, recipeLink } from '../recipes/shared.js';
import { groceriesLink } from './shared.js';

/**
 * The lines the member already has, by what they said ("eggs", "butter"): the same name, a name
 * ending with it ("Large eggs"), or the same catalog ingredient ("egg yolks" isn't "eggs"). A
 * name that matches no line is refused with the recipe's ingredients, so the assistant can fix it.
 */
async function excludedLines(ctx: Pick<ToolContext, 'db'>, lines: readonly RecipeGroceryLine[], names: readonly string[]): Promise<Set<string>> {
  const wanted = names.map((n) => n.trim()).filter(Boolean);
  if (wanted.length === 0) return new Set();
  const facts = (await matchIngredients(ctx.db, wanted)) ?? [];
  const out = new Set<string>();
  wanted.forEach((name, n) => {
    const norm = normaliseName(name);
    const key = facts[n]?.catalog_key ?? null;
    const hits = lines.filter((l) => {
      const line = normaliseName(l.name);
      return line === norm || line.endsWith(` ${norm}`) || (key !== null && l.catalog_key === key);
    });
    if (hits.length === 0) {
      throw new ToolError(`This recipe has no ingredient '${name}'. Its ingredients: ${lines.map((l) => l.name).join(', ')}. Use those names in exclude_ingredients.`);
    }
    for (const h of hits) out.add(h.id);
  });
  return out;
}

export const addRecipeToGroceries = defineTool({
  name: 'add_recipe_to_groceries',
  title: 'Add a recipe’s ingredients to the grocery list',
  access: 'write',
  needs: 'groceries',
  description: [
    'Add what a recipe needs to the family’s grocery list, as "Add to groceries" does in the app.',
    'Before calling it, ask the member which of the recipe’s ingredients they already have (read them with get_recipe), unless they already told you, and pass those as exclude_ingredients. Never assume they have something.',
    '- servings: how many to cook for; leave out for the recipe’s own. variants: by name, as in get_recipe.',
    '- Amounts are worked out by Our Cocon, scaled to the servings; never send amounts.',
    '- Adding the same recipe again tops up its items already on the list instead of adding them twice, and the servings add up.',
    'Then tell the member what was added, quoting the result.',
  ].join('\n'),
  input: z.strictObject({
    recipe_id: RecipeId,
    servings: z.int().min(1).max(50).optional().describe('How many to cook for. Leave out for the recipe’s own servings.'),
    variants: z.array(z.string().max(60)).max(20).optional().describe('Variants to apply, by name: at most one version, and any options.'),
    exclude_ingredients: z
      .array(z.string().max(80))
      .max(100)
      .optional()
      .describe('Ingredients the member already has, by name ("eggs", "butter"). They’re left off the list.'),
  }),
  async run(args, ctx) {
    const recipe = await familyRecipe(ctx, args.recipe_id);
    const choice = variantChoice(recipe, args.variants ?? []);
    const { serves, lines } = recipeGroceryLines(recipe, { ...choice, servings: args.servings ?? recipe.serves, scaledBy: null }, { system: 'metric', scale: true });
    if (lines.length === 0) throw new ToolError('This recipe has no ingredients to add.');
    const excluded = await excludedLines(ctx, lines, args.exclude_ingredients ?? []);
    const adding = lines.filter((l) => !excluded.has(l.id));
    if (adding.length === 0) throw new ToolError('The member has everything this recipe needs, so there’s nothing to add.');

    const added = await addFromRecipe(ctx.db, ctx.familyId, recipe.id, adding, serves);
    if (!added) throw new Error('Could not add the recipe to the grocery list');
    ctx.tracker.track('groceries_added_from_recipe', { ingredient_count: Math.min(adding.length, 500), unticked_count: Math.min(lines.length - adding.length, 500) });
    const stored = await ctx.db.from('grocery_recipes').select('servings').eq('recipe_id', recipe.id).maybeSingle();

    return {
      recipe: recipe.name,
      recipe_link: recipeLink(ctx, recipe.id),
      // The servings the list now has it for: what was added on top of what was there.
      servings_on_list: stored.data?.servings ?? serves,
      added: adding.map((l) => (l.shown ? `${l.shown} ${l.name}` : l.name)),
      ...(added.merges.length > 0 ? { already_on_list: `${added.merges.length} of these were on the list for this recipe already and were topped up.` } : {}),
      left_off: lines.filter((l) => excluded.has(l.id)).map((l) => l.name),
      link: groceriesLink(ctx),
    };
  },
});
