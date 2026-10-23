export { loadFacts, loadRecipe, type RecipeDetail } from '@cocon/data';

/**
 * One recipe page's data (spec 008). The key starts with `recipes`, so a live change to the recipe
 * (or its ingredients, steps or variants, which mark it as changed) refetches it (lib/sync.tsx).
 */
export const recipeKey = (familyId: string, id: string) => ['recipes', familyId, 'detail', id] as const;
