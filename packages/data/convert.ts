import type { Db } from './client';
import { deleteOccurrences, type DeleteScope } from './event-changes';
import { saveEvent, undoCreateEvent, type StoredEvent } from './events';
import { createReminder, deleteReminder, deleteReminderNow } from './reminders';

/**
 * Moving an event to the reminders, or a reminder to the calendar, from the edit sheet's switch
 * (Gabriel, 2026-11-25): the new one is created first, then the old one deleted, so a failure
 * never loses either. Undo deletes the new one for good and brings the old one back.
 */

/** A created reminder that's no longer wanted: gone for good, with no trace in Recently deleted. */
async function removeReminder(client: Pick<Db, 'from'>, id: string): Promise<void> {
  await deleteReminder(client, id);
  await deleteReminderNow(client, id);
}

/**
 * The event's dates `scope` covers (as Delete takes them: one date, all future, or all) become the
 * reminder `draft`.
 */
export async function convertEventToReminder(
  client: Pick<Db, 'from' | 'rpc'>,
  { event, date, scope, familyId, draft, tz }: { event: StoredEvent; date: string; scope: DeleteScope; familyId: string; draft: unknown; tz: string },
): Promise<{ id: string; undo: () => Promise<void> }> {
  const id = await createReminder(client, familyId, draft, tz);
  let removed: Awaited<ReturnType<typeof deleteOccurrences>>;
  try {
    removed = await deleteOccurrences(client, { event, date, scope, familyId });
  } catch (e) {
    await removeReminder(client, id).catch(() => undefined);
    throw e;
  }
  return {
    id,
    undo: async () => {
      await removed.undo();
      await removeReminder(client, id);
    },
  };
}

/** The reminder (and its whole series) becomes the event `input`. */
export async function convertReminderToEvent(
  client: Pick<Db, 'from' | 'rpc'>,
  { reminderId, input }: { reminderId: string; input: unknown },
): Promise<{ id: string; undo: () => Promise<void> }> {
  const id = await saveEvent(client, input);
  try {
    await deleteReminder(client, reminderId);
  } catch (e) {
    await undoCreateEvent(client, id).catch(() => undefined);
    throw e;
  }
  return {
    id,
    undo: async () => {
      await deleteReminder(client, reminderId, false);
      await undoCreateEvent(client, id);
    },
  };
}
