import { CalendarDate, EventOverride, Recurrence, type RecurrenceEnds } from '@cocon/schemas/calendar';
import { addDays, daysBetween, daysInMonth, makeDate, parts, weekday } from './dates';
import { CalendarError } from './errors';
import { timeRange, toMinutes } from './slots';
import type { CalendarEvent, EventException, Occurrence } from './types';

/** The longest range one `expand` call returns (the month view and assistants ask for less). */
export const MAX_RANGE_DAYS = 3 * 366;
/** How far after the range a moved occurrence's series date may be. */
const MAX_MOVE_DAYS = 366;
/** Candidate dates a series may try before giving up (a daily repeat over 270 years). */
const MAX_CANDIDATES = 100_000;
/** The fields a "this event only" change may replace; anything else in the jsonb is ignored. */
const OVERRIDE_KEYS = Object.keys(EventOverride.shape) as (keyof EventOverride)[];

function assertDate(date: string, what: string): void {
  if (!CalendarDate.safeParse(date).success) throw new CalendarError('InvalidDate', `${what} is not a date: ${date}`);
}

/** Throws `InvalidDate`, `EndBeforeStart` or `InvalidRecurrence` for an event the engine can't place. */
export function assertValidEvent(event: CalendarEvent): void {
  assertDate(event.starts_on, 'Start');
  assertDate(event.ends_on, 'End');
  if (event.ends_on < event.starts_on) throw new CalendarError('EndBeforeStart', `Ends ${event.ends_on} before it starts ${event.starts_on}`);
  const range = timeRange(event);
  if (range && event.starts_on === event.ends_on && toMinutes(range.end) <= toMinutes(range.start)) {
    throw new CalendarError('EndBeforeStart', `Ends at ${range.end}, not after ${range.start}`);
  }
  if (!event.recurrence) return;
  const parsed = Recurrence.safeParse(event.recurrence);
  if (!parsed.success) throw new CalendarError('InvalidRecurrence', parsed.error.issues.map((i) => i.message).join('; '));
  const { ends } = parsed.data;
  if (ends.type === 'on' && ends.date < event.starts_on) throw new CalendarError('InvalidRecurrence', `Repeat ends ${ends.date} before ${event.starts_on}`);
}

/**
 * The series dates in order, from the first one, until `limit` (inclusive). Stops early at the
 * repeat's end date or count. Months without the start's date are skipped (the 31st, Feb 29).
 */
function* seriesDates(event: CalendarEvent, limit: string): Generator<string> {
  const rule = event.recurrence;
  if (!rule) {
    yield event.starts_on;
    return;
  }
  const until = rule.ends.type === 'on' && rule.ends.date < limit ? rule.ends.date : limit;
  const max = rule.ends.type === 'after' ? rule.ends.count : Infinity;
  let count = 0;
  let tried = 0;
  for (const date of candidates(event.starts_on, rule)) {
    if (date > until || count >= max) return;
    if (++tried > MAX_CANDIDATES) throw new CalendarError('InvalidRecurrence', 'The repeat runs too far to expand');
    count += 1;
    yield date;
  }
}

function* candidates(start: string, rule: Recurrence): Generator<string> {
  const { year, month, day } = parts(start);
  switch (rule.freq) {
    case 'daily':
      for (let i = 0; ; i++) yield addDays(start, i);
    case 'weekly':
    case 'biweekly': {
      // Weeks count from the Sunday of the start's week, the same on every device.
      const days = [...new Set(rule.weekdays ?? [weekday(start)])].sort((a, b) => a - b);
      const sunday = addDays(start, -weekday(start));
      const step = rule.freq === 'weekly' ? 7 : 14;
      for (let week = 0; ; week += step) {
        for (const d of days) {
          const date = addDays(sunday, week + d);
          if (date >= start) yield date;
        }
      }
    }
    case 'monthly':
    case 'yearly': {
      const step = rule.freq === 'monthly' ? 1 : 12;
      for (let i = 0; ; i += step) {
        const y = year + Math.floor((month - 1 + i) / 12);
        const m = ((month - 1 + i) % 12) + 1;
        if (day <= daysInMonth(y, m)) yield makeDate(y, m, day);
      }
    }
  }
}

/**
 * FR-004: the occurrences of `event` that touch the days `from`–`to` (inclusive), sorted by day.
 * A multi-day event keeps its length and is returned while any of its days is in range.
 * Exceptions ("this event only") cancel an occurrence or replace some of its fields; a moved
 * occurrence shows on its new day even when its series date is outside the range.
 */
export function expand(event: CalendarEvent, from: string, to: string, exceptions: readonly EventException[] = []): Occurrence[] {
  assertValidEvent(event);
  assertDate(from, 'From');
  assertDate(to, 'To');
  if (daysBetween(from, to) > MAX_RANGE_DAYS) throw new CalendarError('InvalidDate', `Ask for at most ${MAX_RANGE_DAYS} days at a time`);
  const span = daysBetween(event.starts_on, event.ends_on);
  // Exceptions outside the series or far after the range can't matter; skipping them keeps a bad row cheap.
  const latest = addDays(to, MAX_MOVE_DAYS);
  const useful = exceptions.filter((e) => CalendarDate.safeParse(e.occurrence_date).success && e.occurrence_date >= event.starts_on && e.occurrence_date <= latest);
  const byDate = new Map(useful.map((e) => [e.occurrence_date, e]));
  const limit = useful.reduce((last, e) => (e.occurrence_date > last ? e.occurrence_date : last), to);
  const result: Occurrence[] = [];
  for (const date of seriesDates(event, limit)) {
    const exception = byDate.get(date);
    if (exception?.cancelled) continue;
    let occurrence: Occurrence = { ...event, starts_on: date, ends_on: addDays(date, span), occurrence_date: date, is_exception: false };
    if (exception?.override) {
      const override = exception.override as Record<string, unknown>;
      const patch = Object.fromEntries(OVERRIDE_KEYS.filter((key) => key in override).map((key) => [key, override[key]])) as EventOverride;
      const moved = patch.starts_on && CalendarDate.safeParse(patch.starts_on).success ? patch.starts_on : date;
      occurrence = { ...occurrence, ends_on: addDays(moved, span), ...patch, starts_on: moved, is_exception: true };
    }
    if (occurrence.starts_on <= to && occurrence.ends_on >= from) result.push(occurrence);
  }
  return result.sort((a, b) => (a.starts_on === b.starts_on ? 0 : a.starts_on < b.starts_on ? -1 : 1));
}

/**
 * Spec 042: the occurrence whose series date is `date` (an event page's `?date=`), wherever a
 * "this event only" change moved it. Null when `date` isn't one of the event's dates or is
 * cancelled. Throws like `expand` for an event the engine can't place.
 */
export function occurrenceOn(event: CalendarEvent, date: string, exceptions: readonly EventException[] = []): Occurrence | null {
  assertDate(date, 'Date');
  const exception = exceptions.find((e) => e.occurrence_date === date);
  const moved = (exception?.override as Record<string, unknown> | null | undefined)?.starts_on;
  const to = typeof moved === 'string' && CalendarDate.safeParse(moved).success ? moved : date;
  const [from, until] = to < date ? [to, date] : [date, to];
  return expand(event, from, until, exception ? [exception] : []).find((o) => o.occurrence_date === date) ?? null;
}

/**
 * Spec 041 "All future events" from the series date `from`: the old series now ends the day
 * before (`before`), and the new one keeps what's left of the end (`ends`: the same date, or the
 * count minus the times already gone). Null when `from` is the first date: edit the whole series.
 * Throws `InvalidDate` when `from` isn't one of the series' dates.
 */
export function splitSeries(event: CalendarEvent, from: string): { before: Recurrence; ends: RecurrenceEnds } | null {
  assertValidEvent(event);
  const rule = event.recurrence;
  if (!rule) throw new CalendarError('InvalidRecurrence', 'Only a repeating event can be split');
  assertDate(from, 'Split');
  let gone = 0;
  let found = false;
  for (const date of seriesDates(event, from)) {
    if (date === from) found = true;
    else gone += 1;
  }
  if (!found) throw new CalendarError('InvalidDate', `${from} is not one of this event's dates`);
  if (gone === 0) return null;
  const ends: RecurrenceEnds = rule.ends.type === 'after' ? { type: 'after', count: rule.ends.count - gone } : rule.ends;
  return { before: { ...rule, ends: { type: 'on', date: addDays(from, -1) } }, ends };
}
