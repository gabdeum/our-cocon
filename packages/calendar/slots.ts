import { SLOT_KEYS, type SlotKey } from '@cocon/schemas/calendar';
import { CalendarError } from './errors';
import type { CalendarEvent, SlotTimes } from './types';

/** FR-002 defaults; the family owner can change them (spec 029). */
export const DEFAULT_SLOT_TIMES: SlotTimes = {
  early_morning: { start: '06:00', end: '09:00' },
  morning: { start: '09:00', end: '12:00' },
  lunch: { start: '12:00', end: '14:00' },
  afternoon: { start: '14:00', end: '18:00' },
  evening: { start: '18:00', end: '22:00' },
};

/** "HH:MM" → minutes since midnight ("24:00" → 1440). */
export function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number) as [number, number];
  return h * 60 + m;
}

/** Minutes since midnight → "HH:MM". */
export function fromMinutes(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

/**
 * FR-002: the hours covered by one slot or several adjacent ones (Afternoon + Evening →
 * 14:00–22:00). Throws `NonAdjacentSlots` for an empty pick or a gap.
 */
export function slotsToRange(slots: readonly SlotKey[], slotTimes: SlotTimes = DEFAULT_SLOT_TIMES): { start: string; end: string } {
  const order = [...new Set(slots)].map((s) => SLOT_KEYS.indexOf(s)).sort((a, b) => a - b);
  if (order.length === 0) throw new CalendarError('NonAdjacentSlots', 'Pick at least one slot');
  if (order.some((index, i) => i > 0 && index !== (order[i - 1] as number) + 1)) {
    throw new CalendarError('NonAdjacentSlots', `Slots must be next to each other: ${slots.join(', ')}`);
  }
  const first = SLOT_KEYS[order[0] as number] as SlotKey;
  const last = SLOT_KEYS[order[order.length - 1] as number] as SlotKey;
  return { start: slotTimes[first].start, end: slotTimes[last].end };
}

/** Slots in day order, so the first one is the one the event starts in. */
export function sortSlots(slots: readonly SlotKey[]): SlotKey[] {
  return [...new Set(slots)].sort((a, b) => SLOT_KEYS.indexOf(a) - SLOT_KEYS.indexOf(b));
}

/** The slot that starts at this time, if any ("12:00" → lunch). */
export function slotStartingAt(time: string, slotTimes: SlotTimes = DEFAULT_SLOT_TIMES): SlotKey | null {
  return SLOT_KEYS.find((s) => slotTimes[s].start === time) ?? null;
}

/**
 * The slot a time falls in, for the day view's bands (spec 039): the slot holding it; before the
 * first slot, the first one; otherwise the last slot starting at or before it (after the evening,
 * Evening; in a gap between edited slot times, the slot before).
 */
export function slotAt(time: string, slotTimes: SlotTimes = DEFAULT_SLOT_TIMES): SlotKey {
  const at = toMinutes(time);
  const byStart = [...SLOT_KEYS].sort((a, b) => toMinutes(slotTimes[a].start) - toMinutes(slotTimes[b].start));
  const holding = byStart.find((s) => at >= toMinutes(slotTimes[s].start) && at < toMinutes(slotTimes[s].end));
  if (holding) return holding;
  return byStart.filter((s) => toMinutes(slotTimes[s].start) <= at).pop() ?? (byStart[0] as SlotKey);
}

type Timed = Pick<CalendarEvent, 'time_type' | 'slots' | 'start_time' | 'end_time'>;

/**
 * An event's hours on its day: from its slots (so they follow the family's slot times) or its
 * custom times; null for all-day events. Custom times must be set.
 */
export function timeRange(event: Timed, slotTimes: SlotTimes = DEFAULT_SLOT_TIMES): { start: string; end: string } | null {
  if (event.time_type === 'all_day') return null;
  if (event.time_type === 'slot') return slotsToRange(event.slots, slotTimes);
  if (!event.start_time || !event.end_time) throw new CalendarError('EndBeforeStart', 'A custom time needs a start and an end');
  return { start: event.start_time, end: event.end_time };
}
