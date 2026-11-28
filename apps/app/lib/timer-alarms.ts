import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import type { Tracker } from '@cocon/schemas';
import { strings } from '../strings';
import { alertId, TIMER_SOUND, type LocalNotifications } from './timer-alerts';

/**
 * Spec 061: on iOS 26, a timer's done alert is an AlarmKit alarm, which rings through silent mode and
 * Focus until "Stop" or "+1 min". It takes the place of spec 047's notification once alarms are
 * allowed; before that, or on older iPhones, the notification stays. The phone's side is the app's own
 * module (modules/live-timer, targets/timer-activity/_shared/TimerAlarms.swift).
 */
export type AlarmPermission = 'authorized' | 'denied' | 'notDetermined';

/** The phone's alarms, so tests can fake them. None on the web or before iOS 26. */
export interface TimerAlarmsNative {
  permission(): AlarmPermission;
  /** iOS's own question, with app.json's NSAlarmKitUsageDescription. */
  request(): Promise<AlarmPermission>;
  /** One timer's alarm (by alert id), replacing any it had. False if iOS refused it. */
  schedule(alarm: TimerAlarm, at: number): Promise<boolean>;
  /** Waiting or ringing. Applied in order with the calls before it. */
  cancel(alertIds: readonly string[]): Promise<void>;
  /** The alert ids of the alarms still waiting or ringing. */
  ids(): Promise<string[]>;
  /** Sign-out or another person: every alarm goes, and a "+1 min" tap under way can't set one again. */
  clear(): Promise<void>;
}

/** What the alarm shows and whose it is: the same shape as TimerAlarm in TimerAlarms.swift. */
export interface TimerAlarm {
  alertId: string;
  timerId: string;
  owner: string;
  title: string;
  subtitle: string;
  sound: string;
  addMinute: string;
  stop: string;
}

/**
 * Spec 047's notifications, with each timer's alert as an alarm instead (`createTimerAlerts` with
 * `alarms`, which asks for no follow-up). Removing covers both. Listing gives the alarms, and removes
 * any timer notification left from before alarms were allowed: the check it is part of then sets
 * running timers' alarms in their place (a timer started just before iOS's question gets one too).
 */
export function alarmNotifications(notifications: LocalNotifications, alarms: TimerAlarmsNative): LocalNotifications {
  return {
    async scheduleAt(id, at, { title, body }, data) {
      // Only alerts are asked for in alarm mode; a follow-up never is.
      if (id !== alertId(data.timerId)) return;
      const copy = strings.notifications.timerDone;
      const alarm: TimerAlarm = { alertId: id, timerId: data.timerId, owner: data.userId, title, subtitle: body, sound: TIMER_SOUND, addMinute: copy.addMinute, stop: copy.stop };
      if (!(await alarms.schedule(alarm, at))) throw new Error('alarm refused');
    },
    async remove(ids) {
      await Promise.all([alarms.cancel(ids), notifications.remove(ids)]);
    },
    async ids() {
      const left = (await notifications.ids()).filter((id) => id.startsWith('timer:'));
      if (left.length) await notifications.remove(left);
      return alarms.ids();
    },
  };
}

/** Removing and listing cover alarms too (sign-out, a switch turned off): for when alarms aren't in use. */
export function withAlarmCleanup(notifications: LocalNotifications, alarms: TimerAlarmsNative): LocalNotifications {
  return {
    scheduleAt: notifications.scheduleAt,
    remove: async (ids) => void (await Promise.all([alarms.cancel(ids), notifications.remove(ids)])),
    async ids() {
      const [rung, shown] = await Promise.all([alarms.ids(), notifications.ids()]);
      return [...new Set([...rung, ...shown])];
    },
  };
}

/**
 * This phone's answer for alarms (null: no alarms here), read again when the app comes back (it can
 * change in iPhone Settings), and iOS's question, asked once: on the first timer started (FR-002).
 */
export function useAlarmPermission(native: TimerAlarmsNative | null, tracker: Tracker): { permission: AlarmPermission | null; request: () => Promise<AlarmPermission> } {
  const [permission, setPermission] = useState<AlarmPermission | null>(() => native?.permission() ?? null);
  useEffect(() => {
    if (!native) return;
    const sub = AppState.addEventListener('change', (s) => s === 'active' && setPermission(native.permission()));
    return () => sub.remove();
  }, [native]);
  const request = useCallback(async () => {
    if (!native) return 'denied' as const;
    const answer = await native.request().catch(() => 'denied' as const);
    setPermission(answer);
    tracker.track('timer_alarms_permission_result', { granted: answer === 'authorized' });
    return answer;
  }, [native, tracker]);
  return { permission, request };
}
