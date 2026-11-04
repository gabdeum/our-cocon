import {
  DEFAULT_SLOT_TIMES,
  addDays,
  reminderText,
  remindersDue,
  uses24h,
  type DueReminder,
  type ReminderEvent,
  type ReminderFamily,
  type ReminderMember,
  type ReminderRecipient,
} from '@cocon/calendar';
import { prefsOf, type Notifier, type ServiceDb } from '@cocon/notify';
import { CalendarDate, EventException, EventMember, PushPayload, Recurrence, Reminder, SlotKey, SlotTimes, TimeFormatSetting, TimeType, Visibility, type Tracker } from '@cocon/schemas';
import { z } from 'zod';

/**
 * Spec 049: event reminders. Every minute, the reminders due now (FR-002, FR-005), claimed in
 * `reminder_deliveries` so a member never gets one twice (SC-003), then sent to their phones.
 * A claim comes before the send: if the worker stops in between, one reminder is lost rather
 * than sent twice.
 */

const Candidate = z.object({
  id: z.uuid(),
  family_id: z.uuid(),
  title: z.string(),
  location: z.string().nullable(),
  starts_on: CalendarDate,
  ends_on: CalendarDate,
  time_type: TimeType,
  slots: z.array(SlotKey),
  start_time: z.string().nullable(),
  end_time: z.string().nullable(),
  recurrence: Recurrence.nullable(),
  reminder: Reminder.exclude(['none']),
  responsible_member_id: z.uuid().nullable(),
  visibility: Visibility,
  creator_member_id: z.uuid().nullable(),
  members: z.array(EventMember),
  exceptions: z.array(EventException),
  hidden_from: z.array(z.uuid()).nullable(),
  created_at: z.string(),
});

function toEvent(row: unknown): ReminderEvent | null {
  const parsed = Candidate.safeParse(row);
  if (!parsed.success) return null;
  const { hidden_from, creator_member_id, ...e } = parsed.data;
  // The surprise's cover isn't needed: a reminder never goes to the people it's hidden from.
  return { ...e, creator_member_id: creator_member_id ?? '', surprise: hidden_from ? { hidden_from, cover_title: '' } : null };
}

type Analytics = (familyId: string) => Tracker;

export function createReminderJob(db: ServiceDb, notifier: Pick<Notifier, 'send'>, analytics: Analytics, now: () => Date = () => new Date()) {
  /** Every family that has an event with a reminder, with its members and home time zone. */
  async function loadFamilies(familyIds: string[]) {
    const [settings, members, devices] = await Promise.all([
      db.from('family_calendar_settings').select('family_id, home_time_zone, slot_times').in('family_id', familyIds),
      db.from('members').select('id, family_id, display_name, user_id').in('family_id', familyIds),
      db.from('push_devices').select('member_id, prefs').in('family_id', familyIds).is('disabled_at', null).not('expo_push_token', 'is', null),
    ]);
    if (settings.error) throw settings.error;
    if (members.error) throw members.error;
    if (devices.error) throw devices.error;
    const userIds = members.data.flatMap((m) => (m.user_id ? [m.user_id] : []));
    const formats = await db.from('member_calendar_settings').select('user_id, time_format').in('user_id', userIds);
    if (formats.error) throw formats.error;
    const families = new Map<string, ReminderFamily>();
    for (const id of familyIds) {
      const s = settings.data.find((x) => x.family_id === id);
      const slotTimes = SlotTimes.safeParse(s?.slot_times);
      families.set(id, {
        timeZone: s?.home_time_zone ?? null,
        slotTimes: slotTimes.success ? slotTimes.data : DEFAULT_SLOT_TIMES,
        members: members.data.filter((m) => m.family_id === id) satisfies ReminderMember[],
      });
    }
    const timeFormat = new Map(formats.data.map((f) => [f.user_id, TimeFormatSetting.catch('automatic').parse(f.time_format)]));
    const userOf = new Map(members.data.map((m) => [m.id, m.user_id]));
    const prefs = devices.data.map((d) => ({ member_id: d.member_id, ...prefsOf(d.prefs) }));
    return {
      families,
      timeFormatOf: (memberId: string) => timeFormat.get(userOf.get(memberId) ?? '') ?? 'automatic',
      /** FR-003: minus anyone with reminders off on all their phones (or not set to "All family events"). */
      reached: (r: ReminderRecipient) => prefs.some((p) => p.member_id === r.memberId && p.reminders_on && (r.via === 'event' || p.reminders_scope === 'all')),
    };
  }

  /** Claims the reminder for these members; only the ones not claimed before come back. */
  async function claim(due: DueReminder, memberIds: string[]): Promise<string[]> {
    const rows = memberIds.map((member_id) => ({ family_id: due.familyId, event_id: due.occurrence.id, occurrence_date: due.occurrence.occurrence_date, kind: due.kind, member_id }));
    const { data, error } = await db
      .from('reminder_deliveries')
      .upsert(rows, { onConflict: 'event_id,occurrence_date,kind,member_id', ignoreDuplicates: true })
      .select('member_id');
    if (error) throw error;
    return data.map((r) => r.member_id);
  }

  /** Runs once a minute. Returns a line for the log, or null when nothing went out. */
  async function run(): Promise<string | null> {
    const at = now();
    // Every home time zone is within a day of UTC; `remindersDue` narrows to each family's days.
    const today = at.toISOString().slice(0, 10);
    const { data, error } = await db.rpc('reminder_candidates', { p_from: addDays(today, -2), p_to: addDays(today, 3) });
    if (error) throw error;
    const events = (data ?? []).flatMap((row) => toEvent(row) ?? []);
    if (events.length === 0) return null;
    const { families, timeFormatOf, reached } = await loadFamilies([...new Set(events.map((e) => e.family_id))]);
    let sent = 0;
    for (const due of remindersDue(events, families, at)) {
      const recipients = due.recipients.filter(reached);
      if (recipients.length === 0) continue;
      const claimed = await claim(due, recipients.map((r) => r.memberId));
      if (claimed.length === 0) continue;
      const family = families.get(due.familyId) as ReminderFamily;
      const o = due.occurrence;
      const result = await notifier.send({
        kind: 'reminder',
        memberIds: claimed,
        allFamilyOnly: recipients.filter((r) => r.via === 'all' && claimed.includes(r.memberId)).map((r) => r.memberId),
        text: (device) =>
          reminderText(o, due.kind, device.member_id, {
            use24h: uses24h(timeFormatOf(device.member_id), device.prefs.clock_24h ?? true),
            slotTimes: family.slotTimes,
            members: family.members,
          }),
        payload: PushPayload.parse({ kind: 'reminder', route: `/calendar/${o.id}?date=${o.occurrence_date}` }),
        ref: `${o.id}:${o.occurrence_date}:${due.kind}`,
        interruptionLevel: 'active',
      });
      // Every phone failed twice: logged in notification_log, not counted as sent.
      if (result.sent === 0) continue;
      analytics(due.familyId).track('event_reminder_sent', { kind: due.kind, recipients: claimed.length });
      sent++;
    }
    return sent ? `${sent} sent` : null;
  }

  return { run };
}
