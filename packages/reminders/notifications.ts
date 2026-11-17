import { addDays, dateLabel, daysBetween, formatTime, timeIn, todayIn, zonedInstant } from '@cocon/calendar';
import type { QuietHours, ReminderNotificationKind, ReminderRollover } from '@cocon/schemas';
import { en } from './words.en';

// Spec 059: when a reminder (a thing to do) notifies whom, and with what words. The notifier calls
// these every minute with each open reminder as the database places it (`_reminder_state`), so a
// Done, a snooze, a delete or a new assignee simply changes what comes out next (FR-005). Times are
// instants; wall-clock times and quiet hours are in the family's home time zone.

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
/** A send up to 10 minutes late still goes (a slow tick, a restart); older ones are left. */
export const LATE_MS = 10 * MINUTE;
/** FR-001: untimed reminders, and the daily and weekly nudges, at 09:00. */
export const MORNING = '09:00';

/** What the rules need of an open reminder, as `_reminder_state` gives it. */
export interface NotifiedReminder {
  id: string;
  title: string;
  /** Null: Everyone. */
  assignee_id: string | null;
  has_time: boolean;
  rollover: ReminderRollover;
  /** 056 FR-006: when it's due, or back from a snooze. */
  late_from: string;
  /** Snoozed by hand, or a late "Next week" one resting until its weekday (spec 058). */
  snoozed: boolean;
  created_at: string;
}

export interface TodoMember {
  id: string;
  display_name: string;
  /** Null: a member without the app (spec 033). */
  user_id: string | null;
}

export interface TodoRecipient {
  memberId: string;
  /** "for {name}" in the body; null when they're the only one it's for. */
  forName: string | null;
}

export interface ReminderSend {
  kind: ReminderNotificationKind;
  /** When it's sent: its time, or the end of the recipient's quiet hours. */
  slotAt: string;
}

const RANK: Record<ReminderNotificationKind, number> = { before: 0, due: 1, nudge: 2 };

/**
 * FR-003: the assignee only; Everyone → every member with the app; a member without the app →
 * everyone with the app (as event reminders). Names only when the recipient isn't the only one on it.
 */
export function todoRecipients(r: Pick<NotifiedReminder, 'assignee_id'>, members: readonly TodoMember[]): TodoRecipient[] {
  const assignee = members.find((m) => m.id === r.assignee_id);
  if (assignee?.user_id) return [{ memberId: assignee.id, forName: null }];
  const withApp = members.filter((m) => m.user_id !== null);
  const forName = withApp.length === 1 && !assignee ? null : (assignee?.display_name ?? en.everyone);
  return withApp.map((m) => ({ memberId: m.id, forName }));
}

/** FR-002: the end of the quiet hours `at` falls in, or null when it's outside them (or there are none). */
export function quietEnd(at: Date, quiet: QuietHours, tz: string): Date | null {
  if (quiet.from === quiet.to) return null;
  const time = timeIn(tz, at);
  const day = todayIn(tz, at);
  if (quiet.from < quiet.to) return time >= quiet.from && time < quiet.to ? zonedInstant(day, quiet.to, tz) : null;
  if (time >= quiet.from) return zonedInstant(addDays(day, 1), quiet.to, tz);
  return time < quiet.to ? zonedInstant(day, quiet.to, tz) : null;
}

/**
 * FR-001: every moment the reminder notifies, from `from` up to `to`, before quiet hours: 1 hour
 * before and at its time (09:00 on the day without one), then while it's late, by rollover: every
 * hour on the hour, each morning at 09:00, or once a week on its weekday (at its time, or 09:00).
 */
export function reminderSlots(r: Pick<NotifiedReminder, 'has_time' | 'rollover' | 'late_from'>, tz: string, from: Date, to: Date): { kind: ReminderNotificationKind; at: Date }[] {
  const lateFrom = new Date(r.late_from);
  const dueDay = todayIn(tz, lateFrom);
  const morning = zonedInstant(dueDay, MORNING, tz);
  const due = r.has_time || morning < lateFrom ? lateFrom : morning;
  const slots: { kind: ReminderNotificationKind; at: Date }[] = [];
  if (r.has_time) slots.push({ kind: 'before', at: new Date(due.getTime() - HOUR) });
  slots.push({ kind: 'due', at: due });
  const nudge = (at: Date) => {
    if (at > due && at >= from && at <= to) slots.push({ kind: 'nudge', at });
  };
  if (r.rollover === 'hour' && r.has_time) {
    // On the hour in the home time zone, from the first one after it's due.
    const start = due > from ? due : from;
    let day = todayIn(tz, start);
    let hour = Number(timeIn(tz, start).slice(0, 2));
    let last = start;
    for (;;) {
      hour += 1;
      if (hour === 24) [day, hour] = [addDays(day, 1), 0];
      const at = zonedInstant(day, `${String(hour).padStart(2, '0')}:00`, tz);
      if (at > to) break;
      // An hour the clocks skip comes out as the one before it: once is enough.
      if (at > last) nudge(at);
      last = at > last ? at : last;
    }
  } else if (r.rollover !== 'none') {
    const step = r.rollover === 'week' ? 7 : 1;
    const at = r.rollover === 'week' && r.has_time ? timeIn(tz, due) : MORNING;
    const first = Math.max(step, Math.floor(daysBetween(dueDay, todayIn(tz, from)) / step) * step);
    for (let d = first; ; d += step) {
      const slot = zonedInstant(addDays(dueDay, d), at, tz);
      if (slot > to) break;
      nudge(slot);
    }
  }
  return slots.filter((s) => s.at >= from && s.at <= to);
}

/**
 * FR-001, FR-002, FR-005: what goes to one recipient at `now`: nothing while snoozed; nudges in quiet
 * hours dropped, with one at their end, and the 1-hour and on-time ones held to their end. Several
 * held to the same moment are one notification, the furthest along (a nudge, then on time, then
 * before). A moment before the reminder was added never notifies. At most one send per tick.
 */
export function reminderSendDue(r: NotifiedReminder, quiet: QuietHours, tz: string, now: Date): ReminderSend | null {
  if (r.snoozed) return null;
  // A quiet stretch is under a day, so anything held to now happened within the last day.
  const from = new Date(now.getTime() - LATE_MS - 24 * HOUR);
  const created = new Date(r.created_at);
  let best: { kind: ReminderNotificationKind; at: Date } | null = null;
  for (const s of reminderSlots(r, tz, from, now)) {
    if (s.at < created) continue;
    const at = quietEnd(s.at, quiet, tz) ?? s.at;
    // FR-006: at its time, never before.
    if (at > now || now.getTime() - at.getTime() > LATE_MS) continue;
    if (!best || at > best.at || (at.getTime() === best.at.getTime() && RANK[s.kind] > RANK[best.kind])) best = { kind: s.kind, at };
  }
  return best ? { kind: best.kind, slotAt: best.at.toISOString() } : null;
}

export interface TodoTextOptions {
  use24h: boolean;
  tz: string;
  forName: string | null;
}

/** FR-001: the title and body, in the recipient's clock (12- or 24-hour). */
export function reminderNotificationText(
  r: Pick<NotifiedReminder, 'title' | 'has_time' | 'rollover' | 'late_from'>,
  send: ReminderSend,
  { use24h, tz, forName }: TodoTextOptions,
): { title: string; body: string } {
  const lateFrom = new Date(r.late_from);
  const time = formatTime(timeIn(tz, lateFrom), use24h);
  const withName = (body: string) => (forName ? `${body} · ${en.forName(forName)}` : body);
  if (send.kind === 'before') return { title: en.before(r.title), body: withName(en.dueAt(time)) };
  if (send.kind === 'due') {
    if (!r.has_time) return { title: en.dueDay(r.title), body: withName(en.dueToday) };
    return { title: en.dueTimed(r.title), body: r.rollover === 'hour' ? en.everyHour : withName(en.dueNow) };
  }
  const late = new Date(send.slotAt).getTime() - lateFrom.getTime();
  if (r.has_time && late < 24 * HOUR) return { title: en.nudge(r.title), body: withName(en.hoursLate(time, Math.max(1, Math.floor(late / HOUR)))) };
  const dueDay = todayIn(tz, lateFrom);
  const day = daysBetween(dueDay, todayIn(tz, new Date(send.slotAt))) === 1 ? en.yesterday : dateLabel(dueDay);
  return { title: en.nudge(r.title), body: withName(en.wasDue(day)) };
}
