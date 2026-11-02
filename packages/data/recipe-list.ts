import { filterRecipes, recipeMatches, searchWords, type RecipeFilters } from '@cocon/schemas';
import type { Db } from './client';

/**
 * What the recipe list needs (spec 006): each recipe's facts, its ingredient names (for search,
 * FR-004) and how many variants it has. Shared with the MCP server's search_recipes (023), so an
 * assistant finds exactly what the app's list shows for the same search and filters.
 */
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
export async function loadRecipeList(client: Pick<Db, 'from'>): Promise<RecipeListItem[]> {
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

/** The recipe Home's hero shows (spec 028 FR-005), with what its ingredients are, for "N to buy". */
export interface HomeHero {
  id: string;
  name: string;
  serves: number;
  total_minutes: number | null;
  photo_path: string | null;
  ingredients: { name: string; catalog_key: string | null }[];
}

/**
 * FR-005: what Home's hero shows. For now the most recently added recipe that isn't deleted (032
 * L42); a meal plan will put tonight's dish here later, so Home reads it only through this.
 */
export async function loadHomeHero(client: Pick<Db, 'from'>): Promise<HomeHero | null> {
  const { data, error } = await client
    .from('recipes')
    .select('id, name, serves, total_minutes, photo_path, recipe_ingredients(name, catalog_key)')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { recipe_ingredients, ...recipe } = data;
  return { ...recipe, ingredients: recipe_ingredients };
}
