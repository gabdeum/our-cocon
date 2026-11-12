import { describe, expect, it } from 'vitest';
import { cookedSummary, isOldCook, isStaleCook } from './cook';

describe('cooking sessions (spec 051)', () => {
  const now = new Date('2026-11-12T19:00:00Z');

  it('reads "started yesterday" after 24 hours untouched, and is stale after 72', () => {
    expect(isOldCook('2026-11-12T10:00:00Z', now)).toBe(false);
    expect(isOldCook('2026-11-11T19:00:00Z', now)).toBe(true);
    expect(isStaleCook('2026-11-10T19:00:01Z', now)).toBe(false);
    expect(isStaleCook('2026-11-09T19:00:00Z', now)).toBe(true);
  });

  it('US2: counts the done sessions and names the last cook (FR-005)', () => {
    expect(cookedSummary([])).toBeNull();
    expect(
      cookedSummary([
        { finished_at: '2026-10-01T19:00:00Z', finished_by: 'gabriel' },
        { finished_at: '2026-10-22T19:00:00Z', finished_by: 'eva' },
        { finished_at: '2026-10-08T19:00:00Z', finished_by: 'gabriel' },
        { finished_at: '2026-09-08T19:00:00Z', finished_by: null },
      ]),
    ).toEqual({ times: 4, lastBy: 'eva', lastAt: '2026-10-22T19:00:00Z' });
  });
});
