import { describe, expect, it } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import type { StoredEvent } from '@cocon/data';
import { anchorFrom, arrowLabels, cachedEvent, entryFrom, eventsKey, headerTitle, viewFrom } from './calendar-header';

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
    ['month', '2027-01-05', 390, 'January 2027'],
    ['month', '2027-09-05', 320, 'Sep. 2027'],
    ['week', '2026-10-27', 390, 'October 25 – 31'],
    ['week', '2026-10-27', 320, 'Oct. 25 – 31'],
    ['week', '2026-12-01', 390, 'Nov. 29 – Dec. 5'],
    ['week', '2027-01-05', 390, 'January 3 – 9, 2027'],
    ['day', '2026-10-25', 390, 'Sunday, October 25'],
    ['day', '2026-10-28', 390, 'Wed, October 28'],
    ['day', '2026-10-25', 320, 'Sun, Oct. 25'],
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

describe('cachedEvent', () => {
  it("finds an event in the family's loaded ranges, not another family's", () => {
    const queryClient = new QueryClient();
    const picnic = { id: 'e-picnic', title: 'Picnic' } as StoredEvent;
    queryClient.setQueryData(eventsKey('f-1', '2026-10-01', '2026-12-31'), [picnic]);
    queryClient.setQueryData(eventsKey('f-2', '2026-10-01', '2026-12-31'), [{ id: 'e-other' } as StoredEvent]);
    queryClient.setQueryData(['events', 'f-1', 'one', 'e-picnic'], null);
    expect(cachedEvent(queryClient, 'f-1', 'e-picnic')).toBe(picnic);
    expect(cachedEvent(queryClient, 'f-1', 'e-other')).toBeUndefined();
  });
});
