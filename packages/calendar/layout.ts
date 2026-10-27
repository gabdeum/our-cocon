import { toMinutes } from './slots';

export interface LayoutItem {
  id: string;
  /** "HH:MM" on the day being drawn. */
  start: string;
  end: string;
}

export interface LaneSlot {
  id: string;
  /** 0 is the leftmost lane. */
  lane: number;
  /** Lanes in this item's overlap group: its width is 1 / lanes. */
  lanes: number;
}

/**
 * FR-005: side-by-side lanes for one day's timed events (spec 038). Events that overlap, directly
 * or through another event, form a group; each takes the leftmost free lane, earliest and then
 * longest first. Touching events (one ends at 10:00, the next starts at 10:00) don't overlap.
 * Returned in the order placed.
 */
export function layoutDay(items: readonly LayoutItem[]): LaneSlot[] {
  const sorted = items
    .map((item) => ({ id: item.id, start: toMinutes(item.start), end: toMinutes(item.end) }))
    .sort((a, b) => a.start - b.start || b.end - a.end);
  const result: LaneSlot[] = [];
  let group: LaneSlot[] = [];
  let laneEnds: number[] = [];
  let groupEnd = -1;
  const closeGroup = () => {
    for (const slot of group) slot.lanes = laneEnds.length;
    group = [];
    laneEnds = [];
  };
  for (const item of sorted) {
    if (item.start >= groupEnd) closeGroup();
    let lane = laneEnds.findIndex((end) => end <= item.start);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = item.end;
    groupEnd = Math.max(groupEnd, item.end);
    const slot = { id: item.id, lane, lanes: 0 };
    group.push(slot);
    result.push(slot);
  }
  closeGroup();
  return result;
}
