import { describe, expect, it } from 'vitest';
import { anchorFrom, arrowLabels, entryFrom, headerTitle, viewFrom } from './calendar-header';

describe('calendar header (spec 036)', () => {
  it('US1: opens on Month unless the URL names another view', () => {
    expect(viewFrom(undefined)).toBe('month');
    expect(viewFrom('week')).toBe('week');
    expect(viewFrom('year')).toBe('month');
  });

  it("calendar_viewed's entry: Home's card or the tab bar", () => {
    expect(entryFrom('home')).toBe('homepage');
    expect(entryFrom(undefined)).toBe('nav');
    expect(entryFrom('elsewhere')).toBe('nav');
  });

  it('opens on today unless the URL names a day', () => {
    expect(anchorFrom(undefined, '2026-10-27')).toBe('2026-10-27');
    expect(anchorFrom('2027-01-05', '2026-10-27')).toBe('2027-01-05');
    expect(anchorFrom('soon', '2026-10-27')).toBe('2026-10-27');
  });

  it.each([
    ['month', '2026-10-27', 390, 'October'],
    ['month', '2027-01-05', 390, 'Jan. 2027'],
    ['month', '2027-01-05', 430, 'January 2027'],
    ['week', '2026-10-27', 390, 'Oct. 25 – 31'],
    ['week', '2026-10-27', 430, 'October 25 – 31'],
    ['day', '2026-10-25', 390, 'Sun, Oct. 25'],
    ['day', '2026-10-25', 430, 'Sunday, October 25'],
    ['agenda', '2026-10-25', 390, 'Coming up'],
  ] as const)('FR-003: %s on %s at %i px reads "%s"', (view, anchor, width, title) => {
    expect(headerTitle(view, anchor, '2026-10-27', width, 0)).toBe(title);
  });

  it('FR-002: names the arrows by how far they move', () => {
    expect(arrowLabels('month')).toEqual({ prev: 'Previous month', next: 'Next month' });
    expect(arrowLabels('day')).toEqual({ prev: 'Previous day', next: 'Next day' });
    expect(arrowLabels('agenda')).toEqual({ prev: 'Previous week', next: 'Next week' });
  });
});
