import { addDays, dateLabel, placeLine, timeLabel, timeRange, toMinutes, type SlotTimes } from '@cocon/calendar';
import type { DayReminderItem, EventListItem } from '@cocon/ui';
import { dayOf, driverLine, hiddenFromLine, inAllDay, isBirthday, isNow } from './calendar-day';
import { eventLook, occurrenceKey, whoText, type MemberLook, type MonthOccurrence } from './calendar-month';
import { isTravel } from './calendar-travel';
import { compareDayRows, reminderOrder, type CalendarReminder } from './calendar-reminders';
import type { Member } from './session';
import { strings } from '../strings/en';

const a = strings.calendar.agenda;
const d = strings.calendar.day;

/** FR-001: the list loads 4 weeks at a time. */
export const AGENDA_PAGE_DAYS = 28;
/** With nothing in the weeks loaded, keep looking up to a year ahead before saying "Nothing planned yet". */
export const AGENDA_EMPTY_PAGES = 13;
/** The engine expands at most 3 × 366 days at once (`MAX_RANGE_DAYS`): 39 pages is 1,092 days. */
export const AGENDA_MAX_PAGES = 39;

/** The days `pages` pages cover from `anchor` (the day the list starts on). */
export function agendaWindow(anchor: string, pages: number): { from: string; to: string } {
  return { from: anchor, to: addDays(anchor, pages * AGENDA_PAGE_DAYS - 1) };
}

export interface AgendaContext {
  today: string;
  /** "HH:MM" now in the home time zone, for "Now". */
  now: string;
  look: MemberLook;
  slotTimes: SlotTimes;
  members: readonly Member[];
  /** The member's Time format (spec 029); 24-hour when not given. */
  use24h?: boolean;
}

export interface AgendaGroup {
  date: string;
  /** "Today · Sun, Oct 25", "Tomorrow · Mon, Oct 26", "Tue, Oct 27". */
  heading: string;
  /** Its events, and its reminders among them (spec 058). */
  events: ((EventListItem & { kind?: 'event' }) | DayReminderItem)[];
}

/** "Today · Sun, Oct 25", "Tomorrow · Mon, Oct 26", then "Tue, Oct 27" (OC-CalAgenda). */
export function agendaHeading(date: string, today: string): string {
  const label = dateLabel(date);
  if (date === today) return a.today(label);
  if (date === addDays(today, 1)) return a.tomorrow(label);
  return label;
}

/**
 * Spec 040 (OC-CalAgenda): from `from` to `to`, one group per day with events (days without are
 * skipped, FR-001), the visible events (already through `viewFor` and the header's filter) as
 * rows: all-day and multi-day first, then by start. FR-002's sub-line is "{time} · {place or
 * driver}", and a row has at most one tag: "Now", "Surprise", "Day N of M" or "Birthday". An
 * event the engine can't read is left out. Spec 058: the day's reminders among them
 * (`placeReminders`): late ones first, then by time, any time with the all-day events.
 */
export function layoutAgenda(from: string, to: string, occurrences: readonly MonthOccurrence[], ctx: AgendaContext, reminders: readonly CalendarReminder[] = []): AgendaGroup[] {
  const groups: AgendaGroup[] = [];
  for (let date = from; date <= to; date = addDays(date, 1)) {
    const rows = [
      ...occurrences
        .filter((o) => o.starts_on <= date && o.ends_on >= date)
        .flatMap((o) => {
          try {
            const row = agendaRow(o, date, ctx);
            return [{ order: row.order, title: row.item.title, item: row.item as AgendaGroup['events'][number] }];
          } catch {
            return [];
          }
        }),
      ...reminders.filter((x) => x.date === date).map((x) => ({ order: reminderOrder(x), reminder: x, title: x.row.title, item: x.item })),
    ].sort(compareDayRows);
    if (rows.length) groups.push({ date, heading: agendaHeading(date, ctx.today), events: rows.map((r) => r.item) });
  }
  return groups;
}

/** One row: its sort order (start in minutes, -1 all day) and what it shows. Home's card reuses it (spec 028). */
export function agendaRow(o: MonthOccurrence, date: string, ctx: AgendaContext): { order: number; item: EventListItem } {
  const { initials, colors } = eventLook(o.members, ctx.look, isTravel(o));
  const allDay = inAllDay(o);
  const range = allDay ? null : timeRange(o, ctx.slotTimes);
  const when = allDay || !range ? d.allDay : timeLabel(o, { use24h: ctx.use24h ?? true, slotTimes: ctx.slotTimes });
  const driver = o.view === 'full' ? driverLine(o.responsible_member_id, o.members, ctx.members) : null;
  const place = o.location ? placeLine(o.location) : driver;
  const placed = place ? d.at(when, place) : when;
  const hidden = hiddenFromLine(o, ctx.members);
  const sub = hidden ? d.at(placed, hidden) : placed;
  const tag = tagFor(o, date, range, ctx);
  return {
    order: range ? toMinutes(range.start) : -1,
    item: { key: occurrenceKey(o), title: o.title, sub, tag, initials, colors, label: a.rowLabel(o.title, whoText(o.members, ctx.look), sub, tag?.label ?? null) },
  };
}

function tagFor(o: MonthOccurrence, date: string, range: { start: string; end: string } | null, ctx: AgendaContext): EventListItem['tag'] {
  if (range && isNow(date, range, ctx)) return { label: d.now, tone: 'honey' };
  // `viewFor` sets it only for those who are in on the surprise.
  if (o.is_surprise) return { label: a.surprise, tone: 'sage' };
  const span = dayOf(o, date);
  if (span) return { label: span, tone: 'soft' };
  return isBirthday(o) ? { label: d.birthday, tone: 'soft' } : null;
}
