export { loadRecipeList, searchRecipes, visibleRecipes, type RecipeListItem } from '@cocon/data';

/**
 * The recipe list's query key (spec 006). It starts with `recipes`, so a live change to a recipe
 * refetches it (lib/sync.tsx); an ingredient or variant change also marks its recipe as changed.
 */
export const recipeListKey = (familyId: string) => ['recipes', familyId, 'list'] as const;
