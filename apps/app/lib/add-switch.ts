import type { SlotTimes } from '@cocon/calendar';
import type { EventMember } from '@cocon/schemas/calendar';
import { plusHour, shownTimes, type EventDraft } from './event-form';
import type { ReminderForm } from './reminders';

// The calendar's add sheet switches between "New event" and "New reminder" (AddSheet): what the two
// forms share goes across, so switching keeps what's typed.

export type AddKind = 'event' | 'reminder';

/** What both forms hold: the title, the day, a start time (null: all day / any time) and who it's for. */
export interface Shared {
  title: string;
  date: string;
  time: string | null;
  /** A member id, or `everyone`. */
  who: string;
}

/** An event's: its start (a slot's first hour), and one person, or Everyone when it's for several (or Others). */
export function sharedFromEvent(d: EventDraft, slotTimes: SlotTimes): Shared {
  const start = shownTimes(d.time, slotTimes).start;
  const one = d.who.length === 1 ? d.who[0] : undefined;
  return { title: d.title, date: d.date, time: start || null, who: one && one !== 'others' ? one : 'everyone' };
}

export const sharedFromReminder = (f: ReminderForm): Shared => ({ title: f.title, date: f.date, time: f.hasTime ? f.time : null, who: f.assignee });

/**
 * What changed since the form was last left: only that goes across, so a slot or several people
 * survive a trip to the reminder and back. The first switch takes everything.
 */
export function changedSince(now: Shared, before: Shared | null): Partial<Shared> {
  if (!before) return now;
  return Object.fromEntries((Object.keys(now) as (keyof Shared)[]).filter((k) => now[k] !== before[k]).map((k) => [k, now[k]]));
}

/** Into the event: a start becomes an hour from it, none All day (an event's title is at most 60). */
export function eventPatch(s: Partial<Shared>): Partial<EventDraft> {
  return {
    ...(s.title !== undefined ? { title: s.title.slice(0, 60) } : {}),
    ...(s.date !== undefined ? { date: s.date } : {}),
    ...(s.time !== undefined ? { time: s.time ? { kind: 'custom', start: s.time, end: plusHour(s.time) } : { kind: 'all_day' } } : {}),
    ...(s.who !== undefined ? { who: [s.who as EventMember] } : {}),
  };
}

/** Into the reminder: a start turns its time on, none leaves it any time. */
export function reminderPatch(s: Partial<Shared>): Partial<ReminderForm> {
  return {
    ...(s.title !== undefined ? { title: s.title } : {}),
    ...(s.date !== undefined ? { date: s.date } : {}),
    ...(s.time !== undefined ? (s.time ? { hasTime: true, time: s.time } : { hasTime: false }) : {}),
    ...(s.who !== undefined ? { assignee: s.who } : {}),
  };
}
