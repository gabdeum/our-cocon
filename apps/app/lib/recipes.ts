import { filterRecipes, recipeMatches, searchWords, type RecipeFilters } from '@cocon/schemas';
import type { Client } from './supabase';

/**
 * What the recipe list needs (spec 006): each recipe's facts, its ingredient names (for search,
 * FR-004) and how many variants it has. The key starts with `recipes`, so a live change to a recipe
 * refetches it (lib/sync.tsx); an ingredient or variant change also marks its recipe as changed.
 */
export const recipeListKey = (familyId: string) => ['recipes', familyId, 'list'] as const;

export interface RecipeListItem {
  id: string;
  name: string;
  description: string | null;
  serves: number;
  total_minutes: number | null;
  cuisine: string | null;
  best_months: number[];
  photo_path: string | null;
  created_by: string | null;
  source: string;
  created_at: string;
  ingredientNames: string[];
  variantCount: number;
}

const columns =
  'id, name, description, serves, total_minutes, cuisine, best_months, photo_path, created_by, source, created_at, recipe_ingredients(name), recipe_variants(count)';

/** The family's recipes (RLS returns only theirs), not deleted, most recently added first (decision 13). */
export async function loadRecipeList(client: Pick<Client, 'from'>): Promise<RecipeListItem[]> {
  const { data, error } = await client.from('recipes').select(columns).is('deleted_at', null).order('created_at', { ascending: false });
  if (error) throw error;
  return data.map(({ recipe_ingredients, recipe_variants, ...recipe }) => ({
    ...recipe,
    ingredientNames: recipe_ingredients.map((i) => i.name),
    variantCount: recipe_variants[0]?.count ?? 0,
  }));
}

/** The recipes matching a search, in the same order. */
export function searchRecipes<T extends Pick<RecipeListItem, 'name' | 'description' | 'ingredientNames'>>(recipes: readonly T[], query: string): T[] {
  const words = searchWords(query);
  return words.length === 0 ? [...recipes] : recipes.filter((r) => recipeMatches(r, words));
}

/** What the list shows: the search (spec 006), then the filters (spec 007). The sheet counts the same. */
export function visibleRecipes<T extends RecipeListItem>(recipes: readonly T[], query: string, filters: RecipeFilters): T[] {
  return filterRecipes(searchRecipes(recipes, query), filters);
}

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
