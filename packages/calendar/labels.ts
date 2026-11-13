import type { TimeFormatSetting } from '@cocon/schemas/calendar';
import { addDays, parts, weekday } from './dates';
import { DEFAULT_SLOT_TIMES, slotStartingAt, timeRange, toMinutes } from './slots';
import type { CalendarEvent, SlotTimes } from './types';
import { ADVANCE, KERN } from './title-font';
import { en } from './words.en';

/** FR-007: the title font, Nunito 900 at 28 px with −0.5 px tracking (CalHeader.md › Titles). */
const TITLE_SIZE = 28;
const TITLE_TRACKING = -0.5;
/** A character the table doesn't have counts as one em, so a title with it errs on the short side. */
const UNKNOWN_ADVANCE = 1000;

/** Row 1 around the title: padding 20 + 20, the "Today" pill (80: 15/800 text, 18 px padding) and the 8 px gap. */
export const TITLE_SIDE = 128;

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

/** FR-007: a title's width in px, from the font's advances and kerning (`title-font.ts`). */
export function titleWidth(text: string): number {
  let units = 0;
  for (let i = 0; i < text.length; i++) {
    units += ADVANCE[text[i] as string] ?? UNKNOWN_ADVANCE;
    units += KERN[text.slice(i, i + 2)] ?? 0;
  }
  return (units * TITLE_SIZE) / 1000 + TITLE_TRACKING * text.length;
}

/** FR-007: the first format (longest first) that fits beside "Today" on this screen; the last one if none does. */
export function fitTitle(formats: readonly string[], screenWidth: number): string {
  const space = screenWidth - TITLE_SIDE;
  return formats.find((f) => titleWidth(f) <= space) ?? (formats[formats.length - 1] as string);
}

/** ", 2027" when any of these days is outside the year of `today` (home time zone). */
function yearSuffix(today: string, ...dates: string[]): string {
  const current = parts(today).year;
  const last = parts(dates[dates.length - 1] as string).year;
  return dates.some((d) => parts(d).year !== current) ? `, ${last}` : '';
}

/** Longest first, then the same without the year as a last resort. */
function withYear(formats: string[], year: string): string[] {
  return year ? [...formats.map((f) => f + year), formats[formats.length - 1] as string] : formats;
}

/** FR-007: "October" in the current year; another year "January 2027", then "Jan. 2027". */
export function monthTitles(year: number, month: number, today: string): string[] {
  if (year === parts(today).year) return [monthName(month, true)];
  return [`${monthName(month, true)} ${year}`, `${monthName(month, false)} ${year}`];
}

/** FR-007: "October 25 – 31" / "November 29 – December 5", then "Nov. 29 – Dec. 5"; ", 2027" outside this year. */
export function weekTitles(start: string, end: string, today: string): string[] {
  const a = parts(start);
  const b = parts(end);
  const range = (wide: boolean) => `${monthName(a.month, wide)} ${a.day} – ${a.month === b.month ? '' : `${monthName(b.month, wide)} `}${b.day}`;
  return withYear([range(true), range(false)], yearSuffix(today, start, end));
}

/** FR-007: "Sunday, October 25", "Sun, October 25", then "Sun, Oct. 25"; ", 2027" outside this year. */
export function dayTitles(date: string, today: string): string[] {
  const { month, day } = parts(date);
  const wd = weekday(date);
  const long = `${en.weekdays[wd]}, ${monthName(month, true)} ${day}`;
  const mid = `${en.weekdaysShort[wd]}, ${monthName(month, true)} ${day}`;
  const short = `${en.weekdaysShort[wd]}, ${monthName(month, false)} ${day}`;
  return withYear([long, mid, short], yearSuffix(today, date));
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

/** A place typed over several lines, on one: "4 Elm St, 75011 Paris" (day and agenda rows, reminders). */
export function placeLine(place: string): string {
  return place
    .split(/\s*\n\s*/)
    .filter(Boolean)
    .join(', ');
}
