import { useCallback, useEffect, useState } from 'react';
import { router, useFocusEffect, useLocalSearchParams, type Href } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { loadCook, loadOpenCooks } from '@cocon/data';
import { MAX_TRACKED_STEPS } from '@cocon/schemas';
import { AlreadyCookingSheet } from '../../../components/cooking/AlreadyCookingSheet';
import { useCookActions } from '../../../components/cooking/use-cook-actions';
import { RecipePage, type RecipeTab } from '../../../components/recipes/RecipePage';
import { useCalendarDisplay } from '../../../lib/calendar-prefs';
import { useCooked, useOpenCooks, type CookSession } from '../../../lib/cook-sessions';
import { loadRecipe, recipeKey } from '../../../lib/recipe';
import { deviceStorage } from '../../../lib/recipe-choices';
import { recipePhotoPaths, useRecipePhotoUrls } from '../../../lib/recipe-photo';
import { useCookingSettings } from '../../../lib/recipe-settings';
import { useSession } from '../../../lib/session';
import { strings } from '../../../strings/en';

// The recipe's own pages: share, edit, add-to-groceries, cook, scale, convert.
const recipeRoute = (id: string, page: string) => `/recipes/${id}/${page}` as Href;

/**
 * /recipes/[id] (spec 008): the recipe page. `?tab=steps` opens the Steps tab (009). `?cooked=<id>`
 * opens the Done sheet for a cook cooking mode just logged (spec 051 FR-005).
 */
export default function RecipeRoute() {
  const params = useLocalSearchParams<{ id: string; tab?: string; cooked?: string; servings?: string }>();
  // A link with a malformed id is a recipe that isn't there, not a failed load.
  const parsed = z.uuid().safeParse(params.id);
  const id = parsed.success ? parsed.data : null;
  const tab = params.tab;
  const { state, client, tracker } = useSession();
  const familyId = state.status === 'ready' ? state.family.id : null;
  const members = state.status === 'ready' ? state.members : [];
  const userId = state.status === 'ready' ? state.userId : '';
  const recipe = useQuery({
    queryKey: recipeKey(familyId ?? '', id ?? ''),
    queryFn: () => (id ? loadRecipe(client, id) : null),
    enabled: familyId !== null && id !== null,
  });
  const cooking = useCookingSettings(recipe.data?.overrides);
  const photoUrls = useRecipePhotoUrls(client, familyId, recipePhotoPaths(recipe.data));
  const cook = useOpenCooks().data?.find((s) => s.recipe_id === id) ?? null;
  const cooked = useCooked(id).data ?? null;
  const { use24h } = useCalendarDisplay().prefs;
  const actions = useCookActions();
  const [busy, setBusy] = useState<CookSession | null>(null);
  const go = (page: string) => () => {
    if (id) router.push(recipeRoute(id, page));
  };
  const edit = () => {
    if (!id) return;
    tracker.track('recipe_edit_opened', { from: 'top_bar' });
    router.push(`${recipeRoute(id, 'edit')}?section=details` as Href);
  };
  const cookAt = (query: string) => {
    if (id) router.push(`${recipeRoute(id, 'cook')}?${query}` as Href);
  };
  // FR-002: a fresh look first, so a cook someone started a moment ago is resumed, not doubled.
  const start = async () => {
    if (!id) return;
    const open = (await loadOpenCooks(client).catch(() => [])).find((s) => s.recipe_id === id);
    if (open) setBusy(open);
    else cookAt('start=new');
  };
  const resume = (step?: string) => {
    if (cook) tracker.track('cook_resumed', { from: 'recipe', step: Math.min(cook.current_step + 1, MAX_TRACKED_STEPS) });
    cookAt(step ? `step=${encodeURIComponent(step)}&from=recipe` : 'from=recipe');
  };

  // Back from cooking mode's "Done cooking": the Done sheet for that cook.
  const cookedId = z.uuid().safeParse(params.cooked).data ?? null;
  useEffect(() => {
    if (!cookedId || !recipe.data) return;
    router.setParams({ cooked: undefined });
    void loadCook(client, cookedId)
      .then((session) => (session ? actions.showDone(session, recipe.data?.name ?? '') : undefined))
      .catch(() => undefined);
    // Once per cook logged.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cookedId, recipe.data?.id]);

  // Back from the scale sheet (013), the page reads the choices it saved.
  const [visit, setVisit] = useState(0);
  useFocusEffect(useCallback(() => setVisit((v) => v + 1), []));
  const back = () => (router.canGoBack() ? router.back() : router.replace('/recipes'));
  const name = (uid: string | null) => members.find((m) => m.user_id === uid)?.display_name ?? strings.recipe.formerMember;
  return (
    <>
      <RecipePage
        recipe={id ? recipe.data : null}
        failed={recipe.isError && recipe.data === undefined}
        onRetry={() => void recipe.refetch()}
        members={members}
        userId={userId}
        tracker={tracker}
        tab={tab === 'steps' ? 'steps' : 'ingredients'}
        onTabChange={(next: RecipeTab) => router.setParams({ tab: next })}
        storage={deviceStorage}
        onBack={back}
        onShare={go('share')}
        onEdit={edit}
        onAddToGroceries={go('add-to-groceries')}
        onStart={() => void start()}
        cook={cook}
        cooked={cooked}
        onCookResume={() => resume()}
        onCookDone={() => {
          if (cook && recipe.data) void actions.finish(cook, recipe.data.name);
        }}
        onCookCancel={() => {
          if (cook) void actions.cancel(cook);
        }}
        use24h={use24h}
        onOpenStep={(step) => (cook ? resume(step) : cookAt(`step=${encodeURIComponent(step)}&from=recipe&start=new`))}
        onOpenTimers={() => router.push('/timers')}
        onScaleByIngredient={go('scale')}
        onConvert={go('convert')}
        visit={visit}
        openAtServings={z.coerce.number().int().min(1).max(50).safeParse(params.servings).data}
        photoUrls={photoUrls}
        cooking={cooking}
      />
      <AlreadyCookingSheet
        cook={busy ? { member: name(busy.started_by), step: busy.current_step + 1, mine: busy.started_by === userId } : null}
        onResume={() => {
          setBusy(null);
          if (id) tracker.track('cook_started', { recipe_id: id, resumed_existing: true });
          cookAt('from=recipe');
        }}
        onStartOver={() => {
          setBusy(null);
          cookAt('start=over');
        }}
        onClose={() => setBusy(null)}
      />
      {actions.sheet}
    </>
  );
}
