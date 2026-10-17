import '../global.css';
import { useEffect } from 'react';
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
import { AppFrame, ThemeProvider } from '@cocon/ui';
import { tracker } from '../lib/tracker';
import { trackAppOpened } from '../lib/app-opened';
import { presentation } from '../lib/navigation';
import { supabase } from '../lib/supabase';
import { gateRedirect, SessionProvider, useSession } from '../lib/session';

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

  useEffect(() => {
    trackAppOpened(tracker, Platform.OS, Constants.expoConfig?.version ?? '0.0.0');
  }, []);

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <ThemeProvider>
      <SessionProvider client={supabase} tracker={tracker}>
        <AppFrame>
          <SessionGate />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="welcome/index" />
            <Stack.Screen name="welcome/family" options={presentation.stack} />
            <Stack.Screen name="auth/callback" />
            <Stack.Screen name="join/[token]" />
            <Stack.Screen name="dev/gallery" options={presentation.stack} />
            <Stack.Screen name="dev/sheet" options={presentation.sheet} />
            <Stack.Screen name="dev/modal" options={presentation.fullScreen} />
          </Stack>
        </AppFrame>
      </SessionProvider>
    </ThemeProvider>
  );
}
