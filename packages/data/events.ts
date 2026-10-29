import { DEFAULT_SLOT_TIMES, assertValidEvent, type CalendarEvent, type EventException, type SlotTimes } from '@cocon/calendar';
import {
  CalendarDate,
  EventCategory,
  EventException as EventExceptionSchema,
  EventInput,
  EventMember,
  Recurrence,
  Reminder,
  SlotKey,
  SlotTimes as SlotTimesSchema,
  SurpriseCover,
  TimeType,
  Visibility,
} from '@cocon/schemas';
import { z } from 'zod';
import type { Db } from './client';

/** A checklist item, as the people who see the event's details get it. */
export interface ChecklistItem {
  id: string;
  position: number;
  label: string;
  done: boolean;
  /** The member who ticked it. */
  done_by: string | null;
}

/**
 * An event as `events_visible` gives it to the caller (spec 035 FR-002): already masked by the
 * database, ready for `@cocon/calendar`'s `expand` (with `exceptions`) and `viewFor`. Private and
 * hidden surprise events come with no details (`checklist` null).
 */
export interface StoredEvent extends CalendarEvent {
  category: EventCategory | null;
  location: string | null;
  notes: string | null;
  reminder: Reminder | null;
  /** Names of members who were removed from the family since, shown grey (032-later L78). */
  removed_members: string[];
  exceptions: EventException[];
  checklist: ChecklistItem[] | null;
  created_by: string | null;
  updated_by: string | null;
  /** 'app' or the assistant's name ("Added via Claude"). */
  source: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  /** Who deleted it (Recently deleted, spec 042). */
  deleted_by?: string | null;
}

const Row = z.object({
  id: z.uuid(),
  title: z.string(),
  category: EventCategory.nullable(),
  location: z.string().nullable(),
  notes: z.string().nullable(),
  starts_on: CalendarDate,
  ends_on: CalendarDate,
  time_type: TimeType,
  slots: z.array(SlotKey),
  start_time: z.string().nullable(),
  end_time: z.string().nullable(),
  recurrence: Recurrence.nullable(),
  reminder: Reminder.nullable(),
  responsible_member_id: z.uuid().nullable(),
  visibility: Visibility,
  // Null when the creator has left the family: `viewFor` then shows a hidden event as Busy.
  creator_member_id: z.uuid().nullable().transform((id) => id ?? ''),
  members: z.array(EventMember),
  removed_members: z.array(z.string()),
  exceptions: z.array(EventExceptionSchema),
  checklist: z.array(z.object({ id: z.uuid(), position: z.int(), label: z.string(), done: z.boolean(), done_by: z.uuid().nullable() })).nullable(),
  surprise: SurpriseCover.nullable(),
  created_by: z.uuid().nullable(),
  updated_by: z.uuid().nullable(),
  source: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable(),
  deleted_by: z.uuid().nullable().default(null),
});

/** Parses one `events_visible` row. */
export function storedEvent(row: unknown): StoredEvent {
  return Row.parse(row);
}

/**
 * The family's events that touch the days `from`–`to` (inclusive), as the caller may see them:
 * one-off events in range, and every repeating event that started by `to` (`expand` places them).
 * Deleted events (Recently deleted) are left out.
 */
export async function loadEvents(client: Pick<Db, 'from'>, from: string, to: string): Promise<StoredEvent[]> {
  const range = z.tuple([CalendarDate, CalendarDate]).parse([from, to]);
  const { data, error } = await client
    .from('events_visible')
    .select('*')
    .is('deleted_at', null)
    .lte('starts_on', range[1])
    .or(`ends_on.gte.${range[0]},recurrence.not.is.null`)
    .order('starts_on')
    .order('id');
  if (error) throw error;
  return data.map(storedEvent);
}

/** One event, deleted or not, as the caller may see it; null when there's none. */
export async function loadEvent(client: Pick<Db, 'from'>, id: string): Promise<StoredEvent | null> {
  const { data, error } = await client.from('events_visible').select('*').eq('id', z.uuid().parse(id)).maybeSingle();
  if (error) throw error;
  return data ? storedEvent(data) : null;
}

/**
 * Saves a whole event (FR-005): a new one without `id`. Checked with the shared schema and the
 * calendar engine first (adjacent slots, a valid repeat), then saved in one go with who it's for,
 * its surprise and its checklist. The database stamps who saved it and through what (FR-004).
 * Returns the event's id.
 */
export async function saveEvent(client: Pick<Db, 'rpc'>, input: unknown, id?: string): Promise<string> {
  const { members, surprise, checklist, ...fields } = EventInput.parse(input);
  const event = { ...fields, slots: fields.slots ?? [], visibility: fields.visibility ?? 'family' };
  assertValidEvent({ ...event, id: id ?? 'new', members, creator_member_id: '' });
  const { data, error } = await client.rpc('save_event', {
    p_event: event,
    p_members: members,
    ...(id ? { p_id: z.uuid().parse(id) } : {}),
    ...(surprise ? { p_surprise: surprise } : {}),
    ...(checklist ? { p_checklist: checklist } : {}),
  });
  if (error) throw error;
  return data;
}

/**
 * Spec 041 "All future events": the series `id` ends the day before `from` (`before`, from the
 * engine's `splitSeries`), and `input` is saved as a new series from `from`, in one go; the old
 * series' exceptions from then on move to it. Checked like `saveEvent`. Returns the new id.
 */
export async function splitEvent(client: Pick<Db, 'rpc'>, id: string, from: string, before: unknown, input: unknown): Promise<string> {
  const { members, surprise, checklist, ...fields } = EventInput.parse(input);
  const event = { ...fields, slots: fields.slots ?? [], visibility: fields.visibility ?? 'family' };
  assertValidEvent({ ...event, id: 'new', members, creator_member_id: '' });
  const { data, error } = await client.rpc('split_event', {
    p_id: z.uuid().parse(id),
    p_from: CalendarDate.parse(from),
    p_before: Recurrence.parse(before),
    p_event: event,
    p_members: members,
    ...(surprise ? { p_surprise: surprise } : {}),
    ...(checklist ? { p_checklist: checklist } : {}),
  });
  if (error) throw error;
  return data;
}

/**
 * Spec 042: the events deleted since `since` (an ISO time: 30 days ago for Recently deleted),
 * newest first, as the caller may see them.
 */
export async function loadDeletedEvents(client: Pick<Db, 'from'>, since: string): Promise<StoredEvent[]> {
  const { data, error } = await client
    .from('events_visible')
    .select('*')
    .not('deleted_at', 'is', null)
    .gt('deleted_at', z.iso.datetime({ offset: true }).parse(since))
    .order('deleted_at', { ascending: false })
    .order('id');
  if (error) throw error;
  return data.map(storedEvent);
}

/**
 * A "this event only" change or cancellation (spec 034). Strict (032-later L80): an occurrence
 * can't change who created the event, who can see it or its surprise.
 */
export async function saveException(client: Pick<Db, 'from'>, familyId: string, eventId: string, exception: unknown): Promise<void> {
  const x = EventExceptionSchema.parse(exception);
  const { error } = await client.from('event_exceptions').upsert(
    { family_id: familyId, event_id: z.uuid().parse(eventId), occurrence_date: x.occurrence_date, cancelled: x.cancelled ?? false, override: x.override ?? null },
    { onConflict: 'event_id,occurrence_date' },
  );
  if (error) throw error;
}

/** Undoes a "this event only" change: the occurrence is back to the series. */
export async function removeException(client: Pick<Db, 'from'>, eventId: string, occurrenceDate: string): Promise<void> {
  const { error } = await client.from('event_exceptions').delete().eq('event_id', z.uuid().parse(eventId)).eq('occurrence_date', CalendarDate.parse(occurrenceDate));
  if (error) throw error;
}

/** Moves an event to Recently deleted for 30 days (spec 018), or brings it back with its repeat and exceptions. */
async function setDeleted(client: Pick<Db, 'from'>, id: string, deleted: boolean): Promise<void> {
  const { data, error } = await client
    .from('events')
    .update({ deleted_at: deleted ? new Date().toISOString() : null })
    .eq('id', z.uuid().parse(id))
    .select('id');
  if (error) throw error;
  if (data.length === 0) throw new Error('event_not_found');
}
export const deleteEvent = (client: Pick<Db, 'from'>, id: string) => setDeleted(client, id, true);
export const restoreEvent = (client: Pick<Db, 'from'>, id: string) => setDeleted(client, id, false);

/** Recently deleted's "Delete now" (spec 042): a deleted event, removed for good. */
export async function deleteEventNow(client: Pick<Db, 'from'>, id: string): Promise<void> {
  const { data, error } = await client.from('events').delete().eq('id', z.uuid().parse(id)).not('deleted_at', 'is', null).select('id');
  if (error) throw error;
  if (data.length === 0) throw new Error('event_not_found');
}

/**
 * Spec 041 FR-009: Undo right after adding. Deleted, then removed for good (the database only
 * removes deleted events), so it leaves no trace in Recently deleted.
 */
export async function undoCreateEvent(client: Pick<Db, 'from'>, id: string): Promise<void> {
  await setDeleted(client, id, true);
  const { error } = await client.from('events').delete().eq('id', z.uuid().parse(id)).not('deleted_at', 'is', null);
  if (error) throw error;
}

/** Ticks or unticks a checklist item; the database records who ticked it. */
export async function setChecklistDone(client: Pick<Db, 'from'>, itemId: string, done: boolean): Promise<void> {
  const { error } = await client.from('event_checklist_items').update({ done }).eq('id', z.uuid().parse(itemId));
  if (error) throw error;
}

export interface CalendarSettings {
  slotTimes: SlotTimes;
  /** Null until the first device sets it (claim_home_time_zone). */
  homeTimeZone: string | null;
}

/** The family's slot times (the engine's defaults until the owner changes them, spec 029) and home time zone. */
export async function loadCalendarSettings(client: Pick<Db, 'from'>): Promise<CalendarSettings> {
  const { data, error } = await client.from('family_calendar_settings').select('slot_times, home_time_zone').maybeSingle();
  if (error) throw error;
  return {
    slotTimes: data?.slot_times ? SlotTimesSchema.parse(data.slot_times) : DEFAULT_SLOT_TIMES,
    homeTimeZone: data?.home_time_zone ?? null,
  };
}
