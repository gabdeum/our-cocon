import '../global.css';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';
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
      <AppFrame>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="dev/gallery" options={presentation.stack} />
          <Stack.Screen name="dev/sheet" options={presentation.sheet} />
          <Stack.Screen name="dev/modal" options={presentation.fullScreen} />
        </Stack>
      </AppFrame>
    </ThemeProvider>
  );
}
