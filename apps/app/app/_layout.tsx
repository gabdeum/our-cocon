import '../global.css';
import { useEffect, type ReactNode } from 'react';
import { Platform } from 'react-native';
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
import { createQueryClient, persistMaxAge, queryPersister } from '../lib/query';
import { watchConnection } from '../lib/online';
import { SyncProvider } from '../lib/sync';

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

  useEffect(() => {
    trackAppOpened(tracker, Platform.OS, Constants.expoConfig?.version ?? '0.0.0');
  }, []);

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <ThemeProvider>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister: queryPersister, maxAge: persistMaxAge }}
        onSuccess={() => cacheRestored()}
        onError={() => cacheRestored()}
      >
        <SessionProvider client={supabase} tracker={tracker} persister={queryPersister} restored={restored}>
          <FamilySync>
            <AppFrame>
              <SessionGate />
              <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="welcome/index" />
                <Stack.Screen name="welcome/family" options={presentation.stack} />
                <Stack.Screen name="auth/callback" />
                <Stack.Screen name="join/[token]" />
                <Stack.Screen name="recipes/filters" options={presentation.sheet} />
                <Stack.Screen name="recipes/[id]" options={presentation.stack} />
                <Stack.Screen name="dev/gallery" options={presentation.stack} />
                <Stack.Screen name="dev/sheet" options={presentation.sheet} />
                <Stack.Screen name="dev/modal" options={presentation.fullScreen} />
              </Stack>
            </AppFrame>
          </FamilySync>
        </SessionProvider>
      </PersistQueryClientProvider>
    </ThemeProvider>
  );
}
