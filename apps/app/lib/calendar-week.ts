import { addDays, calendarWordsEn, daysBetween, fromMinutes, layoutDay, layoutSpans, parts, sortSlots, timeRange, toMinutes, weekRange, weekday, type SlotTimes, type WeekStartsOn } from '@cocon/calendar';
import { GRID_FIRST_HOUR, GRID_HOURS, HOUR_HEIGHT, type HourGridProps, type WeekAllDayBar, type WeekBlock, type WeekColumn, type WeekDayHead } from '@cocon/ui';
import { chipLook, eventLook, longDate, occurrenceKey, weekdayLetters, type MemberLook, type MonthOccurrence } from './calendar-month';
import { strings } from '../strings/en';

const w = strings.calendar.week;
const m = strings.calendar.month;
const words = calendarWordsEn;

const GRID_START = GRID_FIRST_HOUR * 60;
const GRID_END = 24 * 60;
/** HourGrid README: a block is never shorter than this, so its top line still reads. */
const MIN_BLOCK = 22;

/** FR-001: "06:00" … "23:00", as drawn (the Time format setting comes with spec 029). */
export const hourLabels = Array.from({ length: GRID_HOURS }, (_, i) => fromMinutes(GRID_START + i * 60));

/** Distance from the grid's top for a time in minutes (36 px per hour from 06:00). */
const yOf = (minutes: number) => ((minutes - GRID_START) / 60) * HOUR_HEIGHT;

export interface WeekGridContext {
  weekStartsOn: WeekStartsOn;
  today: string;
  look: MemberLook;
  slotTimes: SlotTimes;
  /** "HH:MM" now in the home time zone, for the now line. */
  now: string;
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
  const letters = weekdayLetters(ctx.weekStartsOn);
  const inWeek = occurrences.filter((o) => o.starts_on <= end && o.ends_on >= start);

  const days: WeekDayHead[] = dates.map((date, i) => ({
    date,
    letter: letters[i] ?? '',
    num: String(parts(date).day),
    label: w.dayLabel(dayName(date), longDate(date)),
    today: date === ctx.today,
  }));

  const spans = inWeek.filter(inAllDayRow).map((o) => ({ o, from: o.starts_on < start ? start : o.starts_on, to: o.ends_on > end ? end : o.ends_on }));
  const rows = new Map(layoutSpans(spans.map((s) => ({ id: occurrenceKey(s.o), from: s.from, to: s.to }))).map((l) => [l.id, l.lane]));
  const bars: WeekAllDayBar[] = spans.map((s) => ({
    key: occurrenceKey(s.o),
    ...chipLook(s.o.members, s.from === s.o.starts_on ? s.o.title : m.cont(s.o.title), ctx.look),
    label:
      s.o.ends_on > s.o.starts_on
        ? m.barLabel(s.o.title, longDate(s.o.starts_on), longDate(s.o.ends_on))
        : w.blockLabel(s.o.title, w.dayLabel(dayName(s.o.starts_on), longDate(s.o.starts_on)), words.allDay),
    column: daysBetween(start, s.from),
    days: daysBetween(s.from, s.to) + 1,
    lane: rows.get(occurrenceKey(s.o)) ?? 0,
    startsHere: s.from === s.o.starts_on,
    endsHere: s.to === s.o.ends_on,
  }));

  const columns: WeekColumn[] = dates.map((date) => ({
    date,
    addLabel: w.addAt(w.dayLabel(dayName(date), longDate(date))),
    today: date === ctx.today,
    blocks: dayBlocks(inWeek.filter((o) => !inAllDayRow(o) && o.starts_on === date), date, ctx),
  }));

  const now = toMinutes(ctx.now);
  const nowY = dates.includes(ctx.today) && now >= GRID_START && now < GRID_END ? yOf(now) : null;
  return { days, bars, columns, hourLabels, nowY };
}

function dayBlocks(events: readonly MonthOccurrence[], date: string, ctx: WeekGridContext): WeekBlock[] {
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
  // Lanes from what's drawn, so a short block that's stretched to 22 px doesn't cover the next.
  const drawnEnd = (t: { from: number; to: number }) => Math.min(GRID_END, Math.max(t.to, t.from + Math.ceil((MIN_BLOCK / HOUR_HEIGHT) * 60)));
  const lanes = new Map(layoutDay(timed.map((t) => ({ id: t.key, start: fromMinutes(t.from), end: fromMinutes(drawnEnd(t)) }))).map((l) => [l.id, l]));
  return timed.map(({ o, key, range, from, to }) => {
    const { initials, colors } = eventLook(o.members, ctx.look);
    const slot = o.time_type === 'slot';
    const slotNames = sortSlots(o.slots).map((s) => words.slots[s]);
    const when = slot ? (slotNames[0] ?? '') : range.start;
    const lane = lanes.get(key) ?? { lane: 0, lanes: 1 };
    return {
      key,
      top: lane.lanes > 1 ? initials : [initials, when].filter(Boolean).join(' '),
      title: o.title,
      label: w.blockLabel(o.title, dayName(date), slot ? slotNames.join(', ') : w.timeRange(range.start, range.end)),
      colors,
      kind: slot ? 'slot' : 'custom',
      y: yOf(from) + 1,
      height: Math.max(MIN_BLOCK, ((to - from) / 60) * HOUR_HEIGHT - 2),
      lane: lane.lane,
      lanes: lane.lanes,
    };
  });
}
