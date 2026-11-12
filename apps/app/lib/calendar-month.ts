import {
  addDays,
  calendarWordsEn,
  daysBetween,
  expand,
  layoutSpans,
  makeDate,
  parts,
  shownByFilter,
  timeRange,
  toMinutes,
  viewFor,
  weekRange,
  type Occurrence,
  type SlotTimes,
  type Viewed,
  type WeekStartsOn,
} from '@cocon/calendar';
import type { StoredEvent } from '@cocon/data';
import { memberInitials } from '@cocon/schemas';
import type { EventMember } from '@cocon/schemas/calendar';
import type { EventColor, MonthBar, MonthCell, MonthCellItem, MonthWeek } from '@cocon/ui';
import type { Member } from './session';
import { strings } from '../strings/en';

const m = strings.calendar.month;
const words = calendarWordsEn;

/** Spec 037 FR-003: a cell shows up to five rows (chips or the space under a bar), or four and "+N". */
export const ROWS_PER_CELL = 5;
/** FR-003: chips carry initials only from this window width up; narrower, the title alone. */
export const INITIALS_MIN_WIDTH = 430;
/** How far the grid scrolls either way from today. */
const YEARS_AROUND = 5;

export type MonthOccurrence = Viewed<Occurrence>;

/** The grid's rows: whole weeks from 5 years before today's year to 5 years after. */
export interface MonthRange {
  /** The first day of row 0. */
  origin: string;
  weekCount: number;
  weekStartsOn: WeekStartsOn;
}

export function monthRange(today: string, weekStartsOn: WeekStartsOn): MonthRange {
  const { year } = parts(today);
  const origin = weekRange(makeDate(year - YEARS_AROUND, 1, 1), weekStartsOn).start;
  const last = weekRange(makeDate(year + YEARS_AROUND, 12, 31), weekStartsOn).start;
  return { origin, weekCount: daysBetween(origin, last) / 7 + 1, weekStartsOn };
}

export const weekStartAt = (range: MonthRange, index: number) => addDays(range.origin, index * 7);

/** The row holding `date`, kept inside the grid. */
export function weekIndexOf(range: MonthRange, date: string): number {
  return Math.min(range.weekCount - 1, Math.max(0, Math.floor(daysBetween(range.origin, date) / 7)));
}

/** The 1st of the month holding `date`. */
export const firstOfMonth = (date: string) => {
  const { year, month } = parts(date);
  return makeDate(year, month, 1);
};

/** FR-001: the row holding the 1st of `date`'s month, where the grid opens. */
export const firstWeekOfMonth = (range: MonthRange, date: string) => weekIndexOf(range, firstOfMonth(date));

/** FR-005: the month that fills the grid is the one of the Wednesday in the second visible row. Returns its 1st. */
export function monthShownAt(range: MonthRange, topRow: number): string {
  const row = Math.min(range.weekCount - 1, topRow + 1);
  return firstOfMonth(addDays(weekStartAt(range, row), (3 - range.weekStartsOn + 7) % 7));
}

/** S M T W T F S from the first day of the week. */
export function weekdayLetters(weekStartsOn: WeekStartsOn): string[] {
  return [...m.weekdays.slice(weekStartsOn), ...m.weekdays.slice(0, weekStartsOn)];
}

/**
 * FR-001: the events loaded for the visible month: its quarter and 6 months on either side, so
 * scrolling a few months reuses the same query (spec 035's sync refetches it live).
 */
export function eventWindow(month: string): { from: string; to: string } {
  const { year, month: mo } = parts(month);
  const quarterStart = mo - ((mo - 1) % 3);
  return { from: makeDate(year, quarterStart - 6, 1), to: addDays(makeDate(year, quarterStart + 9, 1), -1) };
}

/**
 * Every time the family's events happen in `from`–`to`, as this member may see them (`viewFor`:
 * someone else's private event reads "Busy"), minus the people hidden in the header's filter. An
 * event the engine can't read is left out rather than breaking the month.
 */
export function monthOccurrences(events: readonly StoredEvent[], from: string, to: string, myMemberId: string, hidden: ReadonlySet<string>): MonthOccurrence[] {
  return events
    .flatMap((event) => {
      try {
        return expand(event, from, to, event.exceptions);
      } catch {
        return [];
      }
    })
    .map((o) => viewFor(o, myMemberId))
    .filter((o) => shownByFilter(o.members, hidden));
}

/** Initials, colors and names by member id, for the chips and their labels. */
export interface MemberLook {
  initials: ReadonlyMap<string, string>;
  colors: ReadonlyMap<string, EventColor>;
  names: ReadonlyMap<string, string>;
}

export function memberLook(members: readonly Member[]): MemberLook {
  return {
    initials: memberInitials(members),
    colors: new Map(members.map((mb) => [mb.id, mb.color as EventColor])),
    names: new Map(members.map((mb) => [mb.id, mb.display_name])),
  };
}

/** Who an event is for, by name: "Gabriel", "Everyone", "Others". A member who left isn't named. */
export function peopleNames(members: readonly string[], look: MemberLook): string[] {
  const header = strings.calendar.header;
  return members.map((id) => (id === 'everyone' ? header.everyone : id === 'others' ? header.others : look.names.get(id))).filter((n): n is string => Boolean(n));
}

/** The "who" part of an event's screen-reader label (spec 030 FR-006): "Gabriel and Eva". */
export const whoText = (members: readonly string[], look: MemberLook) => strings.calendar.who(peopleNames(members, look));

/** FR-008: an event in a day's label, with its people: "Baby swim (James)". */
function withPeople(o: MonthOccurrence, look: MemberLook): string {
  return m.withPeople(o.title, peopleNames(o.members, look));
}

/**
 * FR-003: up to two initials joined by "·" ("G·E"), "All" for Everyone, none for Others, and the
 * fill. Two members split the fill; a member who left is grey. Also the week view's blocks (038).
 */
export function eventLook(members: readonly EventMember[], look: MemberLook): { initials: string; colors: EventColor[] } {
  const colors = members.map((id): EventColor => (id === 'everyone' ? 'everyone' : id === 'others' ? 'others' : (look.colors.get(id) ?? 'removed'))).slice(0, 2);
  const initials = members
    .filter((id) => id !== 'others')
    .map((id) => (id === 'everyone' ? strings.calendar.header.everyoneInitial : look.initials.get(id)))
    .filter((i): i is string => Boolean(i))
    .slice(0, 2)
    .join('·');
  return { initials, colors };
}

/** FR-003: "{initials} {title}" and the fill; the title alone with `initials: false` (narrow screens). */
export function chipLook(members: readonly EventMember[], title: string, look: MemberLook, withInitials = true): { text: string; colors: EventColor[] } {
  const { initials, colors } = eventLook(members, look);
  return { text: initials && withInitials ? `${initials} ${title}` : title, colors };
}

const isMultiDay = (o: MonthOccurrence) => o.ends_on > o.starts_on;

/** FR-003 order for one day's chips: all-day first, then by start (slot or time). */
function startMinutes(o: MonthOccurrence, slotTimes: SlotTimes): number {
  try {
    const range = timeRange(o, slotTimes);
    return range ? toMinutes(range.start) : -1;
  } catch {
    return -1;
  }
}

/** "October 25". */
export const longDate = (date: string) => {
  const { month, day } = parts(date);
  return `${words.months[month - 1]} ${day}`;
};

/** The key a bar or chip reports when tapped: event id and the occurrence's series date. */
export const occurrenceKey = (o: Pick<MonthOccurrence, 'id' | 'occurrence_date'>) => `${o.id}|${o.occurrence_date ?? ''}`;
export function parseOccurrenceKey(key: string): { id: string; date: string } {
  const [id = '', date = ''] = key.split('|');
  return { id, date };
}

export interface WeekContext {
  range: MonthRange;
  today: string;
  look: MemberLook;
  slotTimes: SlotTimes;
  /** FR-003: initials on the chips (window 430 px wide or more). */
  initials: boolean;
}

/**
 * One week row (FR-002–FR-004): each day's chips in order, and every multi-day event as a bar from
 * its first to its last day in the row, stacked in rows. Days under a bar keep that row empty. A day
 * shows five rows when everything fits, else four and "+N" for the rest of the visible events; a
 * bar is drawn only over the days whose rows reach its lane.
 */
export function layoutWeek(index: number, occurrences: readonly MonthOccurrence[], ctx: WeekContext): MonthWeek {
  const start = weekStartAt(ctx.range, index);
  const end = addDays(start, 6);
  const inWeek = occurrences.filter((o) => o.starts_on <= end && o.ends_on >= start);

  const spans = inWeek.filter(isMultiDay).map((o) => ({ o, from: o.starts_on < start ? start : o.starts_on, to: o.ends_on > end ? end : o.ends_on }));
  const lanes = new Map(layoutSpans(spans.map((s) => ({ id: occurrenceKey(s.o), from: s.from, to: s.to }))).map((l) => [l.id, l.lane]));
  const laneOf = (s: (typeof spans)[number]) => lanes.get(occurrenceKey(s.o)) ?? 0;

  const days = Array.from({ length: 7 }, (_, d) => {
    const date = addDays(start, d);
    const covering = spans.filter((s) => s.from <= date && s.to >= date);
    const singles = inWeek
      .filter((o) => !isMultiDay(o) && o.starts_on === date)
      .map((o) => ({ o, at: startMinutes(o, ctx.slotTimes) }))
      .sort((a, b) => a.at - b.at || a.o.title.localeCompare(b.o.title))
      .map((x) => x.o);
    // Five rows if every bar's lane and every chip fit in them, else four and "+N".
    const fits = covering.every((s) => laneOf(s) < ROWS_PER_CELL) && singles.length <= ROWS_PER_CELL - covering.length;
    return { date, covering, singles, rows: fits ? ROWS_PER_CELL : ROWS_PER_CELL - 1 };
  });

  // A bar runs over the days whose rows reach its lane, in one piece per run of such days.
  const bars: MonthBar[] = [];
  for (const s of spans) {
    const lane = laneOf(s);
    let from: string | null = null;
    for (let d = daysBetween(start, s.from); d <= daysBetween(start, s.to) + 1; d++) {
      const day = days[d];
      if (day && day.date <= s.to && lane < day.rows) {
        from ??= day.date;
        continue;
      }
      if (from === null) continue;
      const to = addDays(start, d - 1);
      const { text, colors } = chipLook(s.o.members, from === s.o.starts_on ? s.o.title : m.cont(s.o.title), ctx.look, ctx.initials);
      bars.push({
        key: `${occurrenceKey(s.o)}|${from}`,
        text,
        colors,
        label: m.barLabel(s.o.title, whoText(s.o.members, ctx.look), longDate(s.o.starts_on), longDate(s.o.ends_on)),
        column: daysBetween(start, from),
        days: daysBetween(from, to) + 1,
        lane,
        startsHere: from === s.o.starts_on,
        endsHere: to === s.o.ends_on,
      });
      from = null;
    }
  }

  const cells: MonthCell[] = days.map(({ date, covering, singles, rows }) => {
    const { month, day } = parts(date);
    const busyRows = new Set(covering.map(laneOf).filter((lane) => lane < rows));
    const items: MonthCellItem[] = [];
    let next = 0;
    for (let row = 0; row < rows; row++) {
      const o = busyRows.has(row) ? undefined : singles[next];
      if (o) {
        next++;
        items.push({ kind: 'chip', key: occurrenceKey(o), ...chipLook(o.members, o.title, ctx.look, ctx.initials) });
      } else if ([...busyRows].some((r) => r >= row)) items.push({ kind: 'space', key: `space-${row}` });
    }
    const shown = next + busyRows.size;
    const total = singles.length + covering.length;
    return {
      date,
      label: m.dayLabel(longDate(date), [...covering.map((s) => withPeople(s.o, ctx.look)), ...singles.map((o) => withPeople(o, ctx.look))]),
      dateText: day === 1 ? m.firstOfMonth(words.monthsShort[month - 1] ?? '') : String(day),
      first: day === 1,
      today: date === ctx.today,
      past: date < ctx.today,
      items,
      more: total > shown ? m.more(total - shown) : null,
    };
  });

  return { key: start, cells, bars };
}
