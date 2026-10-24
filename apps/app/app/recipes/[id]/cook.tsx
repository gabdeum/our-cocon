import { useCallback, useState } from 'react';
import { router, useFocusEffect, useLocalSearchParams, type Href } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { CookScreen } from '../../../components/cooking/CookScreen';
import { loadRecipe, recipeKey } from '../../../lib/recipe';
import { deviceStorage } from '../../../lib/recipe-choices';
import { useSession } from '../../../lib/session';

/**
 * /recipes/[id]/cook (spec 012): cooking mode, a full-screen modal over the recipe page.
 * `?step=<stepId>` opens it at that step: a step timer's "Go to step" on Timers, or a step on the
 * recipe page's Steps tab (`&from=recipe`).
 */
export default function CookRoute() {
  const params = useLocalSearchParams<{ id: string; step?: string; from?: string }>();
  const parsed = z.uuid().safeParse(params.id);
  const id = parsed.success ? parsed.data : null;
  const { state, client, tracker } = useSession();
  const familyId = state.status === 'ready' ? state.family.id : null;
  const recipe = useQuery({
    queryKey: recipeKey(familyId ?? '', id ?? ''),
    queryFn: () => (id ? loadRecipe(client, id) : null),
    enabled: familyId !== null && id !== null,
  });
  const step = typeof params.step === 'string' ? params.step : undefined;
  // Back from the options' scale or converter sheet, cooking mode reads the choices they saved.
  const [visit, setVisit] = useState(0);
  useFocusEffect(useCallback(() => setVisit((v) => v + 1), []));
  const sheet = (page: 'scale' | 'convert') => () => {
    if (id) router.push(`/recipes/${id}/${page}` as Href);
  };
  // Exit and Finish return to the recipe: the page underneath (also when a step on it opened this,
  // `from=recipe`), or, opened from Timers at a step, the recipe page in its place (back from there
  // returns to Timers).
  const close = () => {
    if (router.canGoBack() && (!step || params.from === 'recipe')) router.back();
    else router.replace((id ? `/recipes/${id}` : '/recipes') as Href);
  };
  return (
    <CookScreen
      recipe={id ? recipe.data : null}
      failed={recipe.isError && recipe.data === undefined}
      onRetry={() => void recipe.refetch()}
      userId={state.status === 'ready' ? state.userId : ''}
      storage={deviceStorage}
      tracker={tracker}
      stepId={step}
      onClose={close}
      onOpenTimers={() => router.push('/timers')}
      onScaleByIngredient={sheet('scale')}
      onConvert={sheet('convert')}
      visit={visit}
    />
  );
}
