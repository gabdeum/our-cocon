import { z } from 'zod';
import { Cuisine, cuisineOf } from './recipes';

/**
 * Recipe filters (spec 007), shared by the app's Filters sheet and the MCP `search_recipes` tool
 * (023). Within a group any choice matches (OR); every group with a choice must match (AND).
 */
export const TimeFilter = z.enum(['under_30', '30_60', 'over_60']);
export type TimeFilter = z.infer<typeof TimeFilter>;

/** A cuisine key, or `other` for recipes with no cuisine or one outside the list (FR-004). */
export const CuisineFilter = z.union([Cuisine, z.literal('other')]);
export type CuisineFilter = z.infer<typeof CuisineFilter>;

const once = <T>(items: T[]) => new Set(items).size === items.length;

export const RecipeFilters = z.strictObject({
  /** Best months, 1–12. */
  months: z.array(z.int().min(1).max(12)).refine(once, 'Each month once'),
  time: TimeFilter.nullable(),
  cuisines: z.array(CuisineFilter).refine(once, 'Each cuisine once'),
  /** Member user ids. */
  addedBy: z.array(z.uuid()).max(50).refine(once, 'Each member once'),
});
export type RecipeFilters = z.infer<typeof RecipeFilters>;

export const emptyFilters: RecipeFilters = { months: [], time: null, cuisines: [], addedBy: [] };

export const FilterKey = z.enum(['months', 'time', 'cuisine', 'added_by']);
export type FilterKey = z.infer<typeof FilterKey>;

export interface FilterableRecipe {
  best_months: readonly number[];
  total_minutes: number | null;
  cuisine: string | null;
  created_by: string | null;
}

/** The groups with a choice, in sheet order: the Filters pill's count and the analytics keys. */
export function activeFilterKeys(filters: RecipeFilters): FilterKey[] {
  const keys: FilterKey[] = [];
  if (filters.months.length > 0) keys.push('months');
  if (filters.time) keys.push('time');
  if (filters.cuisines.length > 0) keys.push('cuisine');
  if (filters.addedBy.length > 0) keys.push('added_by');
  return keys;
}

function timeMatches(minutes: number | null, time: TimeFilter): boolean {
  // No total time matches every option (edge cases).
  if (minutes == null) return true;
  if (time === 'under_30') return minutes < 30;
  if (time === '30_60') return minutes >= 30 && minutes <= 60;
  return minutes > 60;
}

/** True when the recipe passes every group that has a choice. */
export function recipePassesFilters(recipe: FilterableRecipe, filters: RecipeFilters): boolean {
  // No best months means good all year, so it matches every month.
  if (filters.months.length > 0 && recipe.best_months.length > 0 && !filters.months.some((m) => recipe.best_months.includes(m))) return false;
  if (filters.time && !timeMatches(recipe.total_minutes, filters.time)) return false;
  if (filters.cuisines.length > 0 && !filters.cuisines.includes(cuisineOf(recipe.cuisine) ?? 'other')) return false;
  if (filters.addedBy.length > 0 && (recipe.created_by == null || !filters.addedBy.includes(recipe.created_by))) return false;
  return true;
}

/** The recipes passing the filters, in the same order. */
export function filterRecipes<T extends FilterableRecipe>(recipes: readonly T[], filters: RecipeFilters): T[] {
  return activeFilterKeys(filters).length === 0 ? [...recipes] : recipes.filter((r) => recipePassesFilters(r, filters));
}

/**
 * FR-004: the cuisines the recipes use, most recipes first, then alphabetical by label (labels
 * live in the app's strings). `hasOther` when at least one recipe has no cuisine or an unknown one.
 */
export function cuisineFacets(recipes: readonly Pick<FilterableRecipe, 'cuisine'>[], label: (c: Cuisine) => string): { keys: Cuisine[]; hasOther: boolean } {
  const counts = new Map<Cuisine, number>();
  let hasOther = false;
  for (const recipe of recipes) {
    const key = cuisineOf(recipe.cuisine);
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
    else hasOther = true;
  }
  const keys = [...counts.keys()].sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0) || label(a).localeCompare(label(b)));
  return { keys, hasOther };
}
