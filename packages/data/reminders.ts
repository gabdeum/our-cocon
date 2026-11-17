import { todayIn, zonedInstant } from '@cocon/calendar';
import { catchUp, complete, draftToFields, nextDueAfter, snoozeUntil, type ReminderRevert, type ReminderTiming } from '@cocon/reminders';
import { Recurrence, ReminderDraft, ReminderOccurrenceStatus, ReminderRollover, ReminderSection, ReminderSnoozeOption, TimeZone } from '@cocon/schemas';
import { z } from 'zod';
import type { Db } from './client';

// Spec 056: reminders, read and written the same way by the app (057, 058) and the MCP server
// (060). The database places them (late, sections, Home); `@cocon/reminders` moves them. Every
// read first closes the occurrences whose next date has come (FR-005), so the lists are right
// even when the notifier was down. `tz` is the family's home time zone, or the device's until one
// is set (as the app's event sheet does).

const Instant = z.iso.datetime({ offset: true });

const Stored = z.object({
  id: z.uuid(),
  title: z.string(),
  notes: z.string().nullable(),
  /** Null: Everyone. */
  assignee_id: z.uuid().nullable(),
  due_at: Instant,
  has_time: z.boolean(),
  repeat_rule: Recurrence.nullable(),
  repeat_from: z.iso.date().nullable(),
  next_due_at: Instant.nullable(),
  rollover: ReminderRollover,
  snoozed_until: Instant.nullable(),
  /** 'app' or the assistant's name. */
  source: z.string(),
  created_by: z.uuid().nullable(),
  created_at: Instant,
  updated_at: Instant,
});
export type StoredReminder = z.infer<typeof Stored>;

const Placed = Stored.extend({
  /** The day it's due, in the home time zone. */
  due_on: z.iso.date(),
  /** FR-006: when lateness counts from (the snooze's end, else the due time; never before it). */
  late_from: Instant,
  /** Whole hours and days late; 0 when it isn't (the badge: "3h late", "2d late"). */
  late_hours: z.int().min(0),
  late_days: z.int().min(0),
  section: ReminderSection,
  on_home: z.boolean(),
  sort_at: Instant,
});
/**
 * An open reminder as it stands now (FR-006, FR-008, FR-012). Its `snoozed_until` is when it's back
 * in the lists: a late "Next week" one reports its next weekday there without being snoozed (spec
 * 058), so never write it back as a snooze; writes take it from the stored row (`loadReminder`).
 */
export type PlacedReminder = z.infer<typeof Placed>;

const Home = z.object({ rows: z.array(Placed), more_today: z.int().min(0), snoozed: z.int().min(0) });
export interface RemindersHome {
  rows: PlacedReminder[];
  moreToday: number;
  snoozed: number;
}

export interface ReminderPage {
  rows: PlacedReminder[];
  /** Null when there's nothing more. */
  nextCursor: string | null;
}

const Occurrence = z.object({ due_at: Instant, status: ReminderOccurrenceStatus, closed_at: Instant, closed_by: z.uuid().nullable() });
export type ReminderOccurrence = z.infer<typeof Occurrence>;

const CATCH_UP_AT_ONCE = 10;
const PAGE = 20;
/** Overdue and Today show up to 50 on the first call (FR-012). */
const FIRST_PAGE = 50;
const STORED = 'id, title, notes, assignee_id, due_at, has_time, repeat_rule, repeat_from, next_due_at, rollover, snoozed_until, source, created_by, created_at, updated_at';
const Cursor = z.tuple([Instant, z.uuid()]);

function cursorOf(r: PlacedReminder): string {
  return `${r.sort_at}|${r.id}`;
}

function readCursor(cursor: string): [string, string] {
  const parsed = Cursor.safeParse(cursor.split('|'));
  if (!parsed.success) throw new Error('This list moved on. Pull to refresh.');
  return parsed.data;
}

async function apply(client: Pick<Db, 'rpc'>, id: string, change: ReturnType<typeof complete>): Promise<boolean> {
  const { data, error } = await client.rpc('reminder_apply', {
    p_id: id,
    p_from_due_at: change.from_due_at,
    p_closed: change.closed,
    p_due_at: change.due_at,
    p_complete: change.complete,
    p_next_due_at: change.next_due_at ?? undefined,
    p_snoozed_until: change.snoozed_until ?? undefined,
  });
  if (error) throw error;
  return data === true;
}

/**
 * FR-005: closes what was missed (or skipped while snoozed) on every repeating reminder whose next
 * date has come, and moves it on. Another phone doing the same at once changes nothing twice.
 * Returns how many occurrences were missed (spec 059 counts them).
 */
export async function catchUpReminders(client: Pick<Db, 'from' | 'rpc'>, tz: string, now: Date = new Date()): Promise<number> {
  const zone = TimeZone.parse(tz);
  const { data, error } = await client
    .from('reminders')
    .select(STORED)
    .lte('next_due_at', now.toISOString())
    .is('deleted_at', null)
    .is('completed_at', null)
    .limit(200);
  if (error) throw error;
  const changes = z
    .array(Stored)
    .parse(data ?? [])
    .flatMap((row) => {
      const change = catchUp(row, now, zone);
      return change ? [{ id: row.id, change }] : [];
    });
  let missed = 0;
  // A few at a time: after a long time away, many repeats can be due at once.
  for (let i = 0; i < changes.length; i += CATCH_UP_AT_ONCE) {
    const batch = changes.slice(i, i + CATCH_UP_AT_ONCE);
    const saved = await Promise.all(batch.map(({ id, change }) => apply(client, id, change)));
    batch.forEach(({ change }, k) => {
      if (saved[k]) missed += change.closed.filter((c) => c.status === 'missed').length;
    });
  }
  return missed;
}

/** FR-012 Home: the first three, how many more are on Home today, and how many are snoozed. */
export async function loadRemindersHome(client: Pick<Db, 'from' | 'rpc'>, tz: string): Promise<RemindersHome> {
  await catchUpReminders(client, tz);
  const { data, error } = await client.rpc('reminders_home', { p_tz: TimeZone.parse(tz) });
  if (error) throw error;
  const home = Home.parse(data);
  return { rows: home.rows, moreToday: home.more_today, snoozed: home.snoozed };
}

/**
 * FR-012: a page of one section of the Reminders screen. "Mine" is the caller's and Everyone's.
 * Pass the page's `nextCursor` back for the next one.
 */
export async function loadReminderSection(
  client: Pick<Db, 'from' | 'rpc'>,
  options: { section: ReminderSection; mine: boolean; tz: string; cursor?: string | null; caughtUp?: boolean },
): Promise<ReminderPage> {
  const section = ReminderSection.parse(options.section);
  const after = options.cursor ? readCursor(options.cursor) : null;
  // A screen loading several sections at once catches up once first and passes `caughtUp`.
  if (!after && !options.caughtUp) await catchUpReminders(client, options.tz);
  const limit = !after && (section === 'overdue' || section === 'today') ? FIRST_PAGE : PAGE;
  const { data, error } = await client.rpc('reminders_section', {
    p_section: section,
    p_mine: options.mine,
    p_limit: limit + 1,
    p_after_sort: after?.[0],
    p_after_id: after?.[1],
    p_tz: TimeZone.parse(options.tz),
  });
  if (error) throw error;
  const rows = z.array(Placed).parse(data ?? []);
  const page = rows.slice(0, limit);
  const last = page.at(-1);
  return { rows: page, nextCursor: rows.length > limit && last ? cursorOf(last) : null };
}

/** Whether the family has any open reminder, snoozed or not (Home hides its card otherwise, spec 057). */
export async function hasOpenReminders(client: Pick<Db, 'from'>): Promise<boolean> {
  const { data, error } = await client.from('reminders').select('id').is('deleted_at', null).is('completed_at', null).limit(1);
  if (error) throw error;
  return data.length > 0;
}

/** FR-012 for the calendar: open reminders that touch `from`–`to` (repeats are expanded by the caller). */
export async function loadRemindersInRange(client: Pick<Db, 'from' | 'rpc'>, from: string, to: string, tz: string): Promise<PlacedReminder[]> {
  await catchUpReminders(client, tz);
  const { data, error } = await client.rpc('reminders_in_range', { p_from: z.iso.date().parse(from), p_to: z.iso.date().parse(to), p_tz: TimeZone.parse(tz) });
  if (error) throw error;
  return z.array(Placed).parse(data ?? []);
}

/** FR-002: a reminder's closed occurrences, latest first. */
export async function loadReminderHistory(client: Pick<Db, 'from'>, id: string, limit = 20): Promise<ReminderOccurrence[]> {
  const { data, error } = await client
    .from('reminder_occurrences')
    .select('due_at, status, closed_at, closed_by')
    .eq('reminder_id', z.uuid().parse(id))
    .order('due_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return z.array(Occurrence).parse(data ?? []);
}

/** One reminder as stored (the edit sheet, spec 057). Throws when it was deleted. */
export async function loadReminder(client: Pick<Db, 'from'>, id: string): Promise<StoredReminder & { completed: boolean }> {
  const { data, error } = await client.from('reminders').select(`${STORED}, completed_at`).eq('id', z.uuid().parse(id)).is('deleted_at', null).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('This reminder was deleted.');
  return { ...Stored.parse(data), completed: data.completed_at !== null };
}

/** A new reminder (FR-001; the app's sheet and assistants). Returns its id. */
export async function createReminder(client: Pick<Db, 'from'>, familyId: string, draft: unknown, tz: string): Promise<string> {
  const fields = draftToFields(ReminderDraft.parse(draft), TimeZone.parse(tz));
  const { data, error } = await client.from('reminders').insert({ ...fields, family_id: z.uuid().parse(familyId) }).select('id').single();
  if (error) throw error;
  return data.id;
}

/** Saves an edited reminder, whole. Its history stays; a snooze stays too. */
export async function updateReminder(client: Pick<Db, 'from'>, id: string, draft: unknown, tz: string): Promise<void> {
  const fields = draftToFields(ReminderDraft.parse(draft), TimeZone.parse(tz));
  const { error } = await client.from('reminders').update(fields).eq('id', z.uuid().parse(id)).is('deleted_at', null);
  if (error) throw error;
}

export interface CompletedReminder {
  repeating: boolean;
  /** For Undo (`undoCompleteReminder`), within the session. */
  undo: ReminderRevert & { id: string };
  /** The next date's due time, for "Next one: Mon, Nov 16." (null when there's none). */
  nextDueAt: string | null;
}

/**
 * FR-004 Done, from the reminder as it is now (caught up first, so a late tick closes the right
 * occurrence). A reminder someone else just ticked is left as they left it.
 */
export async function completeReminder(client: Pick<Db, 'from' | 'rpc'>, id: string, tz: string, now: Date = new Date()): Promise<CompletedReminder | null> {
  const zone = TimeZone.parse(tz);
  for (let attempt = 0; attempt < 2; attempt++) {
    let row: ReminderTiming & { next_due_at: string | null; completed: boolean } = await loadReminder(client, id);
    if (row.completed) return null;
    const missed = catchUp(row, now, zone);
    if (missed) {
      if (!(await apply(client, id, missed))) continue;
      row = { ...row, due_at: missed.due_at, next_due_at: missed.next_due_at, snoozed_until: missed.snoozed_until };
    }
    const change = complete(row, zone);
    if (!(await apply(client, id, change))) continue;
    return {
      repeating: row.repeat_rule !== null,
      undo: { id, from_due_at: change.due_at, reopen: change.closed.map((c) => c.due_at), due_at: row.due_at, next_due_at: row.next_due_at, snoozed_until: row.snoozed_until },
      nextDueAt: change.complete ? null : change.due_at,
    };
  }
  throw new Error("Couldn't save. Try again.");
}

/** A reminder done today (spec 058): Today keeps it, struck through, until midnight. */
export interface DoneReminder {
  /** As it was when ticked: the occurrence's due time, placed in Today, not late. */
  row: PlacedReminder;
  closedAt: string;
  /**
   * Unticking it: back to the occurrence that was done (false from `undoCompleteReminder` if it
   * moved on since). Null for a repeat's earlier date when a later one was done after it.
   */
  undo: CompletedReminder['undo'] | null;
}

const DoneOccurrence = z.object({ reminder_id: z.uuid(), due_at: Instant, closed_at: Instant });
const DONE_AT_ONCE = 100;
/** A tick writes the reminder and its occurrence together; anything later than this changed it since. */
const SAME_WRITE_MS = 2000;
const unchangedSince = (r: Pick<StoredReminder, 'updated_at' | 'snoozed_until'>, closedAt: string) =>
  r.snoozed_until === null && Date.parse(r.updated_at) - Date.parse(closedAt) <= SAME_WRITE_MS;

/**
 * Spec 058: what was ticked today (in `tz`), latest last: each repeat's done occurrence, and one-offs
 * completed today (at most 100 of each, the latest). Deleted ones are left out. Undo is offered only
 * while nobody changed the reminder since the tick (a snooze, an edit, a later date done or missed),
 * so reopening never overwrites someone else's change.
 */
export async function loadRemindersDoneToday(client: Pick<Db, 'from'>, tz: string, now: Date = new Date()): Promise<DoneReminder[]> {
  const zone = TimeZone.parse(tz);
  const since = zonedInstant(todayIn(zone, now), '00:00', zone).toISOString();
  const [occurrences, oneOffs] = await Promise.all([
    client.from('reminder_occurrences').select('reminder_id, due_at, closed_at').eq('status', 'done').gte('closed_at', since).order('closed_at', { ascending: false }).limit(DONE_AT_ONCE),
    client.from('reminders').select(`${STORED}, completed_at`).gte('completed_at', since).is('repeat_rule', null).is('deleted_at', null).order('completed_at', { ascending: false }).limit(DONE_AT_ONCE),
  ]);
  if (occurrences.error) throw occurrences.error;
  if (oneOffs.error) throw oneOffs.error;
  const done = z.array(DoneOccurrence).parse(occurrences.data ?? []);
  const ids = [...new Set(done.map((o) => o.reminder_id))];
  const repeats = ids.length ? await client.from('reminders').select(STORED).in('id', ids).is('deleted_at', null) : { data: [], error: null };
  if (repeats.error) throw repeats.error;
  const byId = new Map(z.array(Stored).parse(repeats.data ?? []).map((r) => [r.id, r]));

  const placed = (r: StoredReminder, dueAt: string, closedAt: string): PlacedReminder => ({
    ...r,
    due_at: dueAt,
    due_on: todayIn(zone, new Date(dueAt)),
    late_from: dueAt,
    late_hours: 0,
    late_days: 0,
    section: 'today',
    on_home: false,
    sort_at: closedAt,
  });
  const fromRepeats = done.flatMap((o): DoneReminder[] => {
    const r = byId.get(o.reminder_id);
    if (!r) return [];
    // Reopenable while the reminder still sits on the date right after this one (or on it, the last
    // date, completed) and nothing changed it since.
    const next = nextDueAfter(r, o.due_at, zone);
    // Instants compared as times: the rules write "…Z", the database answers "…+00:00".
    const inPlace = Date.parse(r.due_at) === Date.parse(o.due_at) || (next !== null && Date.parse(next) === Date.parse(r.due_at));
    const undo = inPlace && unchangedSince(r, o.closed_at) ? { id: r.id, from_due_at: r.due_at, reopen: [o.due_at], due_at: o.due_at, next_due_at: Date.parse(r.due_at) === Date.parse(o.due_at) ? null : r.due_at, snoozed_until: null } : null;
    return [{ row: placed(r, o.due_at, o.closed_at), closedAt: o.closed_at, undo }];
  });
  const fromOneOffs = z
    .array(Stored.extend({ completed_at: Instant }))
    .parse(oneOffs.data ?? [])
    .map(({ completed_at, ...r }): DoneReminder => ({
      row: placed(r, r.due_at, completed_at),
      closedAt: completed_at,
      undo: unchangedSince(r, completed_at) ? { id: r.id, from_due_at: r.due_at, reopen: [], due_at: r.due_at, next_due_at: null, snoozed_until: null } : null,
    }));
  return [...fromRepeats, ...fromOneOffs].sort((a, b) => a.closedAt.localeCompare(b.closedAt));
}

/** Undo of a Done (FR-004). False when the reminder changed since (it's then left alone). */
export async function undoCompleteReminder(client: Pick<Db, 'rpc'>, undo: CompletedReminder['undo']): Promise<boolean> {
  const { data, error } = await client.rpc('reminder_revert', {
    p_id: undo.id,
    p_from_due_at: undo.from_due_at,
    p_reopen: undo.reopen,
    p_due_at: undo.due_at,
    p_next_due_at: undo.next_due_at ?? undefined,
    p_snoozed_until: undo.snoozed_until ?? undefined,
  });
  if (error) throw error;
  return data === true;
}

/**
 * FR-007 Snooze: hides the reminder until the chosen time; its due date doesn't change. Returns
 * when it comes back, and the snooze it had (for Undo with `setReminderSnooze`).
 */
export async function snoozeReminder(
  client: Pick<Db, 'from'>,
  id: string,
  option: ReminderSnoozeOption,
  tz: string,
  options: { now?: Date; picked?: string } = {},
): Promise<{ until: string; previous: string | null }> {
  const row = await loadReminder(client, id);
  const until = snoozeUntil(ReminderSnoozeOption.parse(option), row, options.now ?? new Date(), TimeZone.parse(tz), options.picked);
  await setReminderSnooze(client, id, until);
  return { until, previous: row.snoozed_until };
}

/** Sets or clears a snooze (Undo of a snooze). */
export async function setReminderSnooze(client: Pick<Db, 'from'>, id: string, until: string | null): Promise<void> {
  const { error } = await client.from('reminders').update({ snoozed_until: until === null ? null : Instant.parse(until) }).eq('id', z.uuid().parse(id));
  if (error) throw error;
}

/** FR-013: deletes the reminder, and the whole series of a repeating one (30 days to restore). */
export async function deleteReminder(client: Pick<Db, 'from'>, id: string, deleted = true): Promise<void> {
  const { error } = await client
    .from('reminders')
    .update({ deleted_at: deleted ? new Date().toISOString() : null })
    .eq('id', z.uuid().parse(id));
  if (error) throw error;
}

const Deleted = z.object({ id: z.uuid(), title: z.string(), deleted_at: Instant, deleted_by: z.uuid().nullable() });
export type DeletedReminder = z.infer<typeof Deleted>;

/** Reminders deleted since `since`, newest first (Recently deleted, spec 057). */
export async function loadDeletedReminders(client: Pick<Db, 'from'>, since: string): Promise<DeletedReminder[]> {
  const { data, error } = await client
    .from('reminders')
    .select('id, title, deleted_at, deleted_by')
    .not('deleted_at', 'is', null)
    .gt('deleted_at', Instant.parse(since))
    .order('deleted_at', { ascending: false })
    .order('id');
  if (error) throw error;
  return z.array(Deleted).parse(data);
}

/** Removes a deleted reminder for good, with its history (the database only removes deleted ones). */
export async function deleteReminderNow(client: Pick<Db, 'from'>, id: string): Promise<void> {
  const { data, error } = await client.from('reminders').delete().eq('id', z.uuid().parse(id)).not('deleted_at', 'is', null).select('id');
  if (error) throw error;
  if (data.length === 0) throw new Error('reminder_not_found');
}
