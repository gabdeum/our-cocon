import { describe, expect, it } from 'vitest';
import { DEFAULT_SLOT_TIMES } from './slots';
import { dayTitle, formatTime, monthTitle, rangeLabel, timeLabel, uses24h, weekTitle } from './labels';

const custom = (start_time: string, end_time: string) => ({ time_type: 'custom' as const, slots: [], start_time, end_time });

describe('time label rule (FR-003)', () => {
  it.each([
    ['all day', { time_type: 'all_day' as const, slots: [] }, 'All day'],
    ['a slot', { time_type: 'slot' as const, slots: ['lunch' as const] }, 'Lunch'],
    ['two slots', { time_type: 'slot' as const, slots: ['evening' as const, 'afternoon' as const] }, 'Afternoon'],
    ['custom at a slot start', custom('12:00', '13:00'), 'Lunch'],
    ['custom at 06:00', custom('06:00', '07:00'), 'Early morning'],
    ['custom off a slot start', custom('14:30', '16:00'), '14:30'],
    ['custom after 22:00', custom('22:30', '23:30'), '22:30'],
  ])('%s', (_, event, label) => {
    expect(timeLabel(event, { use24h: true })).toBe(label);
  });

  it('uses 12-hour times when asked', () => {
    expect(timeLabel(custom('14:30', '16:00'), { use24h: false })).toBe('2:30 PM');
  });

  it('follows the family’s slot times', () => {
    const slotTimes = { ...DEFAULT_SLOT_TIMES, lunch: { start: '12:30', end: '14:00' } };
    expect(timeLabel(custom('12:30', '13:00'), { use24h: true, slotTimes })).toBe('Lunch');
    expect(timeLabel(custom('12:00', '13:00'), { use24h: true, slotTimes })).toBe('12:00');
  });

  it('shows "{start}–{end}" in detail views', () => {
    expect(rangeLabel(custom('14:30', '16:00'), { use24h: true })).toBe('14:30–16:00');
    expect(rangeLabel(custom('09:00', '24:00'), { use24h: false })).toBe('9:00 AM–12:00 AM');
    expect(rangeLabel({ time_type: 'all_day', slots: [] }, { use24h: true })).toBeNull();
  });

  it.each([
    ['00:00', '12:00 AM'],
    ['09:05', '9:05 AM'],
    ['12:00', '12:00 PM'],
    ['23:59', '11:59 PM'],
    ['24:00', '12:00 AM'],
  ])('%s in 12-hour is %s', (time, text) => {
    expect(formatTime(time, false)).toBe(text);
    expect(formatTime(time, true)).toBe(time);
  });

  it.each([
    ['automatic', true, true],
    ['automatic', false, false],
    ['24h', false, true],
    ['12h', true, false],
  ] as const)('time format %s with device 24h %s → %s', (setting, device, expected) => {
    expect(uses24h(setting, device)).toBe(expected);
  });
});

describe('titles (FR-007, design/ui/CalHeader.md)', () => {
  const today = '2026-10-27';

  it.each([
    [2026, 10, 375, 'October'],
    [2026, 10, 720, 'October'],
    [2027, 1, 375, 'Jan. 2027'],
    [2027, 1, 429, 'Jan. 2027'],
    [2027, 1, 430, 'January 2027'],
    [2027, 5, 375, 'May 2027'],
    [2027, 9, 375, 'Sep. 2027'],
    [2025, 12, 375, 'Dec. 2025'],
  ])('month %d-%d at %d px → %s', (year, month, width, title) => {
    expect(monthTitle(year, month, today, width)).toBe(title);
  });

  it('decides "this year" from today in the home time zone', () => {
    expect(monthTitle(2027, 1, '2026-12-31', 375)).toBe('Jan. 2027');
    expect(monthTitle(2027, 1, '2027-01-01', 375)).toBe('January');
  });

  it.each([
    ['2026-10-25', '2026-10-31', 375, 'Oct. 25 – 31'],
    ['2026-11-29', '2026-12-05', 375, 'Nov. 29 – Dec. 5'],
    ['2026-10-25', '2026-10-31', 430, 'October 25 – 31'],
    ['2026-11-29', '2026-12-05', 430, 'November 29 – December 5'],
    ['2026-12-27', '2027-01-02', 375, 'Dec. 27 – Jan. 2'],
    ['2027-05-02', '2027-05-08', 375, 'May 2 – 8'],
  ])('week %s–%s at %d px → %s', (start, end, width, title) => {
    expect(weekTitle(start, end, width)).toBe(title);
  });

  it.each([
    ['2026-10-25', 375, 'Sun, Oct. 25'],
    ['2026-10-25', 430, 'Sunday, October 25'],
    ['2027-05-06', 375, 'Thu, May 6'],
  ])('day %s at %d px → %s', (date, width, title) => {
    expect(dayTitle(date, width)).toBe(title);
  });
});
