import { z } from 'zod';
import { loadRecipeList, visibleRecipes } from '@cocon/data';
import { emptyFilters, RecipeFilters, TimeFilter, normalizeText } from '@cocon/schemas';
import { defineTool, ToolError } from '../../src/tools.js';
import { addedBy, cuisineKey, loadMembers, MONTHS, recipeLink, type Member } from './shared.js';

/** At most this many recipes in one answer; `more` says how many were left out. */
const MAX_RESULTS = 50;

/**
 * 032-later L9: the app's filters (spec 007) with every field optional, so an assistant sends only
 * what it needs. "Added by" takes a member's name or id; an unknown one is an error, not "nothing".
 */
const input = z.strictObject({
  query: z
    .string()
    .max(200)
    .optional()
    .describe('Words to find in the name, description or ingredient names. Accents and capitals don’t matter. Leave empty for every recipe.'),
  months: z
    .array(z.int().min(1).max(12))
    .max(12)
    .optional()
    .describe('In season in any of these months, 1–12 (recipes with no best months are good all year and always match).'),
  time: TimeFilter.optional().describe('Total time: under_30, 30_60 (30 to 60 minutes) or over_60. Recipes with no total time always match.'),
  cuisines: z.array(z.string().max(40)).max(23).optional().describe('Cuisine keys (e.g. italian, middle_eastern), or other for recipes with no cuisine.'),
  added_by: z.array(z.string().max(60)).max(50).optional().describe('Family members who added the recipe: their names or ids.'),
});

function memberIds(wanted: readonly string[], members: readonly Member[]): string[] {
  return wanted.map((w) => {
    const match = members.find((m) => m.user_id === w || normalizeText(m.display_name) === normalizeText(w.trim()));
    if (!match) throw new ToolError(`No one in this family is called '${w}'. Members: ${members.map((m) => m.display_name).join(', ')}.`);
    return match.user_id;
  });
}

export const searchRecipes = defineTool({
  name: 'search_recipes',
  title: 'Search recipes',
  access: 'read',
  description:
    'Find the family’s recipes, the same way the app’s search and filters do. Every field is optional; with none you get every recipe, most recently added first. Each result has a link to the recipe in the app: share it with the member.',
  input,
  async run(args, ctx) {
    const [recipes, members] = await Promise.all([loadRecipeList(ctx.db), loadMembers(ctx)]);
    const filters = RecipeFilters.parse({
      ...emptyFilters,
      months: [...new Set(args.months ?? [])],
      time: args.time ?? null,
      cuisines: [...new Set((args.cuisines ?? []).map((c) => cuisineKey(c, true)))],
      addedBy: [...new Set(memberIds(args.added_by ?? [], members))],
    });
    const found = visibleRecipes(recipes, args.query ?? '', filters);
    return {
      count: found.length,
      more: Math.max(0, found.length - MAX_RESULTS),
      recipes: found.slice(0, MAX_RESULTS).map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        link: recipeLink(ctx, r.id),
        serves: r.serves,
        total_minutes: r.total_minutes,
        cuisine: r.cuisine,
        best_months: r.best_months.map((m) => MONTHS[m - 1]),
        variant_count: r.variantCount,
        added_by: addedBy(r.created_by, r.source, members),
      })),
    };
  },
});
