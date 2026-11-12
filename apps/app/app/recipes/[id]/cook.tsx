import { useCallback, useEffect, useRef, useState } from 'react';
import { router, useFocusEffect, useLocalSearchParams, type Href } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { loadOpenCooks, saveCookStep } from '@cocon/data';
import { CookScreen } from '../../../components/cooking/CookScreen';
import { beginCook, finishCook, useRefreshCooks, type CookSession } from '../../../lib/cook-sessions';
import { loadRecipe, recipeKey } from '../../../lib/recipe';
import { deviceStorage, readChoices, startingChoices } from '../../../lib/recipe-choices';
import { useCookingSettings } from '../../../lib/recipe-settings';
import { servingsMax } from '../../../lib/recipe-view';
import { useSession } from '../../../lib/session';

/** FR-002: the step is saved this long after it last changed, and on leaving. */
export const COOK_SAVE_MS = 2000;

/**
 * /recipes/[id]/cook (spec 012): cooking mode, a full-screen modal over the recipe page.
 * `?step=<stepId>` opens it at that step: a step timer's "Go to step" on Timers, or a step on the
 * recipe page's Steps tab (`&from=recipe`).
 *
 * Spec 051: it cooks inside the recipe's cook. The open one is resumed; with none, one starts.
 * `?start=over` cancels the open one first ("Start over"). Offline, it still cooks, unsaved.
 */
export default function CookRoute() {
  const params = useLocalSearchParams<{ id: string; step?: string; from?: string; start?: string }>();
  const parsed = z.uuid().safeParse(params.id);
  const id = parsed.success ? parsed.data : null;
  const { state, client, tracker } = useSession();
  const familyId = state.status === 'ready' ? state.family.id : null;
  const userId = state.status === 'ready' ? state.userId : '';
  const recipe = useQuery({
    queryKey: recipeKey(familyId ?? '', id ?? ''),
    queryFn: () => (id ? loadRecipe(client, id) : null),
    enabled: familyId !== null && id !== null,
  });
  const cooking = useCookingSettings(recipe.data?.overrides);
  const refresh = useRefreshCooks();
  const step = typeof params.step === 'string' ? params.step : undefined;

  // The cook: undefined while it's found or started; `resumed` when it was already open.
  const [cook, setCook] = useState<{ session: CookSession | null; resumed: boolean } | undefined>(undefined);
  const loaded = recipe.data ?? null;
  useEffect(() => {
    if (cook !== undefined || !loaded || !familyId || !id) return;
    let live = true;
    void (async () => {
      try {
        const open = (await loadOpenCooks(client)).find((s) => s.recipe_id === id) ?? null;
        if (open && params.start !== 'over') {
          if (live) setCook({ session: open, resumed: true });
          return;
        }
        const choices = startingChoices(await readChoices(deviceStorage, userId, id), loaded, servingsMax(loaded.serves));
        const progress = { current_step: 0, variant_id: choices.version, servings: Math.min(50, Math.max(1, Math.round(choices.servings))) };
        const session = await beginCook({ client, tracker }, familyId, id, progress, open ?? undefined);
        if (live) setCook({ session, resumed: false });
      } catch {
        if (live) setCook({ session: null, resumed: false });
      }
      void refresh();
    })();
    return () => {
      live = false;
    };
    // Once per visit, when the recipe is there.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cook === undefined, loaded?.id, familyId]);

  // FR-002: the step, 2 s after it settles and when leaving.
  const pending = useRef<{ index: number; timer: ReturnType<typeof setTimeout> } | null>(null);
  const stepAt = useRef<number | null>(null);
  const sessionId = cook?.session?.id ?? null;
  const flush = useCallback(() => {
    const p = pending.current;
    pending.current = null;
    if (!p || !sessionId) return Promise.resolve();
    clearTimeout(p.timer);
    return saveCookStep(client, sessionId, p.index).catch(() => undefined);
  }, [client, sessionId]);
  useEffect(() => () => void flush(), [flush]);
  const onStep = useCallback(
    (index: number) => {
      if (!sessionId) return;
      stepAt.current = index;
      // The cook's own step needs no save when it opens there.
      if (!pending.current && index === cook?.session?.current_step) return;
      if (pending.current) clearTimeout(pending.current.timer);
      pending.current = { index, timer: setTimeout(() => void flush(), COOK_SAVE_MS) };
    },
    [sessionId, cook?.session?.current_step, flush],
  );

  // Back from the options' scale or converter sheet, cooking mode reads the choices they saved.
  const [visit, setVisit] = useState(0);
  useFocusEffect(useCallback(() => setVisit((v) => v + 1), []));
  const sheet = (page: 'scale' | 'convert') => () => {
    if (id) router.push(`/recipes/${id}/${page}` as Href);
  };
  // ✕ returns to the recipe: the page underneath (also when a step on it opened this,
  // `from=recipe`), or, opened from Timers at a step, the recipe page in its place (back from there
  // returns to Timers). The cook stays in progress.
  const close = () => {
    void flush();
    if (router.canGoBack() && (!step || params.from === 'recipe')) router.back();
    else router.replace((id ? `/recipes/${id}` : '/recipes') as Href);
  };
  // FR-005: "Done cooking" logs it, then the recipe page opens the Done sheet.
  const done = async () => {
    const session = cook?.session;
    if (!session || !id) return close();
    await flush();
    try {
      await finishCook({ client, tracker }, { ...session, current_step: stepAt.current ?? session.current_step });
    } catch {
      return close();
    }
    void refresh();
    router.dismissTo({ pathname: '/recipes/[id]', params: { id, cooked: session.id } });
  };
  return (
    <CookScreen
      recipe={id ? (cook === undefined && recipe.data ? undefined : recipe.data) : null}
      failed={recipe.isError && recipe.data === undefined}
      onRetry={() => void recipe.refetch()}
      userId={userId}
      storage={deviceStorage}
      tracker={tracker}
      stepId={step}
      session={cook?.resumed ? cook.session : null}
      onStep={onStep}
      onDone={() => void done()}
      onClose={close}
      onOpenTimers={() => router.push('/timers')}
      onScaleByIngredient={sheet('scale')}
      onConvert={sheet('convert')}
      onEditStep={(target) => {
        if (!id) return;
        // Saved or cancelled, the form goes back to cooking mode at the same step.
        const at = 'step' in target ? `section=steps&step=${target.step}` : `section=variants&variant=${target.variant}`;
        router.push(`/recipes/${id}/edit?${at}` as Href);
      }}
      visit={visit}
      cooking={cooking}
    />
  );
}
