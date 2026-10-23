export { loadRecipeList, searchRecipes, visibleRecipes, type RecipeListItem } from '@cocon/data';
import type { RecipeListItem } from '@cocon/data';

/**
 * The recipe list's query key (spec 006). It starts with `recipes`, so a live change to a recipe
 * refetches it (lib/sync.tsx); an ingredient or variant change also marks its recipe as changed.
 */
export const recipeListKey = (familyId: string) => ['recipes', familyId, 'list'] as const;

/**
 * FR-007: "In season in <Month>" (best months include this month) first, then everything else,
 * including recipes with no best months. Each group keeps the list's order. `month` is 1–12.
 */
export function groupBySeason<T extends Pick<RecipeListItem, 'best_months'>>(recipes: readonly T[], month: number): { inSeason: T[]; rest: T[] } {
  const inSeason: T[] = [];
  const rest: T[] = [];
  for (const recipe of recipes) (recipe.best_months.includes(month) ? inSeason : rest).push(recipe);
  return { inSeason, rest };
}
