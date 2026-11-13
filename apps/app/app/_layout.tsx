import '../global.css';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, router, useGlobalSearchParams, usePathname, useSegments, type Href } from 'expo-router';
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
import { gateRedirect, openedPath, SessionProvider, useSession } from '../lib/session';
import { createQueryClient, persistMaxAge, queryPersister, shouldPersistQuery } from '../lib/query';
import { watchConnection } from '../lib/online';
import { SyncProvider } from '../lib/sync';
import { clearTimers, TimersProvider, useTimerOwner } from '../lib/timer-store';
import { CalendarPrefsProvider } from '../lib/calendar-prefs';
import { deviceStorage } from '../lib/recipe-choices';
import { clearPendingSave } from '../lib/pending-save';
import { ToastProvider, useToast } from '../lib/toast';
import { NotificationsProvider, useNotifications } from '../lib/notifications-context';
import { nativeNotifications } from '../lib/notifications-native';
import { clearPrefs, unregisterDevice } from '../lib/notifications';
import { timerNotifications } from '../lib/timer-notifications';
import { clearFollowUps, createTimerAlerts, liveAlert } from '../lib/timer-alerts';
import { createLiveActivity, endLiveActivity } from '../lib/live-activity';
import { liveTimerNative } from '../lib/live-timer-native';
import { linkOn } from '../lib/links';
import { strings } from '../strings/en';
import { playChime, vibrateDone } from '../lib/chime';
import { TimerAlerts } from '../components/timers/TimerAlerts';

/**
 * Sends people where their sign-in state allows (spec 003): sign in, set up a family, or the app.
 * A link opened signed out comes back after signing in (spec 054 FR-002); signing out goes to Welcome.
 */
function SessionGate() {
  const { state } = useSession();
  const segments = useSegments();
  const pathname = usePathname();
  const params = useGlobalSearchParams();
  const [wasSignedIn, setWasSignedIn] = useState(false);
  if (!wasSignedIn && (state.status === 'ready' || state.status === 'noFamily')) setWasSignedIn(true);
  const target = gateRedirect(state.status, segments, wasSignedIn ? undefined : openedPath(pathname, segments, params));
  useEffect(() => {
    if (target) router.replace(target as Href);
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

/** Spec 046: asking for notifications, this phone's registration, and opening a tapped notification. */
function Notifications({ children }: { children: ReactNode }) {
  const { state } = useSession();
  const toast = useToast();
  const navigate = useCallback((route: string) => router.push(route as Href), []);
  const showBanner = useCallback((text: string, onOpen: () => void) => toast.show({ text, action: { label: strings.notifications.open, onPress: onOpen } }), [toast]);
  return (
    <NotificationsProvider
      native={nativeNotifications}
      storage={AsyncStorage}
      client={supabase}
      tracker={tracker}
      userId={state.status === 'ready' ? state.userId : ''}
      navigate={navigate}
      showBanner={showBanner}
    >
      {children}
    </NotificationsProvider>
  );
}

/** Each signed-in person's timers, on every screen (spec 010), with the done chime and banner ("Open timers", 011). */
function Timers({ children }: { children: ReactNode }) {
  const { state } = useSession();
  const { maybeAsk, status, prefs } = useNotifications();
  const onStart = useCallback(() => maybeAsk('timer'), [maybeAsk]);
  const userId = state.status === 'ready' ? state.userId : '';
  // Spec 047: Lock Screen alerts, while notifications are allowed and "Alert when a timer ends" is on.
  // None until the iPhone has said: "off" for that moment would cancel the alerts already waiting.
  const enabled = status === 'granted' && prefs.timers_alert;
  const known = status !== null;
  const alerts = useMemo(
    () => (timerNotifications && userId && known ? createTimerAlerts({ local: timerNotifications, userId, storage: deviceStorage, tracker, enabled }) : undefined),
    [userId, known, enabled],
  );
  // Spec 048: the Lock Screen card while "Timer on Lock Screen" is on (it needs no notification
  // permission). Its "+1 min" moves the alerts too, so it carries them while they're on.
  const live = useMemo(
    () =>
      liveTimerNative && userId && known
        ? createLiveActivity({
            native: liveTimerNative,
            userId,
            tracker,
            enabled: prefs.timers_live,
            alertsFor: enabled ? (t) => liveAlert(t, userId) : undefined,
            // The app's own scheme: the card hands the link straight to the app.
            url: (path) => linkOn(undefined, path.slice(1)),
            isForeground: () => AppState.currentState === 'active',
          })
        : undefined,
    [userId, known, enabled, prefs.timers_live],
  );
  useTimerOwner(deviceStorage, state.status, userId, removeAllTimerAlerts);
  return (
    <TimersProvider userId={userId} storage={deviceStorage} tracker={tracker} onStart={onStart} alerts={alerts} live={live}>
      {children}
      <TimerAlerts chime={playChime} vibrate={vibrateDone} onOpenTimers={() => router.push('/timers')} />
    </TimersProvider>
  );
}

// Every timer notification on this phone, whoever's, and the Lock Screen card (specs 047 and 048:
// signed out, however the session ended, or another person signed in).
const phoneAlerts = timerNotifications;
const removeAllTimerAlerts =
  phoneAlerts || liveTimerNative
    ? async () => {
        if (liveTimerNative) await endLiveActivity(liveTimerNative).catch(() => undefined);
        if (phoneAlerts) await createTimerAlerts({ local: phoneAlerts, userId: '', storage: deviceStorage, tracker, enabled: false }).cancelAll();
      }
    : undefined;

// On sign-out: this person's timers, their Lock Screen alerts (spec 047) and card (spec 048),
// notification switches (spec 046), and a shared recipe still waiting to be saved (spec 019).
const clearDevice = async (userId: string) => {
  if (liveTimerNative) await endLiveActivity(liveTimerNative).catch(() => undefined);
  if (timerNotifications) await createTimerAlerts({ local: timerNotifications, userId, storage: AsyncStorage, tracker, enabled: false }).cancelAll();
  await clearFollowUps(AsyncStorage, userId);
  await clearTimers(AsyncStorage, userId);
  await clearPrefs(AsyncStorage, userId);
  await clearPendingSave();
};
// Spec 046: while still signed in, so reminders stop reaching this phone. The phone's own token goes
// too, so Expo refuses it even if the server never heard (offline); the next sign-in gets a new one.
const beforeSignOut = async () => {
  await unregisterDevice(supabase, AsyncStorage);
  await nativeNotifications?.unregister().catch(() => undefined);
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

  // Opened straight onto a shared recipe or event, nothing identified is sent (constitution VI, specs 019 and 042).
  const [firstSegment] = useSegments();
  const openedOnShared = useRef(['r', 'e'].includes(firstSegment ?? ''));
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
        <SessionProvider client={supabase} tracker={tracker} persister={queryPersister} restored={restored} clearDevice={clearDevice} beforeSignOut={beforeSignOut}>
          <FamilySync>
            <AppFrame>
              <ToastProvider tracker={tracker}>
              <Notifications>
              <Timers>
              <CalendarPrefsProvider>
                <SessionGate />
                <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
                  <Stack.Screen name="(tabs)" />
                  <Stack.Screen name="welcome/index" />
                  <Stack.Screen name="welcome/family" options={presentation.stack} />
                  <Stack.Screen name="auth/callback" />
                  <Stack.Screen name="auth/confirm" />
                  <Stack.Screen name="join/[token]" />
                  <Stack.Screen name="r/[token]" />
                  <Stack.Screen name="e/[token]" />
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
                  <Stack.Screen name="calendar/new" options={presentation.sheet} />
                  <Stack.Screen name="calendar/[id]/index" options={presentation.stack} />
                  <Stack.Screen name="calendar/[id]/edit" options={presentation.sheet} />
                  <Stack.Screen name="calendar/[id]/share" options={presentation.sheet} />
                  <Stack.Screen name="timers" options={presentation.stack} />
                  <Stack.Screen name="activity" options={presentation.stack} />
                  <Stack.Screen name="settings/index" />
                  <Stack.Screen name="settings/family" options={presentation.stack} />
                  <Stack.Screen name="settings/calendar" options={presentation.stack} />
                  <Stack.Screen name="settings/groceries" options={presentation.stack} />
                  <Stack.Screen name="settings/deleted" options={presentation.stack} />
                  <Stack.Screen name="settings/ai" options={presentation.stack} />
                  <Stack.Screen name="settings/notifications" options={presentation.stack} />
                  <Stack.Screen name="settings/recipes" options={presentation.stack} />
                  <Stack.Screen name="dev/gallery" options={presentation.stack} />
                  <Stack.Screen name="dev/sheet" options={presentation.sheet} />
                  <Stack.Screen name="dev/modal" options={presentation.fullScreen} />
                </Stack>
              </CalendarPrefsProvider>
              </Timers>
              </Notifications>
              </ToastProvider>
            </AppFrame>
          </FamilySync>
        </SessionProvider>
      </PersistQueryClientProvider>
    </ThemeProvider>
  );
}
