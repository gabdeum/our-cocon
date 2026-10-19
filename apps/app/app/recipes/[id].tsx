import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { RecipePage, type RecipeTab } from '../../components/recipes/RecipePage';
import { loadRecipe, recipeKey } from '../../lib/recipe';
import { deviceStorage } from '../../lib/recipe-choices';
import { useSession } from '../../lib/session';

// Share (019), recipe settings (027), add to groceries (022) and cooking mode (012) come later;
// typed routes learn them then.
const recipeRoute = (id: string, page: string) => `/recipes/${id}/${page}` as Href;

/** /recipes/[id] (spec 008): the recipe page. `?tab=steps` opens the Steps tab (009). */
export default function RecipeRoute() {
  const params = useLocalSearchParams<{ id: string; tab?: string }>();
  // A link with a malformed id is a recipe that isn't there, not a failed load.
  const parsed = z.uuid().safeParse(params.id);
  const id = parsed.success ? parsed.data : null;
  const tab = params.tab;
  const { state, client, tracker } = useSession();
  const familyId = state.status === 'ready' ? state.family.id : null;
  const recipe = useQuery({
    queryKey: recipeKey(familyId ?? '', id ?? ''),
    queryFn: () => (id ? loadRecipe(client, id) : null),
    enabled: familyId !== null && id !== null,
  });
  const go = (page: string) => () => {
    if (id) router.push(recipeRoute(id, page));
  };
  const back = () => (router.canGoBack() ? router.back() : router.replace('/recipes'));
  return (
    <RecipePage
      recipe={id ? recipe.data : null}
      failed={recipe.isError && recipe.data === undefined}
      onRetry={() => void recipe.refetch()}
      members={state.status === 'ready' ? state.members : []}
      userId={state.status === 'ready' ? state.userId : ''}
      tracker={tracker}
      tab={tab === 'steps' ? 'steps' : 'ingredients'}
      onTabChange={(next: RecipeTab) => router.setParams({ tab: next })}
      storage={deviceStorage}
      onBack={back}
      onShare={go('share')}
      onSettings={go('settings')}
      onAddToGroceries={go('add-to-groceries')}
      onStartCooking={go('cook')}
    />
  );
}
