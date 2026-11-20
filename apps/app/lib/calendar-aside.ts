import { addDays, calendarWordsEn, monthTitles, parts, weekday, type SlotTimes } from '@cocon/calendar';
import type { MiniMonthDay } from '@cocon/ui';
import { firstOfMonth, isMultiDay, longDate, monthPageWeeks, startMinutes, weekStartAt, type MonthOccurrence, type MonthRange } from './calendar-month';
import { strings } from '../strings/en';

const a = strings.calendar.day.aside;
const words = calendarWordsEn;

/** The visible events on a day: multi-day ones first, then by start (the month chips' order). */
function eventsOn(date: string, occurrences: readonly MonthOccurrence[], slotTimes: SlotTimes): MonthOccurrence[] {
  return occurrences
    .filter((o) => o.starts_on <= date && o.ends_on >= date)
    .map((o) => ({ o, at: isMultiDay(o) ? -2 : startMinutes(o, slotTimes) }))
    .sort((x, y) => x.at - y.at || x.o.title.localeCompare(y.o.title))
    .map((x) => x.o);
}

export interface MiniMonthLayout {
  /** "October", or "January 2027" outside today's year. */
  title: string;
  days: MiniMonthDay[];
}

/**
 * Spec 070 FR-007: the month of the day Day view shows, as whole weeks: that day selected, today,
 * days around the month faded, and a dot on days with visible events (after `viewFor` and the filter).
 */
export function miniMonth(date: string, today: string, occurrences: readonly MonthOccurrence[], range: MonthRange): MiniMonthLayout {
  const month = firstOfMonth(date);
  const { year, month: mo } = parts(month);
  const days = monthPageWeeks(range, month).flatMap((index) =>
    Array.from({ length: 7 }, (_, i) => {
      const d = addDays(weekStartAt(range, index), i);
      const hasEvents = occurrences.some((o) => o.starts_on <= d && o.ends_on >= d);
      return {
        date: d,
        num: String(parts(d).day),
        label: a.dayLabel(longDate(d), hasEvents),
        selected: d === date,
        today: d === today,
        outside: firstOfMonth(d) !== month,
        hasEvents,
      };
    }),
  );
  return { title: monthTitles(year, mo, today)[0] ?? '', days };
}

export interface ComingUpDay {
  date: string;
  /** "Mon". */
  weekday: string;
  num: string;
  /** "Run · Baby yoga", or "Nothing planned". */
  text: string;
  /** "Monday October 26: Run · Baby yoga". */
  label: string;
}

/** Spec 070 FR-007: the `count` days after `date`, each with its visible events' titles joined by " · ". */
export function comingUp(date: string, occurrences: readonly MonthOccurrence[], slotTimes: SlotTimes, count = 3): ComingUpDay[] {
  return Array.from({ length: count }, (_, i) => {
    const d = addDays(date, i + 1);
    const titles = eventsOn(d, occurrences, slotTimes).map((o) => o.title);
    const text = titles.length ? titles.join(' · ') : a.nothingPlanned;
    const wd = weekday(d);
    return {
      date: d,
      weekday: words.weekdaysShort[wd] ?? '',
      num: String(parts(d).day),
      text,
      label: a.rowLabel(strings.calendar.week.dayLabel(words.weekdays[wd] ?? '', longDate(d)), text),
    };
  });
}
