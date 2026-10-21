import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { Button, FormScreen, RecipeItemSkeleton, Text } from '@cocon/ui';
import { RecipeForm } from '../../../components/recipes/form/RecipeForm';
import { deviceStorage } from '../../../lib/recipe-choices';
import { loadRecipeForm, recipeFormKey, sectionOf } from '../../../lib/recipe-form';
import { useSession } from '../../../lib/session';
import { strings } from '../../../strings/en';

const f = strings.recipeForm;

/**
 * /recipes/[id]/edit?section=… (spec 014): the recipe form for a saved recipe, a full-screen modal.
 * Its entry is "Edit recipe" in recipe settings (017); saved or cancelled, it goes back to the recipe.
 * `&variant=<id>` opens that variant in Variants, `&variant=new` starts one (recipe settings, 017).
 */
export default function EditRecipeRoute() {
  const params = useLocalSearchParams<{ id: string; section?: string; variant?: string }>();
  const parsed = z.uuid().safeParse(params.id);
  const id = parsed.success ? parsed.data : null;
  const variant = params.variant === 'new' || z.uuid().safeParse(params.variant).success ? params.variant : undefined;
  const { state, client, tracker } = useSession();
  const familyId = state.status === 'ready' ? state.family.id : null;
  const recipe = useQuery({
    queryKey: recipeFormKey(familyId ?? '', id ?? ''),
    queryFn: () => (id ? loadRecipeForm(client, id) : null),
    enabled: familyId !== null && id !== null,
    // Always the recipe as it is now: the form compares against it.
    staleTime: 0,
  });
  const back = () => (router.canGoBack() ? router.back() : router.replace((id ? `/recipes/${id}` : '/recipes') as Href));
  if (state.status !== 'ready') return null;
  if (!id || recipe.data === null || (recipe.isError && recipe.data === undefined)) {
    return (
      <FormScreen bar={null}>
        <Text variant="titleLg" role="heading" aria-level={1}>
          {f.loadFailedTitle}
        </Text>
        <Text color="ink-muted">{f.loadFailedBody}</Text>
        {id ? <Button label={f.retry} variant="soft" onPress={() => void recipe.refetch()} /> : null}
        <Button label={f.cancel} variant="soft" onPress={back} />
      </FormScreen>
    );
  }
  // Waits for a fresh copy, so the form never starts from an old one.
  if (!recipe.data || recipe.isFetching) {
    return (
      <FormScreen bar={null}>
        <RecipeItemSkeleton />
      </FormScreen>
    );
  }
  return (
    <RecipeForm
      key={id}
      recipeId={id}
      recipe={recipe.data}
      familyId={state.family.id}
      userId={state.userId}
      section={sectionOf(params.section)}
      onSectionChange={(section) => router.setParams({ section })}
      openVariant={variant}
      client={client}
      tracker={tracker}
      storage={deviceStorage}
      onClose={back}
      onSaved={back}
    />
  );
}
