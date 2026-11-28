import { addDays, calendarWords, daysBetween, fromMinutes, layoutDay, parts, sortSlots, textWidth, timeRange, toMinutes, weekRange, weekday, type SlotTimes, type WeekStartsOn } from '@cocon/calendar';
import { GRID_FIRST_HOUR, GRID_HOURS, HOUR_HEIGHT, WIDE_HOUR_HEIGHT, type HourGridProps, type WeekAllDayBar, type WeekBlock, type WeekColumn, type WeekDayHead } from '@cocon/ui';
import { chipLook, eventLook, longDate, occurrenceKey, spanLanes, weekdayLetters, weekdayShort, whoText, type MemberLook, type MonthOccurrence } from './calendar-month';
import { isTravel, travelJoins } from './calendar-travel';
import { strings } from '../strings';
import { clock, hourOnly } from './clock';

const w = strings.calendar.week;
const m = strings.calendar.month;
const words = calendarWords;

const GRID_START = GRID_FIRST_HOUR * 60;
const GRID_END = 24 * 60;
/** HourGrid README: a block is never shorter than this, so its top line still reads (30 from 600, spec 070). */
const MIN_BLOCK = { phone: 22, wide: 30 };

/** FR-001: "06:00" … "23:00", as drawn; "6 AM" … "11 PM" in 12-hour time (spec 029, L95). */
export const hourLabels = Array.from({ length: GRID_HOURS }, (_, i) => fromMinutes(GRID_START + i * 60));
const hourLabels12 = hourLabels.map((t) => hourOnly(t, false));

/** Distance from the grid's top for a time in minutes (36 px per hour from 06:00, 44 from 600 wide). */
const yOf = (minutes: number, hour: number) => ((minutes - GRID_START) / 60) * hour;

export interface WeekGridContext {
  weekStartsOn: WeekStartsOn;
  today: string;
  look: MemberLook;
  slotTimes: SlotTimes;
  /** "HH:MM" now in the home time zone, for the now line. */
  now: string;
  /** The member's Time format (spec 029); 24-hour when not given. */
  use24h?: boolean;
  /** Spec 058: how many reminders show on each day (none while they're hidden). */
  reminders?: ReadonlyMap<string, number>;
  /** The view's width in px and the text size multiplier: whether the alarm clocks fit beside the numbers. */
  width?: number;
  textScale?: number;
  /** Spec 070 FR-005: from 600 wide, 44 px hours, "Sun" heads and "who · time" on every card. */
  wide?: boolean;
}

/**
 * HourGrid README: the view's sides (8 each, 24 from 600), the hour labels (38, 52 from 600), 4 on
 * the right and 2 between the 7 day heads; the number (15, 18 from 600) and today's circle (28, 34).
 */
const HEAD = {
  phone: { sides: 8 + 8 + 38 + 4 + 6 * 2, num: 15, circle: 28 },
  wide: { sides: 24 + 24 + 52 + 4 + 6 * 2, num: 18, circle: 34 },
};
/** The 17 px alarm clock 1 after the number. */
const MARK = 17 + 1;

/**
 * Spec 058: whether the week's alarm clocks go under the numbers. If one doesn't fit beside its
 * number, they all go under, so the week's heads stay even.
 */
export function marksBelow(dates: readonly string[], ctx: Pick<WeekGridContext, 'today' | 'reminders' | 'width' | 'textScale' | 'wide'>): boolean {
  if (ctx.width === undefined) return false;
  const head = ctx.wide ? HEAD.wide : HEAD.phone;
  const column = (ctx.width - head.sides) / 7;
  return dates.some((date) => {
    if (!ctx.reminders?.get(date)) return false;
    const num = date === ctx.today ? head.circle : textWidth(String(parts(date).day), head.num) * (ctx.textScale ?? 1);
    return num + MARK > column;
  });
}

export type WeekGrid = Pick<HourGridProps, 'days' | 'bars' | 'columns' | 'hourLabels' | 'nowY'>;

/** The week's All day row takes all-day events and anything spanning more than one day. */
const inAllDayRow = (o: MonthOccurrence) => o.time_type === 'all_day' || o.ends_on > o.starts_on;

const dayName = (date: string) => words.weekdays[weekday(date)] ?? '';

/**
 * Spec 038 (OC-CalWeek): the week holding `anchor`, laid out for HourGrid. FR-001: the days from the
 * first day of the week, and the All day row's bars (one row each, stacked with `layoutSpans`;
 * "(cont.)" when they began the week before). FR-002: each day's timed events at their hours, slot
 * events labelled with the slot and custom ones with their start, side by side in `layoutDay`
 * lanes (then the top line is initials only). FR-003: the now line in today's column. An event
 * before 06:00 is drawn from 06:00; one the engine can't read is left out.
 */
export function layoutWeekGrid(anchor: string, occurrences: readonly MonthOccurrence[], ctx: WeekGridContext): WeekGrid {
  const { start, end } = weekRange(anchor, ctx.weekStartsOn);
  const dates = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const letters = ctx.wide ? weekdayShort(ctx.weekStartsOn) : weekdayLetters(ctx.weekStartsOn);
  const inWeek = occurrences.filter((o) => o.starts_on <= end && o.ends_on >= start);

  const below = marksBelow(dates, ctx);
  const days: WeekDayHead[] = dates.map((date, i) => ({
    date,
    letter: letters[i] ?? '',
    num: String(parts(date).day),
    label: strings.calendar.reminders.withCount(w.dayLabel(dayName(date), longDate(date)), ctx.reminders?.get(date) ?? 0),
    today: date === ctx.today,
    reminders: (ctx.reminders?.get(date) ?? 0) > 0,
    markBelow: below,
  }));

  const spans = inWeek.filter(inAllDayRow).map((o) => ({ o, from: o.starts_on < start ? start : o.starts_on, to: o.ends_on > end ? end : o.ends_on }));
  // Back-to-back trips share a row and meet at the middle of the day they change places.
  const joins = travelJoins(inWeek, occurrenceKey);
  const rows = spanLanes(spans, joins);
  const bars: WeekAllDayBar[] = spans.map((s) => ({
    key: occurrenceKey(s.o),
    ...chipLook(s.o.members, s.from === s.o.starts_on ? s.o.title : m.cont(s.o.title), ctx.look, true, isTravel(s.o)),
    label:
      s.o.ends_on > s.o.starts_on
        ? m.barLabel(s.o.title, whoText(s.o.members, ctx.look), longDate(s.o.starts_on), longDate(s.o.ends_on))
        : w.blockLabel(s.o.title, whoText(s.o.members, ctx.look), w.dayLabel(dayName(s.o.starts_on), longDate(s.o.starts_on)), words.allDay),
    column: daysBetween(start, s.from),
    days: daysBetween(s.from, s.to) + 1,
    lane: rows.get(occurrenceKey(s.o)) ?? 0,
    startsHere: s.from === s.o.starts_on,
    endsHere: s.to === s.o.ends_on,
    halfStart: s.from === s.o.starts_on && Boolean(joins.get(occurrenceKey(s.o))?.halfStart),
    halfEnd: s.to === s.o.ends_on && Boolean(joins.get(occurrenceKey(s.o))?.halfEnd),
  }));

  const columns: WeekColumn[] = dates.map((date) => ({
    date,
    label: w.dayLabel(dayName(date), longDate(date)),
    addLabel: w.addAt(w.dayLabel(dayName(date), longDate(date))),
    today: date === ctx.today,
    blocks: dayBlocks(inWeek.filter((o) => !inAllDayRow(o) && o.starts_on === date), date, ctx),
  }));

  const now = toMinutes(ctx.now);
  const nowY = dates.includes(ctx.today) && now >= GRID_START && now < GRID_END ? yOf(now, ctx.wide ? WIDE_HOUR_HEIGHT : HOUR_HEIGHT) : null;
  return { days, bars, columns, hourLabels: ctx.use24h === false ? hourLabels12 : hourLabels, nowY };
}

function dayBlocks(events: readonly MonthOccurrence[], date: string, ctx: WeekGridContext): WeekBlock[] {
  const hour = ctx.wide ? WIDE_HOUR_HEIGHT : HOUR_HEIGHT;
  const minBlock = ctx.wide ? MIN_BLOCK.wide : MIN_BLOCK.phone;
  const timed = events.flatMap((o) => {
    try {
      const range = timeRange(o, ctx.slotTimes);
      if (!range) return [];
      const from = Math.min(GRID_END, Math.max(GRID_START, toMinutes(range.start)));
      const to = Math.min(GRID_END, Math.max(from, toMinutes(range.end)));
      return [{ o, key: occurrenceKey(o), range, from, to }];
    } catch {
      return [];
    }
  });
  // Lanes from what's drawn, so a short block that's stretched to its least height doesn't cover the next.
  const drawnEnd = (t: { from: number; to: number }) => Math.min(GRID_END, Math.max(t.to, t.from + Math.ceil((minBlock / hour) * 60)));
  const lanes = new Map(layoutDay(timed.map((t) => ({ id: t.key, start: fromMinutes(t.from), end: fromMinutes(drawnEnd(t)) }))).map((l) => [l.id, l]));
  return timed.map(({ o, key, range, from, to }) => {
    const { initials, colors } = eventLook(o.members, ctx.look, isTravel(o));
    const slot = o.time_type === 'slot';
    const slotNames = sortSlots(o.slots).map((s) => words.slots[s]);
    const use24h = ctx.use24h ?? true;
    const when = slot ? (slotNames[0] ?? '') : clock(range.start, use24h);
    const lane = lanes.get(key) ?? { lane: 0, lanes: 1 };
    return {
      key,
      // Side by side on a phone there's only room for the initials; from 600 the time stays (OC-CalendarResponsive).
      top: lane.lanes > 1 && !ctx.wide ? initials : [initials, when].filter(Boolean).join(' '),
      title: o.title,
      label: w.blockLabel(o.title, whoText(o.members, ctx.look), w.dayLabel(dayName(date), longDate(date)), slot ? slotNames.join(', ') : w.timeRange(clock(range.start, use24h), clock(range.end, use24h))),
      colors,
      kind: slot ? 'slot' : 'custom',
      y: yOf(from, hour) + 1,
      height: Math.max(minBlock, ((to - from) / 60) * hour - 2),
      lane: lane.lane,
      lanes: lane.lanes,
    };
  });
}
