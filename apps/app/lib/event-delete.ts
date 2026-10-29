import { deleteOccurrences as deleteDates, saveEvent, undoCreateEvent, type StoredEvent } from '@cocon/data';
import type { EventInput } from '@cocon/schemas';
import { draftFromEvent, toInput } from './event-form';
import type { Member } from './session';
import type { Client } from './supabase';

export type { DeleteScope } from '@cocon/data';

/** Spec 042 FR-004: deletes the dates `scope` covers (the rule lives in @cocon/data) and returns the Undo. */
export async function deleteOccurrences(client: Pick<Client, 'from' | 'rpc'>, args: Parameters<typeof deleteDates>[1]): Promise<() => Promise<void>> {
  return (await deleteDates(client, args)).undo;
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
