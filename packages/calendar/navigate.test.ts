import { describe, expect, it } from 'vitest';
import { shiftAnchor } from './navigate';

describe('shiftAnchor (spec 036 FR-005)', () => {
  it('moves a month to the 1st, across month ends and years', () => {
    expect(shiftAnchor('month', '2026-01-31', 1)).toBe('2026-02-01');
    expect(shiftAnchor('month', '2026-12-15', 1)).toBe('2027-01-01');
    expect(shiftAnchor('month', '2027-01-10', -1)).toBe('2026-12-01');
  });

  it('moves a week, a day, and agenda by the week', () => {
    expect(shiftAnchor('week', '2026-10-27', 1)).toBe('2026-11-03');
    expect(shiftAnchor('week', '2026-01-02', -1)).toBe('2025-12-26');
    expect(shiftAnchor('day', '2026-03-08', 1)).toBe('2026-03-09');
    expect(shiftAnchor('day', '2026-11-01', -1)).toBe('2026-10-31');
    expect(shiftAnchor('agenda', '2026-10-27', -1)).toBe('2026-10-20');
  });
});
