import { z } from 'zod';

/** Spec 046 FR-003: the switches kept per phone (`push_devices.prefs`, and on the phone itself). */
export const NotificationPrefs = z.strictObject({
  timers_live: z.boolean(),
  timers_alert: z.boolean(),
  reminders_on: z.boolean(),
  reminders_scope: z.enum(['mine', 'all']),
});
export type NotificationPrefs = z.infer<typeof NotificationPrefs>;
/**
 * What `push_devices.prefs` holds: the switches, plus whether the phone's clock is 24-hour (spec
 * 049 FR-004: a reminder's time follows an "Automatic" time format). Any key may be missing.
 */
export const PushDevicePrefs = NotificationPrefs.extend({ clock_24h: z.boolean() }).partial();
export type PushDevicePrefs = z.infer<typeof PushDevicePrefs>;
export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  timers_live: true,
  timers_alert: true,
  reminders_on: true,
  reminders_scope: 'mine',
};

export const NotificationKind = z.enum(['timer_done', 'reminder']);
export type NotificationKind = z.infer<typeof NotificationKind>;

/**
 * FR-006: where tapping a notification goes. Only Timers and one event's occurrence: a payload is
 * never trusted to open anything else in the app.
 */
export const NotificationRoute = z
  .string()
  .regex(/^(\/timers|\/calendar\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\?date=\d{4}-\d{2}-\d{2})$/);

/** FR-006: the `data` every Our Cocon notification carries. */
export const PushPayload = z.object({ kind: NotificationKind, route: NotificationRoute });
export type PushPayload = z.infer<typeof PushPayload>;

/** FR-004: an Expo push token, as `push_devices` checks it. */
export const ExpoPushToken = z.string().regex(/^Expo(nent)?PushToken\[[A-Za-z0-9_-]{8,128}\]$/);
