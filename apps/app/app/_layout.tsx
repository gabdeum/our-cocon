import '../global.css';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DefaultTheme, Stack, ThemeProvider as NavigationTheme, router, useGlobalSearchParams, usePathname, useSegments, type Href } from 'expo-router';
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
import { AppFrame, ThemeProvider, theme, useLayoutTier } from '@cocon/ui';
import { tracker } from '../lib/tracker';
import { trackAppOpened } from '../lib/app-opened';
import { useLayoutAnalytics } from '../lib/layout-analytics';
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
import { timerAlarmNotifications, timerNotifications } from '../lib/timer-notifications';
import { timerAlarmsNative } from '../lib/timer-alarms-native';
import { useAlarmPermission } from '../lib/timer-alarms';
// Spec 059: a reminder's Lock Screen actions are listened for as soon as the app's code loads.
import '../lib/todo-notifications';
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
  // Spec 061 (iOS 26): alarms take the place of the done notification once allowed. iOS asks on the
  // first timer started; the notifications question (spec 046) then comes only if alarms are refused.
  const { permission: alarmPermission, request: askAlarms } = useAlarmPermission(timerAlarmsNative, tracker);
  const onStart = useCallback(() => {
    if (alarmPermission === 'notDetermined') void askAlarms().then((answer) => answer !== 'authorized' && maybeAsk('timer'));
    else if (alarmPermission !== 'authorized') maybeAsk('timer');
  }, [alarmPermission, askAlarms, maybeAsk]);
  const userId = state.status === 'ready' ? state.userId : '';
  const alarms = timerAlarmNotifications !== null && alarmPermission === 'authorized';
  // Spec 047: Lock Screen alerts, while notifications (or alarms) are allowed and "Alert when a timer
  // ends" is on. None until the iPhone has said: "off" for that moment would cancel the alerts already waiting.
  const enabled = (alarms || status === 'granted') && prefs.timers_alert;
  const known = status !== null;
  const alerts = useMemo(() => {
    const local = alarms ? timerAlarmNotifications : timerNotifications;
    return local && userId && known ? createTimerAlerts({ local, userId, storage: deviceStorage, tracker, enabled, alarms }) : undefined;
  }, [userId, known, enabled, alarms]);
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
      {/* With alarms (spec 061) the phone rings, on screen too: the app only shows "Blind bake is done". */}
      <TimerAlerts chime={alerts?.rings ? quiet : playChime} vibrate={alerts?.rings ? quiet : vibrateDone} onOpenTimers={() => router.push('/timers')} />
    </TimersProvider>
  );
}

const quiet = () => undefined;

// Every timer notification on this phone, whoever's, and the Lock Screen card (specs 047 and 048:
// signed out, however the session ended, or another person signed in).
const phoneAlerts = timerNotifications;
const removeAllTimerAlerts =
  phoneAlerts || liveTimerNative
    ? async () => {
        if (liveTimerNative) await endLiveActivity(liveTimerNative).catch(() => undefined);
        await timerAlarmsNative?.clear().catch(() => undefined);
        if (phoneAlerts) await createTimerAlerts({ local: phoneAlerts, userId: '', storage: deviceStorage, tracker, enabled: false }).cancelAll();
      }
    : undefined;

// On sign-out: this person's timers, their Lock Screen alerts (spec 047) and card (spec 048),
// notification switches (spec 046), and a shared recipe still waiting to be saved (spec 019).
const clearDevice = async (userId: string) => {
  if (liveTimerNative) await endLiveActivity(liveTimerNative).catch(() => undefined);
  await timerAlarmsNative?.clear().catch(() => undefined);
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

/**
 * Behind every screen, the navigation library paints its own background (light grey by default).
 * It shows wherever a screen leaves room, like the 104 slot behind the side rail from 960 (spec
 * 064): the page's colour there too.
 */
const navigationTheme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: theme.color.surfacePage } };

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
  // Spec 067: from 960 the recipe opens beside the list that's already on screen, without a slide.
  const { tier } = useLayoutTier();
  // From 600 these are centred cards over the screen below (FormScreen and PushedScreen `card`).
  // From 960 Reminders and Timers are rail destinations: they appear in place, like a tab.
  const railPage = tier === 'expanded' ? { ...presentation.stack, animation: 'none' as const } : presentation.stack;
  const card = (phone: (typeof presentation)[keyof typeof presentation]) => (tier === 'compact' ? phone : { ...presentation.sheet, animation: 'fade' as const });

  useEffect(() => watchConnection(), []);
  // Before app_opened, so it carries them too (spec 063).
  useLayoutAnalytics(tracker);

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
                <NavigationTheme value={navigationTheme}>
                <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
                  {/* From 960, back from Reminders or Timers opened on their own (a notification): the tabs appear in place too. */}
                  <Stack.Screen name="(tabs)" options={tier === 'expanded' ? { animation: 'none' } : undefined} />
                  <Stack.Screen name="welcome/index" />
                  <Stack.Screen name="welcome/family" options={presentation.stack} />
                  <Stack.Screen name="auth/callback" />
                  <Stack.Screen name="auth/confirm" />
                  <Stack.Screen name="join/[token]" />
                  <Stack.Screen name="r/[token]" />
                  <Stack.Screen name="e/[token]" />
                  <Stack.Screen name="oauth/consent" />
                  <Stack.Screen name="recipes/filters" options={presentation.sheet} />
                  <Stack.Screen name="recipes/new" options={card(presentation.fullScreen)} />
                  <Stack.Screen name="recipes/[id]/index" options={tier === 'expanded' ? { ...presentation.stack, animation: 'none' } : presentation.stack} />
                  <Stack.Screen name="recipes/[id]/cook" options={presentation.fullScreen} />
                  <Stack.Screen name="recipes/[id]/scale" options={presentation.sheet} />
                  <Stack.Screen name="recipes/[id]/convert" options={presentation.sheet} />
                  <Stack.Screen name="recipes/[id]/share" options={presentation.sheet} />
                  <Stack.Screen name="recipes/[id]/add-to-groceries" options={presentation.sheet} />
                  <Stack.Screen name="recipes/[id]/edit" options={card(presentation.fullScreen)} />
                  <Stack.Screen name="recipes/[id]/settings" options={presentation.stack} />
                  <Stack.Screen name="calendar/new" options={presentation.sheet} />
                  <Stack.Screen name="calendar/[id]/index" options={card(presentation.stack)} />
                  <Stack.Screen name="calendar/[id]/edit" options={presentation.sheet} />
                  <Stack.Screen name="calendar/[id]/share" options={presentation.sheet} />
                  <Stack.Screen name="reminders/index" options={railPage} />
                  <Stack.Screen name="reminders/new" options={presentation.sheet} />
                  <Stack.Screen name="reminders/[id]/edit" options={presentation.sheet} />
                  <Stack.Screen name="timers" options={railPage} />
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
                </NavigationTheme>
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
