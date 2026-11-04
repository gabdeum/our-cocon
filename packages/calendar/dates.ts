import type { WeekStartSetting } from '@cocon/schemas/calendar';

// Calendar days are "YYYY-MM-DD" in the family's home time zone (FR-008). Arithmetic goes
// through UTC midnight, so daylight saving never moves a day.

const DAY_MS = 86_400_000;

export type WeekStartsOn = 0 | 1;

function toUtc(date: string): number {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d);
}

function fromUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Year, month (1–12) and day of a date. */
export function parts(date: string): { year: number; month: number; day: number } {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  return { year, month, day };
}

export function makeDate(year: number, month: number, day: number): string {
  return fromUtc(Date.UTC(year, month - 1, day));
}

export function addDays(date: string, days: number): string {
  return fromUtc(toUtc(date) + days * DAY_MS);
}

/** Whole days from `a` to `b` (negative when `b` is earlier). */
export function daysBetween(a: string, b: string): number {
  return Math.round((toUtc(b) - toUtc(a)) / DAY_MS);
}

/** 0 = Sunday … 6 = Saturday. */
export function weekday(date: string): number {
  return new Date(toUtc(date)).getUTCDay();
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Today in the family's home time zone (an IANA name, e.g. "America/New_York"). */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** The time now in the home time zone, "HH:MM" in 24-hour (the week view's now line, spec 038). */
export function timeIn(timeZone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now);
}

/** How far `timeZone` is ahead of UTC at the instant `ms`, in ms. */
function offsetAt(timeZone: string, ms: number): number {
  const f = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' });
  const p = Object.fromEntries(f.formatToParts(new Date(ms)).map((x) => [x.type, Number(x.value)]));
  const wall = Date.UTC(p.year ?? 0, (p.month ?? 1) - 1, p.day ?? 1, p.hour ?? 0, p.minute ?? 0);
  return wall - Math.floor(ms / 60_000) * 60_000;
}

/**
 * The instant a wall-clock time happens on a date in the home time zone (spec 049: when a
 * reminder goes out). A repeated hour (clocks going back) is its first time; an hour skipped by
 * clocks going forward comes out an hour early.
 */
export function zonedInstant(date: string, time: string, timeZone: string): Date {
  const { year, month, day } = parts(date);
  const [h, m] = time.split(':').map(Number) as [number, number];
  const wall = Date.UTC(year, month - 1, day, h, m);
  const guess = wall - offsetAt(timeZone, wall);
  return new Date(wall - offsetAt(timeZone, guess));
}

/** Regions whose weeks start on Sunday (CLDR); everywhere else starts on Monday. */
const SUNDAY_REGIONS = new Set([
  'AG', 'AS', 'BD', 'BR', 'BS', 'BT', 'BW', 'BZ', 'CA', 'CN', 'CO', 'DM', 'DO', 'ET', 'GT', 'GU', 'HK', 'HN', 'ID', 'IL', 'IN',
  'JM', 'JP', 'KE', 'KH', 'KR', 'LA', 'MH', 'MM', 'MO', 'MT', 'MX', 'MZ', 'NI', 'NP', 'PA', 'PE', 'PH', 'PK', 'PR', 'PT', 'PY',
  'SA', 'SG', 'SV', 'TH', 'TT', 'TW', 'UM', 'US', 'VE', 'VI', 'WS', 'YE', 'ZA', 'ZW',
]);

/** Spec 029 "Week starts on": Automatic follows the device region (e.g. "US", "FR"). */
export function weekStartFor(setting: WeekStartSetting, region: string | null | undefined): WeekStartsOn {
  if (setting === 'sunday') return 0;
  if (setting === 'monday') return 1;
  return region && SUNDAY_REGIONS.has(region.toUpperCase()) ? 0 : 1;
}

/** The first and last day of the week holding `date`. */
export function weekRange(date: string, weekStartsOn: WeekStartsOn): { start: string; end: string } {
  const start = addDays(date, -((weekday(date) - weekStartsOn + 7) % 7));
  return { start, end: addDays(start, 6) };
}
