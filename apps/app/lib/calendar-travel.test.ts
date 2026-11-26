// Travel events: back-to-back trips for the same people meet at the middle of the day they change places.
import { describe, expect, it } from 'vitest';
import type { MonthOccurrence } from './calendar-month';
import { travelJoins } from './calendar-travel';

const trip = (key: string, starts_on: string, ends_on: string, fields: Partial<MonthOccurrence> = {}) =>
  ({ id: key, occurrence_date: null, view: 'full', category: 'travel', members: ['g', 'e'], starts_on, ends_on, ...fields }) as unknown as MonthOccurrence;
const keyOf = (o: MonthOccurrence) => o.id;

describe('travelJoins', () => {
  it('chains trips where one ends the day the next starts, whatever the order of the people', () => {
    const joins = travelJoins([trip('lyon', '2026-11-12', '2026-11-15', { members: ['e', 'g'] }), trip('paris', '2026-11-08', '2026-11-12'), trip('nice', '2026-11-15', '2026-11-18')], keyOf);
    expect([...joins].sort()).toEqual([
      ['lyon', { chain: 'paris', halfStart: true, halfEnd: true, next: 'nice' }],
      ['nice', { chain: 'paris', halfStart: true, halfEnd: false, next: null }],
      ['paris', { chain: 'paris', halfStart: false, halfEnd: true, next: 'lyon' }],
    ]);
  });

  it('leaves out other people, other types, one-day trips, a gap of a day and what the viewer sees as Busy', () => {
    const paris = trip('paris', '2026-11-08', '2026-11-12');
    for (const next of [
      trip('a', '2026-11-12', '2026-11-14', { members: ['g'] }),
      trip('b', '2026-11-12', '2026-11-14', { category: 'work' }),
      trip('c', '2026-11-12', '2026-11-12'),
      trip('d', '2026-11-13', '2026-11-14'),
      trip('e', '2026-11-12', '2026-11-14', { view: 'busy' }),
    ]) {
      expect(travelJoins([paris, next], keyOf).size).toBe(0);
    }
  });
});
