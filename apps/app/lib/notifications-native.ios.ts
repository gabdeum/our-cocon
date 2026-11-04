import { Linking } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import type { NativeNotifications, PermissionStatus, ShownNotification } from './notifications';

/**
 * Spec 046 on the iPhone, through expo-notifications. Its native code is only in builds: Expo Go
 * can't run it (constitution I), so `pnpm dev:phone` needs the development build.
 */
const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;

function statusOf(p: Notifications.NotificationPermissionsStatus): PermissionStatus {
  if (p.granted || p.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) return 'granted';
  return p.status === 'denied' ? 'denied' : 'undetermined';
}

// FR-006: while the app is open no system banner shows. Timers have their in-app alert (spec 010);
// reminders reach the listener below, which shows a StatusBanner with the same text.
const foreground = new Set<(n: ShownNotification) => void>();
Notifications.setNotificationHandler({
  handleNotification: async (n) => {
    const { title, body, data } = n.request.content;
    for (const listener of foreground) listener({ title: title ?? '', body: body ?? '', data });
    return { shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false, shouldSetBadge: false };
  },
});

// Each tap is reported once, even when the launch response is also delivered to the listener. A timer's
// alert keeps its id after "+1 min" (spec 047), so its delivery time tells two taps apart.
const handled = new Set<string>();

export const nativeNotifications: NativeNotifications | null = {
  permission: async () => statusOf(await Notifications.getPermissionsAsync()),
  request: async () => statusOf(await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: false } })),
  async pushToken() {
    if (!Device.isDevice || !projectId) return null;
    try {
      return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    } catch {
      return null;
    }
  },
  onTokenChange(listener) {
    const sub = Notifications.addPushTokenListener(() => listener());
    return () => sub.remove();
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
