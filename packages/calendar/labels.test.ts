import { describe, expect, it } from 'vitest';
import { DEFAULT_SLOT_TIMES } from './slots';
import { dateLabel, dayTitles, fitTitle, formatTime, monthTitles, rangeLabel, timeLabel, titleWidth, uses24h, weekTitles, whenWord } from './labels';

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

describe('titles (FR-007, design/ui/CalHeader.md › Titles)', () => {
  const today = '2026-10-27';
  const at = (formats: string[]) => [320, 375, 390, 430].map((width) => fitTitle(formats, width));

  it.each([
    ['September', 144],
    ['September 2027', 217],
    ['Mar. 2027', 131],
    ['September 13 – 19', 245],
    ['Mar. 15 – 21', 159],
    ['November 29 – December 5', 360],
    ['Nov. 29 – Dec. 5', 207],
    ['September 13 – 19, 2027', 325],
    ['Feb. 28 – Mar. 6, 2027', 284],
    ['Wednesday, September 16', 350],
    ['Wed, September 16', 260],
    ['Wed, Sep. 16', 172],
    ['Wed, September 16, 2027', 340],
    ['Wed, Sep. 16, 2027', 252],
  ])('"%s" measures %i px', (title, width) => {
    expect(Math.abs(titleWidth(title) - width)).toBeLessThan(1);
  });

  // The worst cases of CalHeader.md, at 320, 375, 390 and 430 px.
  it.each([
    ['month, this year', monthTitles(2026, 9, today), ['September', 'September', 'September', 'September']],
    ['month, other year', monthTitles(2027, 9, today), ['Sep. 2027', 'September 2027', 'September 2027', 'September 2027']],
    ['week, one month', weekTitles('2026-09-13', '2026-09-19', today), ['Sep. 13 – 19', 'September 13 – 19', 'September 13 – 19', 'September 13 – 19']],
    ['week, two months', weekTitles('2026-11-29', '2026-12-05', today), ['Nov. 29 – Dec. 5', 'Nov. 29 – Dec. 5', 'Nov. 29 – Dec. 5', 'Nov. 29 – Dec. 5']],
    ['week, other year', weekTitles('2027-09-12', '2027-09-18', today), ['Sep. 12 – 18', 'Sep. 12 – 18, 2027', 'Sep. 12 – 18, 2027', 'Sep. 12 – 18, 2027']],
    ['week across New Year', weekTitles('2026-12-27', '2027-01-02', today), ['Dec. 27 – Jan. 2', 'Dec. 27 – Jan. 2', 'Dec. 27 – Jan. 2', 'Dec. 27 – Jan. 2, 2027']],
    ['week, other year, two months', weekTitles('2027-02-28', '2027-03-06', today), ['Feb. 28 – Mar. 6', 'Feb. 28 – Mar. 6', 'Feb. 28 – Mar. 6', 'Feb. 28 – Mar. 6, 2027']],
    ['day', dayTitles('2026-09-16', today), ['Wed, Sep. 16', 'Wed, Sep. 16', 'Wed, September 16', 'Wed, September 16']],
    ['day, short weekday', dayTitles('2026-10-25', today), ['Sun, Oct. 25', 'Sun, October 25', 'Sunday, October 25', 'Sunday, October 25']],
    ['day, other year', dayTitles('2027-09-15', today), ['Wed, Sep. 15', 'Wed, Sep. 15', 'Wed, Sep. 15, 2027', 'Wed, Sep. 15, 2027']],
    ['day, other year, short month', dayTitles('2027-01-08', today), ['Fri, Jan. 8', 'Fri, Jan. 8, 2027', 'Fri, January 8, 2027', 'Friday, January 8, 2027']],
  ])('%s', (_, formats, titles) => {
    expect(at(formats)).toEqual(titles);
  });

  it('lists formats longest first, with the year only outside the current year', () => {
    expect(monthTitles(2027, 1, today)).toEqual(['January 2027', 'Jan. 2027']);
    expect(weekTitles('2026-10-25', '2026-10-31', today)).toEqual(['October 25 – 31', 'Oct. 25 – 31']);
    expect(dayTitles('2027-01-08', today)).toEqual(['Friday, January 8, 2027', 'Fri, January 8, 2027', 'Fri, Jan. 8, 2027', 'Fri, Jan. 8']);
  });

  it('decides "this year" from today in the home time zone', () => {
    expect(monthTitles(2027, 1, '2026-12-31')).toEqual(['January 2027', 'Jan. 2027']);
    expect(monthTitles(2027, 1, '2027-01-01')).toEqual(['January']);
  });

  it('May has no period', () => {
    expect(monthTitles(2027, 5, today)).toEqual(['May 2027', 'May 2027']);
    expect(weekTitles('2027-05-02', '2027-05-08', '2027-01-01').at(-1)).toBe('May 2 – 8');
  });

  it('uses the last format when none fits, and never adds "…"', () => {
    expect(fitTitle(['A very long title', 'Short'], 100)).toBe('Short');
  });
});

describe('dateLabel (032-later L82: no period)', () => {
  it.each([
    ['2026-10-25', 'short', 'Sun, Oct 25'],
    ['2026-10-31', 'long', 'Saturday, Oct 31'],
    ['2026-09-03', 'short', 'Thu, Sep 3'],
    ['2027-05-06', 'short', 'Thu, May 6'],
  ] as const)('%s (%s) → %s', (date, style, label) => {
    expect(dateLabel(date, style)).toBe(label);
  });
});

describe('whenWord (spec 041 FR-009)', () => {
  it.each([
    ['tonight: today from 18:00', '2026-10-28', '18:00', 'tonight'],
    ['today before 18:00', '2026-10-28', '17:59', 'today'],
    ['today, all day', '2026-10-28', null, 'today'],
    ['tomorrow', '2026-10-29', '18:00', 'tomorrow'],
    ['another day', '2026-10-31', '09:00', null],
    ['a past day', '2026-10-27', '09:00', null],
  ])('%s', (_, date, start, expected) => {
    expect(whenWord(date, '2026-10-28', start)).toBe(expected);
  });
});
