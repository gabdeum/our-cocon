import { router, type Href } from 'expo-router';
import { useQueries } from '@tanstack/react-query';
import { z } from 'zod';
import { TimersScreen } from '../components/timers/TimersScreen';
import { loadRecipe, recipeKey, type RecipeDetail } from '../lib/recipe';
import { useSession } from '../lib/session';
import { useTimers } from '../lib/timer-store';
import { tracker } from '../lib/tracker';

/** /timers (spec 011): reachable from anywhere through the TimerPill or the done banner. */
export default function TimersRoute() {
  const { state, client } = useSession();
  const familyId = state.status === 'ready' ? state.family.id : null;
  // The step timers' recipes (usually cached already), so "Go to step" shows only while the step is there.
  const ids = [...new Set(useTimers().timers.flatMap((t) => (z.uuid().safeParse(t.recipeId).success && t.recipeId ? [t.recipeId] : [])))];
  const loaded = useQueries({
    queries: ids.map((id) => ({
      queryKey: recipeKey(familyId ?? '', id),
      queryFn: () => loadRecipe(client, id),
      enabled: familyId !== null,
    })),
  });
  const recipes: Record<string, RecipeDetail | null | undefined> = Object.fromEntries(ids.map((id, i) => [id, loaded[i]?.data]));
  return (
    <TimersScreen
      tracker={tracker}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      recipes={recipes}
      onGoToStep={(recipeId, stepId) => router.push(`/recipes/${recipeId}/cook?step=${encodeURIComponent(stepId)}` as Href)}
    />
  );
}
