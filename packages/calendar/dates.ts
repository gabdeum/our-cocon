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
