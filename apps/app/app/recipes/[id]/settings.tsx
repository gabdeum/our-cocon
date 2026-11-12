import { Redirect, useLocalSearchParams, type Href } from 'expo-router';

/**
 * The old /recipes/[id]/settings (OC-RecipeSettings, retired in spec 051 FR-013): the recipe's own
 * settings and Delete are in the edit form's "This recipe" now.
 */
export default function RecipeSettingsRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={`/recipes/${encodeURIComponent(id ?? '')}/edit?section=details&focus=this-recipe` as Href} />;
}
