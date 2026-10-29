import { addDays, daysBetween, occurrenceOn, sortSlots, splitSeries, weekday } from '@cocon/calendar';
import type { EventField } from '@cocon/schemas';
import type { EventInput, EventOverride, Recurrence } from '@cocon/schemas/calendar';
import type { Db } from './client';
import { deleteEvent, removeException, restoreEvent, saveEvent, saveException, splitEvent, type StoredEvent } from './events';

/**
 * Changing and deleting a repeating event's dates (specs 041, 042), shared by the app's sheets and
 * the MCP server's calendar tools (spec 044), so both change the same rows the same way.
 */

/**
 * The occurrence on the series date `date` (an event route's `?date=`), merged into the event so it
 * keeps the event's id, checklist and exceptions; null when that date isn't one of the event's,
 * is cancelled, or the event can't be placed. Spec 042 FR-001, spec 041's edit, spec 044's tools.
 */
export function eventOccurrence(event: StoredEvent, date: string): StoredEvent | null {
  try {
    const found = occurrenceOn(event, date, event.exceptions);
    // An override's type is checked by EventOverride, so it's one of the event types.
    return found ? { ...event, ...found, category: found.category as StoredEvent['category'] } : null;
  } catch {
    return null;
  }
}

/** A weekly repeat that doesn't fall on `date` starts on its first picked day after it. */
export function firstRepeatDay(date: string, recurrence: Recurrence | null | undefined): string {
  let day = date;
  if (recurrence?.weekdays?.length) while (!recurrence.weekdays.includes(weekday(day))) day = addDays(day, 1);
  return day;
}

/**
 * A saved event (or one occurrence of it, from `expand`) as Save sends it, moved to start on `date`
 * (its own start by default) and keeping its length. For the people who see it in full.
 */
export function inputFromEvent(event: StoredEvent, date: string = event.starts_on): EventInput {
  return {
    title: event.title,
    category: event.category,
    location: event.location,
    notes: event.notes,
    starts_on: date,
    ends_on: addDays(date, daysBetween(event.starts_on, event.ends_on)),
    ...timeOf(event),
    recurrence: event.recurrence ?? null,
    reminder: event.reminder ?? 'none',
    members: [...event.members],
    responsible_member_id: event.responsible_member_id ?? null,
    visibility: event.visibility,
    surprise: event.visibility === 'surprise' ? (event.surprise ?? null) : null,
    checklist: (event.checklist ?? []).map((c) => ({ id: c.id, label: c.label })),
  };
}

/** The time fields as stored: slots, custom times, or neither for all day. */
function timeOf(e: Pick<EventInput, 'time_type' | 'slots' | 'start_time' | 'end_time'>) {
  return {
    time_type: e.time_type,
    slots: e.time_type === 'slot' ? sortSlots(e.slots ?? []) : [],
    start_time: e.time_type === 'custom' ? (e.start_time ?? null) : null,
    end_time: e.time_type === 'custom' ? (e.end_time ?? null) : null,
  };
}

const same = (x: unknown, y: unknown) => JSON.stringify(x) === JSON.stringify(y);
const timeKey = (e: EventInput) => [e.time_type, e.slots ?? [], e.start_time ?? null, e.end_time ?? null];

/** `event_updated`'s field names: what the edit changed, never the values. */
export function changedFields(before: EventInput, after: EventInput): EventField[] {
  const fields: [EventField, unknown, unknown][] = [
    ['title', before.title, after.title],
    ['type', before.category ?? null, after.category ?? null],
    ['place', before.location ?? null, after.location ?? null],
    ['notes', before.notes ?? null, after.notes ?? null],
    ['date', [before.starts_on, before.ends_on], [after.starts_on, after.ends_on]],
    ['time', timeKey(before), timeKey(after)],
    ['who', [...before.members].sort(), [...after.members].sort()],
    ['responsible', before.responsible_member_id ?? null, after.responsible_member_id ?? null],
    ['repeat', before.recurrence ?? null, after.recurrence ?? null],
    ['reminder', before.reminder ?? 'none', after.reminder ?? 'none'],
    ['checklist', before.checklist?.map((c) => c.label) ?? [], after.checklist?.map((c) => c.label) ?? []],
  ];
  return fields.filter(([, x, y]) => !same(x, y)).map(([name]) => name);
}

/** "This event only": the changed fields an occurrence can replace (event_exceptions' override). */
export function overrideFor(before: EventInput, after: EventInput): EventOverride {
  const changed = new Set(changedFields(before, after));
  return {
    ...(changed.has('title') ? { title: after.title } : {}),
    ...(changed.has('type') ? { category: after.category ?? null } : {}),
    ...(changed.has('place') ? { location: after.location ?? null } : {}),
    ...(changed.has('notes') ? { notes: after.notes ?? null } : {}),
    ...(changed.has('date') ? { starts_on: after.starts_on, ends_on: after.ends_on } : {}),
    ...(changed.has('time') ? timeOf(after) : {}),
    ...(changed.has('who') ? { members: after.members } : {}),
    ...(changed.has('responsible') ? { responsible_member_id: after.responsible_member_id ?? null } : {}),
  };
}

/**
 * "All future events" from the occurrence `from` (its series date): the old series' new repeat and
 * the new series, which keeps what's left of the end. Null on the series' first date: edit it all.
 */
export function futureSplit(event: StoredEvent, from: string, after: EventInput): { before: Recurrence; input: EventInput } | null {
  const split = splitSeries(event, from);
  if (!split) return null;
  const recurrence = after.recurrence ? { ...after.recurrence, ends: after.recurrence.ends.type === event.recurrence?.ends.type && same(after.recurrence.ends, event.recurrence.ends) ? split.ends : after.recurrence.ends } : null;
  return { before: split.before, input: { ...after, recurrence } };
}

/** Which dates an edit changes: one date of a series, that date and after, or the whole event. */
export type ChangeScope = 'this' | 'future' | 'all';

/**
 * Saves an edit of `event` made from its occurrence on the series date `date` (spec 041). `before`
 * is that occurrence as the edit started; "this" saves only what changed as that date's exception
 * (on top of any earlier change to it); "future" splits the series there, or saves the whole event
 * on its first date. Returns what it changed ("all" for a one-off or a whole series).
 */
export async function saveEventChange(
  client: Pick<Db, 'from' | 'rpc'>,
  { event, date, scope, familyId, before, input }: { event: StoredEvent; date: string; scope: ChangeScope; familyId: string; before: EventInput; input: EventInput },
): Promise<ChangeScope> {
  if (scope === 'this') {
    const override = overrideFor(before, input);
    if (Object.keys(override).length === 0) return 'this';
    const existing = event.exceptions.find((x) => x.occurrence_date === date)?.override ?? {};
    await saveException(client, familyId, event.id, { occurrence_date: date, override: { ...existing, ...override } });
    return 'this';
  }
  const split = scope === 'future' ? futureSplit(event, date, input) : null;
  if (split) {
    await splitEvent(client, event.id, date, split.before, split.input);
    return 'future';
  }
  await saveEvent(client, input, event.id);
  return 'all';
}

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
 * Returns what it removed: "future" on the first date is "all".
 */
export async function deleteOccurrences(
  client: Pick<Db, 'from' | 'rpc'>,
  { event, date, scope, familyId }: { event: StoredEvent; date: string; scope: DeleteScope; familyId: string },
): Promise<{ scope: DeleteScope; undo: () => Promise<void> }> {
  if (scope === 'this') {
    const before = event.exceptions.find((x) => x.occurrence_date === date);
    await saveException(client, familyId, event.id, { occurrence_date: date, cancelled: true, override: before?.override ?? null });
    return { scope, undo: () => (before ? saveException(client, familyId, event.id, before) : removeException(client, event.id, date)) };
  }
  const split = scope === 'future' ? futureSplit(event, date, inputFromEvent(event, date)) : null;
  if (!split) {
    await deleteEvent(client, event.id);
    return { scope: 'all', undo: () => restoreEvent(client, event.id) };
  }
  const tail = await splitEvent(client, event.id, date, split.before, split.input);
  await deleteEvent(client, tail);
  return { scope: 'future', undo: () => restoreEvent(client, tail) };
}
