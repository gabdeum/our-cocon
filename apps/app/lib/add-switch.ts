import { weekday, type SlotTimes } from '@cocon/calendar';
import type { EventMember } from '@cocon/schemas/calendar';
import { plusHour, shownTimes, type EventDraft, type RepeatDraft } from './event-form';
import type { ReminderForm } from './reminders';

// The add and edit sheet switches between an event and a reminder (AddSheet): what the two forms
// share goes across, so switching keeps what's typed.

export type AddKind = 'event' | 'reminder';

type Repeat = Omit<RepeatDraft, 'date'>;
const NEVER: Repeat = { repeat: 'never', weekdays: [], ends: { type: 'never' } };

/**
 * What both forms hold: the title, the day, a start time (null: all day / any time), who it's for,
 * the repeat (as the event sheet holds it) and the notes.
 */
export interface Shared {
  title: string;
  date: string;
  time: string | null;
  /** A member id, or `everyone`. */
  who: string;
  repeat: Repeat;
  notes: string;
}

/** An event's: its start (a slot's first hour), and one person, or Everyone when it's for several (or Others). */
export function sharedFromEvent(d: EventDraft, slotTimes: SlotTimes, occurrenceOnly = false): Shared {
  const start = shownTimes(d.time, slotTimes).start;
  const one = d.who.length === 1 ? d.who[0] : undefined;
  return {
    title: d.title,
    date: d.date,
    time: start || null,
    who: one && one !== 'others' ? one : 'everyone',
    // One date of a repeating event moves on its own.
    repeat: occurrenceOnly ? NEVER : { repeat: d.repeat, weekdays: d.weekdays, ends: d.ends },
    notes: d.notes,
  };
}

/** A reminder's: Every day / week / month as the event sheet would hold them, Custom as it is. */
export function sharedFromReminder(f: ReminderForm): Shared {
  const repeat: Repeat =
    f.repeat === 'never' ? NEVER : f.repeat === 'custom' ? f.custom : { repeat: f.repeat, weekdays: f.repeat === 'weekly' ? [weekday(f.date)] : [], ends: { type: 'never' } };
  return { title: f.title, date: f.date, time: f.hasTime ? f.time : null, who: f.assignee, repeat, notes: f.notes };
}

const same = (a: Shared[keyof Shared], b: Shared[keyof Shared]) => (typeof a === 'object' && a !== null ? JSON.stringify(a) === JSON.stringify(b) : a === b);

/**
 * What changed since the form was last left: only that goes across, so a slot or several people
 * survive a trip to the reminder and back. The first switch takes everything.
 */
export function changedSince(now: Shared, before: Shared | null): Partial<Shared> {
  if (!before) return now;
  return Object.fromEntries((Object.keys(now) as (keyof Shared)[]).filter((k) => !same(now[k], before[k])).map((k) => [k, now[k]]));
}

/** Into the event: a start becomes an hour from it, none All day (an event's title is at most 60). */
export function eventPatch(s: Partial<Shared>): Partial<EventDraft> {
  return {
    ...(s.title !== undefined ? { title: s.title.slice(0, 60) } : {}),
    ...(s.date !== undefined ? { date: s.date } : {}),
    ...(s.time !== undefined ? { time: s.time ? { kind: 'custom', start: s.time, end: plusHour(s.time) } : { kind: 'all_day' } } : {}),
    ...(s.who !== undefined ? { who: [s.who as EventMember] } : {}),
    ...(s.repeat !== undefined ? { repeat: s.repeat.repeat, weekdays: s.repeat.weekdays, ends: s.repeat.ends } : {}),
    ...(s.notes !== undefined ? { notes: s.notes } : {}),
  };
}

/** A plain Every day / week / month reads as that pill; anything else (every 2 weeks, an end) is Custom. */
function reminderRepeat(r: Repeat, date: string): Pick<ReminderForm, 'repeat'> & Partial<Pick<ReminderForm, 'custom'>> {
  if (r.repeat === 'never') return { repeat: 'never' };
  const plain = r.ends.type === 'never' && (r.repeat === 'daily' || r.repeat === 'monthly' || (r.repeat === 'weekly' && (r.weekdays.length === 0 || (r.weekdays.length === 1 && r.weekdays[0] === weekday(date)))));
  return plain ? { repeat: r.repeat as 'daily' | 'weekly' | 'monthly' } : { repeat: 'custom', custom: r };
}

/** Into the reminder: a start turns its time on, none leaves it any time (its notes are at most 1000). */
export function reminderPatch(s: Partial<Shared>, date: string): Partial<ReminderForm> {
  return {
    ...(s.title !== undefined ? { title: s.title } : {}),
    ...(s.date !== undefined ? { date: s.date } : {}),
    ...(s.time !== undefined ? (s.time ? { hasTime: true, time: s.time } : { hasTime: false }) : {}),
    ...(s.who !== undefined ? { assignee: s.who } : {}),
    ...(s.repeat !== undefined ? reminderRepeat(s.repeat, s.date ?? date) : {}),
    ...(s.notes !== undefined ? { notes: s.notes.slice(0, 1000) } : {}),
  };
}
