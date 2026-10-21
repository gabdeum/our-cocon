import { useEffect, useMemo, useRef, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import Head from 'expo-router/head';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';
import { createTracker } from '@cocon/schemas';
import { SharedRecipe } from '../../components/shared/SharedRecipe';
import { TimerAlerts } from '../../components/timers/TimerAlerts';
import { playChime, vibrateDone } from '../../lib/chime';
import { clearPendingSave, pendingSave, rememberPendingSave } from '../../lib/pending-save';
import { saveSharedRecipe } from '../../lib/save-shared';
import { loadSharedRecipe, sharedRecipeKey } from '../../lib/shared-recipe';
import { useSession } from '../../lib/session';
import { TimersProvider } from '../../lib/timer-store';
import { anonymousTracker, config } from '../../lib/tracker';

// Timers on this page send nothing: their events would carry the viewer's identity (constitution VI).
const silent = createTracker(null);

/** /r/[token] (spec 019): a shared recipe, view only, for anyone with the link. */
export default function SharedRoute() {
  const { token = '' } = useLocalSearchParams<{ token: string }>();
  const { state, client, refresh } = useSession();
  const shared = useQuery({
    queryKey: sharedRecipeKey(token),
    queryFn: () => loadSharedRecipe(token, { supabaseUrl: config.supabaseUrl, anonKey: config.supabaseAnonKey }),
    staleTime: 0,
    retry: 1,
  });
  const load = shared.data ?? (shared.isError ? 'failed' : undefined);
  const recipe = shared.data?.kind === 'shared' ? shared.data : null;
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  // One save at a time: a second tap, or the page coming back, never makes two copies.
  const busy = useRef(false);

  const familyId = state.status === 'ready' ? state.family.id : null;
  const save = useMemo(
    () => async () => {
      if (!recipe) return;
      if (state.status === 'signedOut') {
        await rememberPendingSave(token);
        router.push(`/welcome?next=${encodeURIComponent(`/r/${token}`)}`);
        return;
      }
      if (state.status === 'noFamily') {
        await rememberPendingSave(token);
        router.push('/welcome/family');
        return;
      }
      if (!familyId || busy.current) return;
      busy.current = true;
      setSaving(true);
      setSaveFailed(false);
      await clearPendingSave();
      const id = await saveSharedRecipe(client, familyId, recipe.recipe, recipe.photoUrls);
      busy.current = false;
      setSaving(false);
      if (!id) {
        setSaveFailed(true);
        return;
      }
      await refresh();
      router.replace(`/recipes/${id}`);
    },
    [recipe, state.status, familyId, client, token, refresh],
  );

  // Back from signing in or setting up a family: save what was waiting for this link.
  useEffect(() => {
    // Only once there's a family to save into; before that, the button asks again.
    if (!recipe || state.status !== 'ready') return;
    let live = true;
    void pendingSave().then((waiting) => {
      if (live && waiting === token) void save();
    });
    return () => {
      live = false;
    };
  }, [recipe, state.status, token, save]);

  const name = recipe?.recipe.name;
  return (
    <TimersProvider userId={`shared-${token}`} storage={AsyncStorage} tracker={silent}>
      <Head>
        <meta name="robots" content="noindex" />
        {name ? <title>{`${name} · Our Cocon`}</title> : null}
        {name ? <meta property="og:title" content={name} /> : null}
      </Head>
      <SharedRecipe
        load={load}
        token={token}
        tracker={anonymousTracker}
        timerTracker={silent}
        onRetry={() => void shared.refetch()}
        onSave={() => void save()}
        saving={saving}
        saveFailed={saveFailed}
      />
      <TimerAlerts chime={playChime} vibrate={vibrateDone} />
    </TimersProvider>
  );
}
