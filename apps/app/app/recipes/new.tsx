import { useState } from 'react';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import { RecipeForm } from '../../components/recipes/form/RecipeForm';
import { deviceStorage } from '../../lib/recipe-choices';
import { sectionOf } from '../../lib/recipe-form';
import { useSession } from '../../lib/session';

/** /recipes/new (spec 014): the recipe form for a new recipe, a full-screen modal. Saved, it opens. */
export default function NewRecipeRoute() {
  const params = useLocalSearchParams<{ section?: string }>();
  // Made here, so a photo can be stored under the recipe before it's saved.
  const [id] = useState(() => randomUUID());
  const { state, client, tracker } = useSession();
  if (state.status !== 'ready') return null;
  return (
    <RecipeForm
      recipeId={id}
      recipe={null}
      familyId={state.family.id}
      userId={state.userId}
      section={sectionOf(params.section)}
      onSectionChange={(section) => router.setParams({ section })}
      client={client}
      tracker={tracker}
      storage={deviceStorage}
      onClose={() => (router.canGoBack() ? router.back() : router.replace('/recipes'))}
      onSaved={() => router.replace(`/recipes/${id}` as Href)}
    />
  );
}
