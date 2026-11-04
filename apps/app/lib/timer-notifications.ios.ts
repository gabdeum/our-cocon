import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { strings } from '../strings/en';
import { readPrefs } from './notifications';
import { handleTimerAction } from './timer-alert-actions';
import { createTimerAlerts, devLog, TIMER_CATEGORY, TIMER_SOUND, TIMER_THREAD, type LocalNotifications } from './timer-alerts';
import { tracker } from './tracker';

/**
 * Spec 047 on the iPhone: local notifications at `endsAt`, through expo-notifications (its native
 * code is only in builds; the sound is bundled by its config plugin in app.json).
 */
const ignore = () => undefined;

const logged = (e: unknown) => devLog(e instanceof Error ? e.message : String(e));

const local: LocalNotifications = {
  async scheduleAt(id, at, { title, body }, data) {
    await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: {
        title,
        body,
        data,
        sound: TIMER_SOUND,
        interruptionLevel: 'timeSensitive',
        threadIdentifier: TIMER_THREAD,
        categoryIdentifier: TIMER_CATEGORY,
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
    });
  },
  async remove(ids) {
    await Promise.all(
      ids.flatMap((id) => [
        Notifications.cancelScheduledNotificationAsync(id).catch(logged),
        Notifications.dismissNotificationAsync(id).catch(logged),
      ]),
    );
  },
  async ids() {
    const [waiting, shown] = await Promise.all([
      Notifications.getAllScheduledNotificationsAsync(),
      Notifications.getPresentedNotificationsAsync(),
    ]);
    return [...new Set([...waiting.map((r) => r.identifier), ...shown.map((n) => n.request.identifier)])];
  },
};

export const timerNotifications: LocalNotifications | null = local;

/** For a "+1 min" handled while no timer store is running: the same switches the app would use. */
async function alertsFor(userId: string) {
  const [permission, prefs] = await Promise.all([Notifications.getPermissionsAsync(), readPrefs(AsyncStorage, userId)]);
  const allowed = permission.granted || permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  return createTimerAlerts({ local, userId, storage: AsyncStorage, tracker, enabled: allowed && prefs.timers_alert });
}

// FR-003: the long-press actions. They open the app: expo-notifications tells iOS the tap is handled
// before the app's code has run, so in the background iOS may pause the app first, and a "+1 min" would
// only happen whenever it's next opened. Opened, it happens at once (spec 047 Changelog).
void Notifications.setNotificationCategoryAsync(TIMER_CATEGORY, [
  { identifier: 'add_minute', buttonTitle: strings.notifications.timerDone.addMinute, options: { opensAppToForeground: true } },
  { identifier: 'stop', buttonTitle: strings.notifications.timerDone.stop, options: { isDestructive: true, opensAppToForeground: true } },
]).catch(ignore);

// Listened for as soon as the app's code loads: iOS wakes the app in the background for the action and
// hands it over here, before any screen exists. The same notification id comes back after "+1 min",
// so each tap is told apart by its delivery time too.
const handled = new Set<string>();
function respond(response: Notifications.NotificationResponse) {
  if (response.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) return false;
  const { request, date } = response.notification;
  const key = `${request.identifier}|${response.actionIdentifier}|${date}`;
  if (handled.has(key)) return false;
  handled.add(key);
  const trigger = request.trigger as { type?: string } | null;
  void handleTimerAction(
    { actionIdentifier: response.actionIdentifier, categoryIdentifier: request.content.categoryIdentifier, fromPush: trigger?.type === 'push', data: request.content.data },
    { storage: AsyncStorage, tracker, alertsFor },
  ).catch(ignore);
  return true;
}
Notifications.addNotificationResponseReceivedListener(respond);
void Notifications.getLastNotificationResponseAsync()
  .then((r) => {
    // Only an action is cleared: a plain tap stays for spec 046's opening of Timers.
    if (r && respond(r)) Notifications.clearLastNotificationResponse();
  })
  .catch(ignore);
