import type { TimeFormatSetting } from '@cocon/schemas/calendar';
import { addDays, parts, weekday } from './dates';
import { DEFAULT_SLOT_TIMES, slotStartingAt, timeRange, toMinutes } from './slots';
import type { CalendarEvent, SlotTimes } from './types';
import { en } from './words.en';

/** FR-007: titles use the full month name from this screen width up. */
export const WIDE_TITLE_MIN_WIDTH = 430;

/** Spec 029 "Time format": Automatic follows the device. */
export function uses24h(setting: TimeFormatSetting, device24h: boolean): boolean {
  return setting === 'automatic' ? device24h : setting === '24h';
}

/** "14:30" in 24-hour, "2:30 PM" in 12-hour. "24:00" (the end of the day) is "12:00 AM". */
export function formatTime(time: string, use24h: boolean): string {
  if (use24h) return time;
  const [h, m] = time.split(':').map(Number) as [number, number];
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, '0')} ${h >= 12 && h < 24 ? en.pm : en.am}`;
}

export interface LabelOptions {
  use24h: boolean;
  slotTimes?: SlotTimes;
}

type Labelled = Pick<CalendarEvent, 'time_type' | 'slots' | 'start_time' | 'end_time'>;

/**
 * FR-003: "All day"; the slot's name when the event starts at a slot's start ("Lunch" for
 * 12:00); otherwise its start time ("14:30").
 */
export function timeLabel(event: Labelled, { use24h, slotTimes = DEFAULT_SLOT_TIMES }: LabelOptions): string {
  const range = timeRange(event, slotTimes);
  if (!range) return en.allDay;
  const slot = slotStartingAt(range.start, slotTimes);
  return slot ? en.slots[slot] : formatTime(range.start, use24h);
}

/** FR-003: "{start}–{end}" for detail views ("14:30–16:00"); null for all-day events. */
export function rangeLabel(event: Labelled, { use24h, slotTimes = DEFAULT_SLOT_TIMES }: LabelOptions): string | null {
  const range = timeRange(event, slotTimes);
  return range && `${formatTime(range.start, use24h)}–${formatTime(range.end, use24h)}`;
}

function monthName(month: number, wide: boolean): string {
  return (wide ? en.months : en.monthsShort)[month - 1] as string;
}

/**
 * FR-007: "October" in the current year (the year of `today`, in the home time zone);
 * another year adds it: "January 2027" from 430 px, "Jan. 2027" below.
 */
export function monthTitle(year: number, month: number, today: string, width: number): string {
  if (year === parts(today).year) return monthName(month, true);
  return `${monthName(month, width >= WIDE_TITLE_MIN_WIDTH)} ${year}`;
}

/** FR-007: "Oct. 25 – 31", "Nov. 29 – Dec. 5"; "October 25 – 31" from 430 px. */
export function weekTitle(start: string, end: string, width: number): string {
  const wide = width >= WIDE_TITLE_MIN_WIDTH;
  const a = parts(start);
  const b = parts(end);
  const to = a.month === b.month ? `${b.day}` : `${monthName(b.month, wide)} ${b.day}`;
  return `${monthName(a.month, wide)} ${a.day} – ${to}`;
}

/** FR-007: "Sun, Oct. 25"; "Sunday, October 25" from 430 px. */
export function dayTitle(date: string, width: number): string {
  const wide = width >= WIDE_TITLE_MIN_WIDTH;
  const { month, day } = parts(date);
  return `${(wide ? en.weekdays : en.weekdaysShort)[weekday(date)]}, ${monthName(month, wide)} ${day}`;
}

/**
 * Dates in lists and details, with no period after the month (decided 2026-10-28, 032-later
 * L82): "Sun, Oct 25" (Agenda's day groups); `long` spells the weekday: "Saturday, Oct 31"
 * (event detail, Busy sheet).
 */
export function dateLabel(date: string, style: 'short' | 'long' = 'short'): string {
  const { month, day } = parts(date);
  const name = (style === 'long' ? en.weekdays : en.weekdaysShort)[weekday(date)];
  return `${name}, ${monthName(month, false).replace(/\.$/, '')} ${day}`;
}

/** From this time, an event today is "tonight" (the Evening slot's default start). */
const TONIGHT_FROM = '18:00';

/**
 * Spec 041 FR-009's "added for …": "tonight" (today from 18:00), "today", "tomorrow"; null for any
 * other day, which then reads as its `dateLabel` ("Sat, Oct 31"). `start` is null for all day.
 */
export function whenWord(date: string, today: string, start: string | null): 'tonight' | 'today' | 'tomorrow' | null {
  if (date === addDays(today, 1)) return 'tomorrow';
  if (date !== today) return null;
  return start !== null && toMinutes(start) >= toMinutes(TONIGHT_FROM) ? 'tonight' : 'today';
}
