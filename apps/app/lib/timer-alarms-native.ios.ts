import { requireOptionalNativeModule } from 'expo';
import type { AlarmPermission, TimerAlarmsNative } from './timer-alarms';

/**
 * Spec 061 on the iPhone: AlarmKit through the app's own module (modules/live-timer). None before
 * iOS 26, or in a build made before 061 (a JS update reaching an older build): timers then alert with
 * notifications (spec 047), and nothing fails.
 */
interface AlarmModule {
  alarmsAvailable?(): boolean;
  alarmAuthorization(): string;
  requestAlarms(): Promise<string>;
  scheduleAlarm(json: string, at: number): Promise<boolean>;
  cancelAlarms(alertIds: string[]): Promise<void>;
  alarmIds(): Promise<string[]>;
  clearAlarms?(): Promise<void>;
}

const native = requireOptionalNativeModule<AlarmModule>('CoconLiveTimer');

const permissionOf = (s: string): AlarmPermission => (s === 'authorized' || s === 'notDetermined' ? s : 'denied');

export const timerAlarmsNative: TimerAlarmsNative | null =
  native?.alarmsAvailable?.() === true
    ? {
        permission: () => permissionOf(native.alarmAuthorization()),
        request: async () => permissionOf(await native.requestAlarms()),
        schedule: (alarm, at) => native.scheduleAlarm(JSON.stringify(alarm), at),
        cancel: (alertIds) => native.cancelAlarms([...alertIds]),
        ids: () => native.alarmIds(),
        clear: async () => native.clearAlarms?.(),
      }
    : null;
