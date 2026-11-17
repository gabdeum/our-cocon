import { MAX_RANGE_DAYS, addDays, daysInMonth, expand, makeDate, parts, timeIn, todayIn, zonedInstant, type CalendarEvent } from '@cocon/calendar';
import type { ParsedReminderDraft, Recurrence, ReminderOccurrenceStatus, ReminderRollover, ReminderSnoozeOption } from '@cocon/schemas';

// Spec 056: how a reminder moves. Repeats come from `@cocon/calendar`'s `expand`, so "every 2
// weeks", "after 5 times" and the 31st of the month work as they do for events. Times are
// instants (ISO strings, as the database gives them); dates and wall-clock times are in the
// family's home time zone. What depends on the time now for showing a reminder (late, sections,
// Home) is in the database (supabase/migrations/*_reminders.sql), so it's the same everywhere.

/** Why a rule refused. Callers show their own copy. */
export type ReminderErrorCode = 'NoDate' | 'NeedsTime' | 'NotInFuture';

export class ReminderError extends Error {
  override readonly name = 'ReminderError';

  constructor(
    readonly code: ReminderErrorCode,
    message: string,
  ) {
    super(message);
  }
}

/** What the rules need of a stored reminder. */
export interface ReminderTiming {
  due_at: string;
  has_time: boolean;
  repeat_rule: Recurrence | null;
  /** The repeat's first date (the series' start, for "every 2 weeks" and "after N times"). */
  repeat_from: string | null;
  snoozed_until: string | null;
}

/** The columns a draft sets (FR-001). */
export interface ReminderFields {
  title: string;
  notes: string | null;
  assignee_id: string | null;
  due_at: string;
  has_time: boolean;
  repeat_rule: Recurrence | null;
  repeat_from: string | null;
  next_due_at: string | null;
  rollover: ReminderRollover;
}

/** A Done or a catch-up, as `reminder_apply` saves it. */
export interface ReminderChange {
  /** Where the reminder was: the save does nothing if someone moved it since. */
  from_due_at: string;
  closed: { due_at: string; status: ReminderOccurrenceStatus }[];
  due_at: string;
  next_due_at: string | null;
  snoozed_until: string | null;
  /** Sets `completed_at`: a one-off ticked, or the last date of a repeat. */
  complete: boolean;
}

/** The Undo of a Done, as `reminder_revert` saves it. */
export interface ReminderRevert {
  from_due_at: string;
  reopen: string[];
  due_at: string;
  next_due_at: string | null;
  snoozed_until: string | null;
}

const HOUR = 3_600_000;
const MIDNIGHT = '00:00';
/** How far ahead to look for a repeat's next date: a Feb 29 birthday comes round within 8 years. */
const LOOK_AHEAD_WINDOWS = 3;

/** FR-008: the default when it isn't chosen, and "Every hour" without a time becomes "Next day". */
export function rolloverFor(hasTime: boolean, rollover?: ReminderRollover): ReminderRollover {
  if (!rollover) return hasTime ? 'hour' : 'day';
  return rollover === 'hour' && !hasTime ? 'day' : rollover;
}

function iso(d: Date): string {
  return d.toISOString();
}

/** The local date and wall-clock time of an instant. */
function local(instant: string | Date, tz: string): { date: string; time: string } {
  const at = typeof instant === 'string' ? new Date(instant) : instant;
  return { date: todayIn(tz, at), time: timeIn(tz, at) };
}

/** The instant a reminder is due on `date`: its time, or 00:00 for "any time". */
function dueOn(date: string, time: string | null, tz: string): string {
  return iso(zonedInstant(date, time ?? MIDNIGHT, tz));
}

function series(rule: Recurrence, from: string): CalendarEvent {
  return {
    id: 'reminder',
    title: 'reminder',
    starts_on: from,
    ends_on: from,
    time_type: 'all_day',
    slots: [],
    recurrence: rule,
    members: [],
    visibility: 'family',
    creator_member_id: 'reminder',
  };
}

/** A repeat's dates from `from` to `to` (inclusive), in order. */
function datesBetween(rule: Recurrence, start: string, from: string, to: string): string[] {
  const out: string[] = [];
  for (let at = from; at <= to; at = addDays(at, MAX_RANGE_DAYS + 1)) {
    const end = addDays(at, MAX_RANGE_DAYS) < to ? addDays(at, MAX_RANGE_DAYS) : to;
    out.push(...expand(series(rule, start), at, end).map((o) => o.starts_on));
  }
  return out;
}

/** The repeat's first date on or after `from`, or null when it has ended. */
function firstDateFrom(rule: Recurrence, start: string, from: string): string | null {
  for (let i = 0; i < LOOK_AHEAD_WINDOWS; i++) {
    const at = addDays(from, i * (MAX_RANGE_DAYS + 1));
    const [first] = expand(series(rule, start), at, addDays(at, MAX_RANGE_DAYS));
    if (first) return first.starts_on;
  }
  return null;
}

/** The wall-clock time a reminder is due at, or null for "any time". */
function wallTime(r: Pick<ReminderTiming, 'due_at' | 'has_time'>, tz: string): string | null {
  return r.has_time ? local(r.due_at, tz).time : null;
}

/** The next scheduled time strictly after the occurrence due at `dueAt`, or null (FR-004). */
export function nextDueAfter(r: ReminderTiming, dueAt: string, tz: string): string | null {
  if (!r.repeat_rule || !r.repeat_from) return null;
  const date = firstDateFrom(r.repeat_rule, r.repeat_from, addDays(local(dueAt, tz).date, 1));
  return date ? dueOn(date, wallTime(r, tz), tz) : null;
}

/**
 * Spec 058 FR-003: the repeat's dates from `from` to `to` that come after the open one (and after
 * the day a snooze ends: those are skipped when it's over), for the calendar to draw. Never stored.
 */
export function repeatDatesBetween(r: ReminderTiming, from: string, to: string, tz: string): string[] {
  if (!r.repeat_rule || !r.repeat_from || to < from) return [];
  const due = local(r.due_at, tz).date;
  const back = r.snoozed_until ? local(r.snoozed_until, tz).date : due;
  const after = back > due ? back : due;
  const start = addDays(after, 1) > from ? addDays(after, 1) : from;
  return start > to ? [] : datesBetween(r.repeat_rule, r.repeat_from, start, to);
}

/**
 * A new or edited reminder's columns (FR-001). A repeating reminder is due on the repeat's first
 * date on or after the chosen day (a weekly Mon/Wed repeat chosen on a Tuesday starts Wednesday).
 * Throws `NoDate` when the repeat ends before then.
 */
export function draftToFields(draft: ParsedReminderDraft, tz: string): ReminderFields {
  const time = draft.time ?? null;
  const rule = draft.repeat ?? null;
  const date = rule ? firstDateFrom(rule, draft.due_date, draft.due_date) : draft.due_date;
  if (!date) throw new ReminderError('NoDate', 'The repeat ends before the reminder is due');
  const timing = { due_at: dueOn(date, time, tz), has_time: time !== null, repeat_rule: rule, repeat_from: rule ? draft.due_date : null, snoozed_until: null };
  return {
    title: draft.title,
    notes: draft.notes ?? null,
    assignee_id: !draft.assignee || draft.assignee === 'everyone' ? null : draft.assignee,
    ...timing,
    next_due_at: nextDueAfter(timing, timing.due_at, tz),
    rollover: rolloverFor(time !== null, draft.rollover),
  };
}

/**
 * A stored reminder as the draft that would save it (the edit sheet, spec 057): due on the day of
 * its open occurrence, so a repeating one keeps its schedule from there.
 */
export function toDraft(
  r: ReminderTiming & { title: string; notes: string | null; assignee_id: string | null; rollover: ReminderRollover },
  tz: string,
): ParsedReminderDraft {
  return {
    title: r.title,
    notes: r.notes,
    due_date: local(r.due_at, tz).date,
    time: wallTime(r, tz),
    repeat: r.repeat_rule,
    rollover: r.rollover,
    assignee: r.assignee_id ?? 'everyone',
  };
}

/**
 * FR-004 Done. A one-off is completed. A repeating one closes its occurrence as done and moves to
 * the next scheduled date after it (from the schedule, not from today), with its snooze cleared;
 * on the last date of its repeat, it's closed as done and completed. Run `catchUp` first, so `due_at` is current.
 */
export function complete(r: ReminderTiming, tz: string): ReminderChange {
  if (!r.repeat_rule) return { from_due_at: r.due_at, closed: [], due_at: r.due_at, next_due_at: null, snoozed_until: null, complete: true };
  const closed: ReminderChange['closed'] = [{ due_at: r.due_at, status: 'done' }];
  const next = nextDueAfter(r, r.due_at, tz);
  if (!next) return { from_due_at: r.due_at, closed, due_at: r.due_at, next_due_at: null, snoozed_until: null, complete: true };
  return {
    from_due_at: r.due_at,
    closed,
    due_at: next,
    next_due_at: nextDueAfter(r, next, tz),
    snoozed_until: null,
    complete: false,
  };
}

/** The Undo of a change (FR-004): the reminder back as `before` was, and its occurrences reopened. */
export function invert(change: ReminderChange, before: ReminderTiming & { next_due_at: string | null }): ReminderRevert {
  return {
    from_due_at: change.due_at,
    reopen: change.closed.map((c) => c.due_at),
    due_at: before.due_at,
    next_due_at: before.next_due_at,
    snoozed_until: before.snoozed_until,
  };
}

/**
 * FR-005 Missed and FR-007: each scheduled date that has come round closes the occurrence before
 * it: `missed`, or `skipped` when it was snoozed past that date. The reminder moves to the latest
 * date that has come, and its snooze ends once that date reaches it. Null when nothing is due.
 */
export function catchUp(r: ReminderTiming, now: Date, tz: string): ReminderChange | null {
  if (!r.repeat_rule || !r.repeat_from) return null;
  const time = wallTime(r, tz);
  const from = addDays(local(r.due_at, tz).date, 1);
  const to = addDays(local(now, tz).date, 1);
  const dates = from <= to ? datesBetween(r.repeat_rule, r.repeat_from, from, to).map((d) => dueOn(d, time, tz)) : [];
  const arrived = dates.filter((d) => new Date(d) <= now);
  if (arrived.length === 0) return null;
  const snooze = r.snoozed_until ? new Date(r.snoozed_until) : null;
  const closed: ReminderChange['closed'] = [];
  let open = r.due_at;
  for (const at of arrived) {
    closed.push({ due_at: open, status: snooze && snooze > new Date(at) ? 'skipped' : 'missed' });
    open = at;
  }
  const later = dates.find((d) => new Date(d) > now);
  return {
    from_due_at: r.due_at,
    closed,
    due_at: open,
    next_due_at: later ?? nextDueAfter(r, open, tz),
    snoozed_until: snooze && snooze > new Date(open) ? r.snoozed_until : null,
    complete: false,
  };
}

/** FR-007: the snooze choices that apply (In 1 hour only with a time), with when each ends. */
export function snoozeOptions(r: Pick<ReminderTiming, 'due_at' | 'has_time'>, now: Date, tz: string): { option: Exclude<ReminderSnoozeOption, 'date'>; until: string }[] {
  const options = (['hour', 'tomorrow', 'week', 'month'] as const).filter((o) => o !== 'hour' || r.has_time);
  return options.map((option) => ({ option, until: snoozeUntil(option, r, now, tz) }));
}

/**
 * FR-007: when a snooze ends. In 1 hour: an hour from now (only with a time). Tomorrow, Next week
 * (same weekday), Next month (same day, or the month's last) and a picked date: that day at the
 * reminder's time, or its start for "any time". Throws `NeedsTime`, or `NotInFuture` for a picked
 * day that's not after today.
 */
export function snoozeUntil(option: ReminderSnoozeOption, r: Pick<ReminderTiming, 'due_at' | 'has_time'>, now: Date, tz: string, picked?: string): string {
  const today = todayIn(tz, now);
  const time = wallTime(r, tz);
  switch (option) {
    case 'hour':
      if (!r.has_time) throw new ReminderError('NeedsTime', 'In 1 hour needs a reminder with a time');
      return iso(new Date(now.getTime() + HOUR));
    case 'tomorrow':
      return dueOn(addDays(today, 1), time, tz);
    case 'week':
      return dueOn(addDays(today, 7), time, tz);
    case 'month': {
      const { year, month, day } = parts(today);
      const y = month === 12 ? year + 1 : year;
      const m = month === 12 ? 1 : month + 1;
      return dueOn(makeDate(y, m, Math.min(day, daysInMonth(y, m))), time, tz);
    }
    case 'date':
      if (!picked || picked <= today) throw new ReminderError('NotInFuture', 'Pick a day after today');
      return dueOn(picked, time, tz);
  }
}
