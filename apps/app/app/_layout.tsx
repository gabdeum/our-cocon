import '../global.css';
import { useEffect, useRef, type ReactNode } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, router, useSegments } from 'expo-router';
import Constants from 'expo-constants';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  Nunito_400Regular,
  Nunito_500Medium,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  Nunito_900Black,
} from '@expo-google-fonts/nunito';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { AppFrame, ThemeProvider } from '@cocon/ui';
import { tracker } from '../lib/tracker';
import { trackAppOpened } from '../lib/app-opened';
import { presentation } from '../lib/navigation';
import { supabase } from '../lib/supabase';
import { gateRedirect, SessionProvider, useSession } from '../lib/session';
import { createQueryClient, persistMaxAge, queryPersister, shouldPersistQuery } from '../lib/query';
import { watchConnection } from '../lib/online';
import { SyncProvider } from '../lib/sync';
import { clearTimers, TimersProvider } from '../lib/timer-store';
import { deviceStorage } from '../lib/recipe-choices';
import { clearPendingSave } from '../lib/pending-save';
import { playChime, vibrateDone } from '../lib/chime';
import { TimerAlerts } from '../components/timers/TimerAlerts';

/** Sends people where their sign-in state allows (spec 003): sign in, set up a family, or the app. */
function SessionGate() {
  const { state } = useSession();
  const segments = useSegments();
  const target = gateRedirect(state.status, segments);
  useEffect(() => {
    if (target) router.replace(target);
  }, [target]);
  return null;
}

/** Live changes for the signed-in family (spec 004), once they have one. */
function FamilySync({ children }: { children: ReactNode }) {
  const { state } = useSession();
  return (
    <SyncProvider client={supabase} familyId={state.status === 'ready' ? state.family.id : null}>
      {children}
    </SyncProvider>
  );
}

/** Each signed-in person's timers, on every screen (spec 010), with the done chime and banner ("Open timers", 011). */
function Timers({ children }: { children: ReactNode }) {
  const { state } = useSession();
  return (
    <TimersProvider userId={state.status === 'ready' ? state.userId : ''} storage={deviceStorage} tracker={tracker}>
      {children}
      <TimerAlerts chime={playChime} vibrate={vibrateDone} onOpenTimers={() => router.push('/timers')} />
    </TimersProvider>
  );
}

// On sign-out: this person's timers, and a shared recipe still waiting to be saved (spec 019).
const clearDevice = async (userId: string) => {
  await clearTimers(AsyncStorage, userId);
  await clearPendingSave();
};

const queryClient = createQueryClient();
// Resolves once the saved cache is back, so the session can check whose it is first.
let cacheRestored: () => void = () => undefined;
const restored = new Promise<void>((resolve) => (cacheRestored = resolve));

// Nothing is drawn until Nunito is loaded, so the first paint is already in Nunito (FR-003).
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Nunito_400Regular,
    Nunito_500Medium,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
    Nunito_900Black,
  });
  const ready = fontsLoaded || fontError !== null;

  useEffect(() => watchConnection(), []);

  // Opened straight onto a shared recipe, nothing identified is sent (constitution VI, spec 019).
  const [firstSegment] = useSegments();
  const openedOnShared = useRef(firstSegment === 'r');
  useEffect(() => {
    if (!openedOnShared.current) trackAppOpened(tracker, Platform.OS, Constants.expoConfig?.version ?? '0.0.0');
  }, []);

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <ThemeProvider>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister: queryPersister, maxAge: persistMaxAge, dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery } }}
        onSuccess={() => cacheRestored()}
        onError={() => cacheRestored()}
      >
        <SessionProvider client={supabase} tracker={tracker} persister={queryPersister} restored={restored} clearDevice={clearDevice}>
          <FamilySync>
            <AppFrame>
              <Timers>
                <SessionGate />
                <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
                  <Stack.Screen name="(tabs)" />
                  <Stack.Screen name="welcome/index" />
                  <Stack.Screen name="welcome/family" options={presentation.stack} />
                  <Stack.Screen name="auth/callback" />
                  <Stack.Screen name="join/[token]" />
                  <Stack.Screen name="r/[token]" />
                  <Stack.Screen name="oauth/consent" />
                  <Stack.Screen name="recipes/filters" options={presentation.sheet} />
                  <Stack.Screen name="recipes/new" options={presentation.fullScreen} />
                  <Stack.Screen name="recipes/[id]/index" options={presentation.stack} />
                  <Stack.Screen name="recipes/[id]/cook" options={presentation.fullScreen} />
                  <Stack.Screen name="recipes/[id]/scale" options={presentation.sheet} />
                  <Stack.Screen name="recipes/[id]/convert" options={presentation.sheet} />
                  <Stack.Screen name="recipes/[id]/share" options={presentation.sheet} />
                  <Stack.Screen name="recipes/[id]/add-to-groceries" options={presentation.sheet} />
                  <Stack.Screen name="recipes/[id]/edit" options={presentation.fullScreen} />
                  <Stack.Screen name="recipes/[id]/settings" options={presentation.stack} />
                  <Stack.Screen name="timers" options={presentation.stack} />
                  <Stack.Screen name="activity" options={presentation.stack} />
                  <Stack.Screen name="settings/deleted" options={presentation.stack} />
                  <Stack.Screen name="settings/ai" options={presentation.stack} />
                  <Stack.Screen name="settings/recipes" options={presentation.stack} />
                  <Stack.Screen name="dev/gallery" options={presentation.stack} />
                  <Stack.Screen name="dev/sheet" options={presentation.sheet} />
                  <Stack.Screen name="dev/modal" options={presentation.fullScreen} />
                </Stack>
              </Timers>
            </AppFrame>
          </FamilySync>
        </SessionProvider>
      </PersistQueryClientProvider>
    </ThemeProvider>
  );
}
