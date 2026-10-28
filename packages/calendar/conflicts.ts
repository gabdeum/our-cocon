import type { EventMember, SlotKey } from '@cocon/schemas/calendar';
import { DEFAULT_SLOT_TIMES, fromMinutes, slotAt, timeRange, toMinutes } from './slots';
import type { CalendarEvent, SlotTimes } from './types';

type Timed = Pick<CalendarEvent, 'starts_on' | 'ends_on' | 'time_type' | 'slots' | 'start_time' | 'end_time' | 'members'>;

/** The event being added or edited; `id` (when editing) keeps it from conflicting with itself. */
export type ConflictDraft = Timed & { id?: string | null };

/** Everyone counts as every member; Others are no one in particular, so they never clash. */
function shareMember(a: readonly EventMember[], b: readonly EventMember[]): boolean {
  const named = (list: readonly EventMember[]) => list.filter((m) => m !== 'others');
  const x = named(a);
  const y = named(b);
  if (x.length === 0 || y.length === 0) return false;
  if (x.includes('everyone') || y.includes('everyone')) return true;
  return x.some((m) => y.includes(m));
}

/**
 * FR-006: the first event (earliest start) that shares a time with one of the draft's members on
 * one of the draft's days, for the soft warning in spec 041; null when there is none. Pass the day's
 * occurrences after `viewFor`, so the warning names a private event "Busy" and a surprise by its
 * cover. All-day events never conflict: a birthday or a trip doesn't clash with the school run.
 */
export function findConflict<T extends Timed & { id: string }>(draft: ConflictDraft, events: readonly T[], slotTimes: SlotTimes = DEFAULT_SLOT_TIMES): T | null {
  const range = timeRange(draft, slotTimes);
  if (!range) return null;
  const start = toMinutes(range.start);
  const end = toMinutes(range.end);
  let first: { event: T; start: number } | null = null;
  for (const event of events) {
    if (event.id === draft.id) continue;
    const other = timeRange(event, slotTimes);
    if (!other || event.starts_on > draft.ends_on || event.ends_on < draft.starts_on) continue;
    const otherStart = toMinutes(other.start);
    if (otherStart >= end || toMinutes(other.end) <= start || !shareMember(draft.members, event.members)) continue;
    if (!first || otherStart < first.start) first = { event, start: otherStart };
  }
  return first?.event ?? null;
}

/** Who the conflict line names: you, a member's id, or Everyone. */
export type ConflictWho = 'me' | 'everyone' | (string & {});

/**
 * The person and slot spec 041's warning names ("{Name} already has {title} this {slot}."): you
 * when you're on both, otherwise the first member they share (Everyone on both: "everyone"); the
 * slot is the draft's slot where the clash starts. `other` is what `findConflict` returned.
 */
export function conflictWho(draft: ConflictDraft, other: Timed, myMemberId: string, slotTimes: SlotTimes = DEFAULT_SLOT_TIMES): { who: ConflictWho; slot: SlotKey } {
  const named = (list: readonly EventMember[]) => list.filter((m) => m !== 'others');
  const mine = named(draft.members);
  const theirs = named(other.members);
  const shared = mine.includes('everyone') ? theirs : theirs.includes('everyone') ? mine : mine.filter((m) => theirs.includes(m));
  const who = shared.includes(myMemberId) || (shared.includes('everyone') && mine.includes(myMemberId)) ? 'me' : (shared[0] ?? 'everyone');
  const a = timeRange(draft, slotTimes);
  const b = timeRange(other, slotTimes);
  const start = Math.max(a ? toMinutes(a.start) : 0, b ? toMinutes(b.start) : 0);
  return { who, slot: slotAt(fromMinutes(start), slotTimes) };
}
