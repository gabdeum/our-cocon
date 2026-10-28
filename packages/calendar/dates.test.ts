import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, daysInMonth, makeDate, timeIn, todayIn, weekRange, weekStartFor, weekday } from './dates';

describe('dates', () => {
  it('adds days across months, years and daylight saving', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09');
    expect(addDays('2026-11-01', -1)).toBe('2026-10-31');
    expect(makeDate(2027, 1, 0)).toBe('2026-12-31');
  });

  it('counts days and weekdays', () => {
    expect(daysBetween('2026-10-25', '2026-10-31')).toBe(6);
    expect(daysBetween('2026-10-31', '2026-10-25')).toBe(-6);
    expect(weekday('2026-10-25')).toBe(0);
    expect(weekday('2026-10-31')).toBe(6);
  });

  it.each([
    [2026, 2, 28],
    [2028, 2, 29],
    [2026, 10, 31],
    [2026, 11, 30],
  ])('%d-%d has %d days', (year, month, days) => {
    expect(daysInMonth(year, month)).toBe(days);
  });

  it('knows today in the home time zone (FR-008)', () => {
    const now = new Date('2027-01-01T03:00:00Z');
    expect(todayIn('Europe/Paris', now)).toBe('2027-01-01');
    expect(todayIn('America/New_York', now)).toBe('2026-12-31');
  });

  it('knows the time now in the home time zone (spec 038 now line)', () => {
    const now = new Date('2027-01-01T03:05:00Z');
    expect(timeIn('Europe/Paris', now)).toBe('04:05');
    expect(timeIn('America/New_York', now)).toBe('22:05');
    expect(timeIn('UTC', new Date('2027-01-01T00:00:00Z'))).toBe('00:00');
  });

  it.each([
    ['automatic', 'US', 0],
    ['automatic', 'us', 0],
    ['automatic', 'FR', 1],
    ['automatic', null, 1],
    ['sunday', 'FR', 0],
    ['monday', 'US', 1],
  ] as const)('week start %s in %s → %d', (setting, region, expected) => {
    expect(weekStartFor(setting, region)).toBe(expected);
  });

  it.each([
    ['2026-10-28', 0, '2026-10-25', '2026-10-31'],
    ['2026-10-25', 0, '2026-10-25', '2026-10-31'],
    ['2026-10-25', 1, '2026-10-19', '2026-10-25'],
    ['2026-10-28', 1, '2026-10-26', '2026-11-01'],
  ] as const)('the week of %s starting on %d is %s–%s', (date, start, first, last) => {
    expect(weekRange(date, start)).toEqual({ start: first, end: last });
  });
});
