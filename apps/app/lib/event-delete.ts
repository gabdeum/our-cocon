import { deleteEvent, removeException, restoreEvent, saveEvent, saveException, splitEvent, undoCreateEvent, type StoredEvent } from '@cocon/data';
import type { EventInput } from '@cocon/schemas';
import { draftFromEvent, futureSplit, toInput } from './event-form';
import type { Member } from './session';
import type { Client } from './supabase';

/** What a delete removed (`event_deleted`'s scope): one date, that date and after, or the whole event. */
export type DeleteScope = 'this' | 'future' | 'all';

/**
 * Spec 042 FR-004: deletes the event `event` (the series, as loaded) for `scope` from its series
 * date `date`, and returns the Undo. Whole events go to Recently deleted for 30 days (spec 018).
 * - "all": the event is deleted.
 * - "this": that date is cancelled, keeping any change made to it, so Undo puts it back as it was.
 * - "future": the series is split at `date` (as "All future events" edits it) and the new part
 *   deleted, so those dates sit in Recently deleted under the event's title; on the series' first
 *   date, the whole event is.
 */
export async function deleteOccurrences(
  client: Pick<Client, 'from' | 'rpc'>,
  { event, date, scope, familyId, members }: { event: StoredEvent; date: string; scope: DeleteScope; familyId: string; members: readonly Member[] },
): Promise<() => Promise<void>> {
  if (scope === 'this') {
    const before = event.exceptions.find((x) => x.occurrence_date === date);
    await saveException(client, familyId, event.id, { occurrence_date: date, cancelled: true, override: before?.override ?? null });
    return () => (before ? saveException(client, familyId, event.id, before) : removeException(client, event.id, date));
  }
  const split = scope === 'future' ? futureSplit(event, date, toInput(draftFromEvent(event, date), members)) : null;
  if (!split) {
    await deleteEvent(client, event.id);
    return () => restoreEvent(client, event.id);
  }
  const tail = await splitEvent(client, event.id, date, split.before, split.input);
  await deleteEvent(client, tail);
  return () => restoreEvent(client, tail);
}

/**
 * FR-003 Duplicate: the occurrence `o` copied to the day `date` as a one-off event, with its time,
 * people, place, notes and checklist (unticked). The copy's first day is `date`; it keeps its length.
 */
export function duplicateInput(o: StoredEvent, date: string, members: readonly Member[]): EventInput {
  const draft = draftFromEvent(o, o.starts_on);
  return toInput({ ...draft, date, repeat: 'never', checklist: draft.checklist.map((c) => ({ label: c.label })) }, members);
}

/** Saves the copy and returns its Undo, which removes it for good (as the add sheet's toast does). */
export async function duplicateEvent(client: Pick<Client, 'from' | 'rpc'>, input: EventInput): Promise<{ id: string; undo: () => Promise<void> }> {
  const id = await saveEvent(client, input);
  return { id, undo: () => undoCreateEvent(client, id) };
}
