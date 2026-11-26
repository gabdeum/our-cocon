import type { MonthOccurrence } from './calendar-month';

/** A Travel event, for those who see the event itself (not "Busy" or a surprise's cover). */
export const isTravel = (o: MonthOccurrence) => o.view === 'full' && o.category === 'travel';

/** Where a trip meets the ones around it, and the chain of trips it belongs to. */
export interface TravelJoin {
  /** The chain's first trip: trips in one chain share a row. */
  chain: string;
  /** The same people's previous trip ends the day this one starts: it starts at the middle of that day. */
  halfStart: boolean;
  /** The same people's next trip starts the day this one ends: it stops at the middle of that day. */
  halfEnd: boolean;
  /** That next trip, by occurrence key. */
  next: string | null;
}

const people = (o: MonthOccurrence) => [...o.members].sort().join(',');

/**
 * Back-to-back trips: multi-day Travel events for the same people where one ends the day the next
 * starts (Paris until the 12th, then Lyon from the 12th). They're drawn as one line that changes at
 * the middle of that day rather than two stacked bars. By occurrence key (`keyOf`); trips that
 * join nothing aren't in the map.
 */
export function travelJoins(occurrences: readonly MonthOccurrence[], keyOf: (o: MonthOccurrence) => string): Map<string, TravelJoin> {
  const trips = occurrences
    .filter((o) => isTravel(o) && o.ends_on > o.starts_on)
    .sort((a, b) => a.starts_on.localeCompare(b.starts_on) || a.ends_on.localeCompare(b.ends_on) || keyOf(a).localeCompare(keyOf(b)));
  const joins = new Map<string, TravelJoin>();
  const taken = new Set<string>();
  for (const trip of trips) {
    const key = keyOf(trip);
    const next = trips.find((o) => o !== trip && o.starts_on === trip.ends_on && people(o) === people(trip) && !taken.has(keyOf(o)));
    if (!next) continue;
    const nextKey = keyOf(next);
    taken.add(nextKey);
    const own = joins.get(key) ?? { chain: key, halfStart: false, halfEnd: false, next: null };
    joins.set(key, { ...own, halfEnd: true, next: nextKey });
    joins.set(nextKey, { chain: own.chain, halfStart: true, halfEnd: false, next: null });
  }
  return joins;
}
