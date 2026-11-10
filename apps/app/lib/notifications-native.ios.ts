import { Linking } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { type NativeNotifications, type PermissionStatus, type ShownNotification } from './notifications';
import { TimerAlertData, timerOwnerNow } from './timer-alerts';
import { timersOnScreen } from './timer-store';

/**
 * Spec 046 on the iPhone, through expo-notifications. Its native code is only in builds: Expo Go
 * can't run it (constitution I), so `pnpm dev:phone` needs the development build.
 */
const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;

function statusOf(p: Notifications.NotificationPermissionsStatus): PermissionStatus {
  if (p.granted || p.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) return 'granted';
  return p.status === 'denied' ? 'denied' : 'undetermined';
}

// FR-006: while the app is open no system banner shows. Timers have their in-app alert (spec 010),
// unless the app was asleep until a moment ago and won't play it, or it's the follow-up: then the
// phone's shows (spec 047).
// Reminders reach the listener below, which shows a StatusBanner with the same text.
const foreground = new Set<(n: ShownNotification) => void>();
Notifications.setNotificationHandler({
  handleNotification: async (n) => {
    const { title, body, data } = n.request.content;
    // A follow-up means nobody acted on the alert (US3): it shows wherever the app is. Only alerts this
    // phone scheduled, for whoever is signed in now (security review).
    const followUp = n.request.identifier.endsWith(':again');
    const local = (n.request.trigger as { type?: string } | null)?.type !== 'push';
    const mine = TimerAlertData.safeParse(data);
    if (local && mine.success && mine.data.userId === timerOwnerNow() && (followUp || !timersOnScreen())) {
      return { shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false };
    }
    for (const listener of foreground) listener({ title: title ?? '', body: body ?? '', data });
    return { shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false, shouldSetBadge: false };
  },
});

// Each tap is reported once, even when the launch response is also delivered to the listener. A timer's
// alert keeps its id after "+1 min" (spec 047), so its delivery time tells two taps apart.
const handled = new Set<string>();

// Every token request registers with Apple again, and iOS reports the token again (expo-notifications
// sends it as a token event): reacting to the same token re-registered in a loop, thousands of
// requests a second. Only a token unlike the last one counts as a change. While this app is asking for
// it, a report may be that answer arriving early: it's kept and compared with the answer afterwards, so
// a real change during the request still re-registers.
let lastDeviceToken: string | null = null;
let asking = 0;
let reportedWhileAsking: string | null = null;
const tokenListeners = new Set<() => void>();
let tokenSub: { remove: () => void } | null = null;

function tokenReported(token: string) {
  if (asking > 0) {
    reportedWhileAsking = token;
    return;
  }
  if (token === lastDeviceToken) return;
  lastDeviceToken = token;
  for (const listener of tokenListeners) listener();
}

export const nativeNotifications: NativeNotifications | null = {
  permission: async () => statusOf(await Notifications.getPermissionsAsync()),
  request: async () => statusOf(await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: false } })),
  async pushToken() {
    if (!Device.isDevice || !projectId) return null;
    asking += 1;
    try {
      const devicePushToken = await Notifications.getDevicePushTokenAsync();
      lastDeviceToken = String(devicePushToken.data);
      return (await Notifications.getExpoPushTokenAsync({ projectId, devicePushToken })).data;
    } catch {
      return null;
    } finally {
      asking -= 1;
      const reported = reportedWhileAsking;
      if (asking === 0 && reported !== null) {
        reportedWhileAsking = null;
        tokenReported(reported);
      }
    }
  },
  onTokenChange(listener) {
    tokenListeners.add(listener);
    tokenSub ??= Notifications.addPushTokenListener(({ data }) => tokenReported(String(data)));
    return () => {
      tokenListeners.delete(listener);
      if (tokenListeners.size > 0) return;
      tokenSub?.remove();
      tokenSub = null;
    };
  },
  onForeground(listener) {
    foreground.add(listener);
    return () => foreground.delete(listener);
  },
  onOpen(listener) {
    const report = (response: Notifications.NotificationResponse, coldStart: boolean) => {
      if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
      const id = `${response.notification.request.identifier}|${response.notification.date}`;
      if (handled.has(id)) return;
      handled.add(id);
      listener(response.notification.request.content.data, coldStart);
    };
    let live = true;
    void Notifications.getLastNotificationResponseAsync().then((r) => {
      if (live && r) report(r, true);
    });
    const sub = Notifications.addNotificationResponseReceivedListener((r) => report(r, false));
    return () => {
      live = false;
      sub.remove();
    };
  },
  unregister: () => Notifications.unregisterForNotificationsAsync(),
  openSettings: () => void Linking.openSettings(),
  appVersion: Constants.expoConfig?.version ?? '0.0.0',
};
