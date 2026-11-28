import { z } from 'zod';
import { AppLanguage } from './language';

/** Spec 046 FR-003: the switches kept per phone (`push_devices.prefs`, and on the phone itself). */
export const NotificationPrefs = z.strictObject({
  timers_live: z.boolean(),
  timers_alert: z.boolean(),
  reminders_on: z.boolean(),
  reminders_scope: z.enum(['mine', 'all']),
  /** Spec 059 FR-007: reminders (things to do) and their nudges on this phone. */
  todo_on: z.boolean(),
});
export type NotificationPrefs = z.infer<typeof NotificationPrefs>;
/**
 * What `push_devices.prefs` holds: the switches, plus whether the phone's clock is 24-hour (spec
 * 049 FR-004: a reminder's time follows an "Automatic" time format) and its language (spec 076).
 * Any key may be missing.
 */
export const PushDevicePrefs = NotificationPrefs.extend({ clock_24h: z.boolean(), lang: AppLanguage }).partial();
export type PushDevicePrefs = z.infer<typeof PushDevicePrefs>;
export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  timers_live: true,
  timers_alert: true,
  reminders_on: true,
  reminders_scope: 'mine',
  todo_on: true,
};

/** `reminder`: an event's (spec 049); `todo`: a reminder to do (spec 059). */
export const NotificationKind = z.enum(['timer_done', 'reminder', 'todo']);
export type NotificationKind = z.infer<typeof NotificationKind>;

/**
 * Spec 059 FR-004: the actions on a reminder's notification. "In 1 hour" only with a time. The
 * notifier names the category; the app registers both with their buttons.
 */
export const TODO_CATEGORY = { timed: 'todo_timed', untimed: 'todo' } as const;
export const TodoAction = z.enum(['done', 'hour', 'tomorrow']);
export type TodoAction = z.infer<typeof TodoAction>;

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

/**
 * FR-006: where tapping a notification goes. Only Timers, one event's occurrence and one reminder's
 * drawer (spec 059): a payload is never trusted to open anything else in the app.
 */
export const NotificationRoute = z.string().regex(new RegExp(`^(/timers|/calendar/${UUID}\\?date=\\d{4}-\\d{2}-\\d{2}|/reminders\\?open=${UUID})$`));

/**
 * FR-006: the `data` every Our Cocon notification carries. A reminder's (spec 059) also carries the
 * due time it was about, so a Lock Screen action on an old one never ticks a later date.
 */
export const PushPayload = z.object({ kind: NotificationKind, route: NotificationRoute, due_at: z.iso.datetime({ offset: true }).optional() });
export type PushPayload = z.infer<typeof PushPayload>;

/** FR-004: an Expo push token, as `push_devices` checks it. */
export const ExpoPushToken = z.string().regex(/^Expo(nent)?PushToken\[[A-Za-z0-9_-]{8,128}\]$/);
