import { useEffect } from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import Constants from 'expo-constants';
import { loadConfig } from '../lib/config';
import { createAppTracker } from '../lib/analytics';
import { trackAppOpened } from '../lib/app-opened';

const config = loadConfig();
const tracker = createAppTracker(config);

export default function RootLayout() {
  useEffect(() => {
    trackAppOpened(tracker, Platform.OS, Constants.expoConfig?.version ?? '0.0.0');
  }, []);

  return <Stack screenOptions={{ headerShown: false }} />;
}
