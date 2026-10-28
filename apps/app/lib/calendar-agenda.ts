import { addDays, dateLabel, timeLabel, timeRange, toMinutes, type SlotTimes } from '@cocon/calendar';
import type { EventListItem } from '@cocon/ui';
import { dayOf, driverLine, inAllDay, isBirthday, isNow } from './calendar-day';
import { eventLook, occurrenceKey, type MemberLook, type MonthOccurrence } from './calendar-month';
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
}

export interface AgendaGroup {
  date: string;
  /** "Today · Sun, Oct 25", "Tomorrow · Mon, Oct 26", "Tue, Oct 27". */
  heading: string;
  events: EventListItem[];
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
 * event the engine can't read is left out.
 */
export function layoutAgenda(from: string, to: string, occurrences: readonly MonthOccurrence[], ctx: AgendaContext): AgendaGroup[] {
  const groups: AgendaGroup[] = [];
  for (let date = from; date <= to; date = addDays(date, 1)) {
    const rows = occurrences
      .filter((o) => o.starts_on <= date && o.ends_on >= date)
      .flatMap((o) => {
        try {
          return [row(o, date, ctx)];
        } catch {
          return [];
        }
      })
      .sort((x, y) => x.order - y.order || x.item.title.localeCompare(y.item.title));
    if (rows.length) groups.push({ date, heading: agendaHeading(date, ctx.today), events: rows.map((r) => r.item) });
  }
  return groups;
}

function row(o: MonthOccurrence, date: string, ctx: AgendaContext): { order: number; item: EventListItem } {
  const { initials, colors } = eventLook(o.members, ctx.look);
  const allDay = inAllDay(o);
  const range = allDay ? null : timeRange(o, ctx.slotTimes);
  const when = allDay || !range ? d.allDay : timeLabel(o, { use24h: true, slotTimes: ctx.slotTimes });
  const driver = o.view === 'full' ? driverLine(o.responsible_member_id, o.members, ctx.members) : null;
  const place = o.location ?? driver;
  const sub = place ? d.at(when, place) : when;
  const tag = tagFor(o, date, range, ctx);
  return {
    order: range ? toMinutes(range.start) : -1,
    item: { key: occurrenceKey(o), title: o.title, sub, tag, initials, colors, label: a.rowLabel(o.title, sub, tag?.label ?? null) },
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
