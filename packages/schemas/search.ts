/**
 * Recipe search (spec 006 FR-004), shared by the app's list and the MCP `search_recipes` tool (023).
 * Both sides are lowercased and stripped of accents, so "gruyere" finds "Gruyère" and "LEEK" finds
 * "leeks".
 */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[‘’ʼ]/g, "'")
    .toLowerCase();
}

export interface SearchableRecipe {
  name: string;
  description?: string | null;
  ingredientNames: readonly string[];
}

/** The words of a query, normalised. An empty list matches every recipe. */
export function searchWords(query: string): string[] {
  return normalizeText(query).split(/\s+/).filter(Boolean);
}

/** True when every word of the query appears in the name, the description or an ingredient name. */
export function recipeMatches(recipe: SearchableRecipe, query: string | readonly string[]): boolean {
  const words = typeof query === 'string' ? searchWords(query) : query;
  if (words.length === 0) return true;
  const fields = [recipe.name, recipe.description ?? '', ...recipe.ingredientNames].map(normalizeText);
  return words.every((word) => fields.some((field) => field.includes(word)));
}
