import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { RecipeSettings } from '../../../components/recipes/RecipeSettings';
import { loadRecipe, recipeKey } from '../../../lib/recipe';
import { useSession } from '../../../lib/session';

/** /recipes/[id]/settings (OC-RecipeSettings, specs 017 and 027). */
export default function RecipeSettingsRoute() {
  const params = useLocalSearchParams<{ id: string }>();
  const parsed = z.uuid().safeParse(params.id);
  const id = parsed.success ? parsed.data : null;
  const { state, client } = useSession();
  const familyId = state.status === 'ready' ? state.family.id : null;
  const recipe = useQuery({
    queryKey: recipeKey(familyId ?? '', id ?? ''),
    queryFn: () => (id ? loadRecipe(client, id) : null),
    enabled: familyId !== null && id !== null,
  });
  const back = () => (router.canGoBack() ? router.back() : router.replace((id ? `/recipes/${id}` : '/recipes') as Href));
  const edit = (query: string) => {
    if (id) router.push(`/recipes/${id}/edit?${query}` as Href);
  };
  return (
    <RecipeSettings
      recipe={id ? recipe.data : null}
      failed={recipe.isError && recipe.data === undefined}
      onRetry={() => void recipe.refetch()}
      onBack={back}
      onEditRecipe={() => edit('section=details')}
      onEditVariants={(variant) => edit(variant ? `section=variants&variant=${variant}` : 'section=variants')}
    />
  );
}
