import { uses24h } from '@cocon/calendar';
import { catchUpReminders } from '@cocon/data';
import { prefsOf, type Notifier, type ServiceDb } from '@cocon/notify';
import { reminderNotificationText, reminderSendDue, todoRecipients, type NotifiedReminder, type ReminderSend, type TodoMember } from '@cocon/reminders';
import { DEFAULT_QUIET_HOURS, PushPayload, QuietHours, ReminderRollover, TODO_CATEGORY, TimeFormatSetting, type Tracker } from '@cocon/schemas';
import { z } from 'zod';

/**
 * Spec 059: reminders (things to do) on the phone. Every minute: close what was missed in each
 * family (056 FR-005, 032-later L146), then for every open reminder, as the database places it, what
 * each recipient gets now (`@cocon/reminders`), claimed in `reminder_nudges` so nobody gets it
 * twice (SC-002), then sent. A claim comes before the send: if the worker stops in between, one
 * notification is lost rather than sent twice. A Done, a snooze, a delete or a new assignee changes
 * the reminder, so the next tick simply has nothing more for it (FR-005).
 */

const Instant = z.iso.datetime({ offset: true });
const Candidate = z.object({
  family_id: z.uuid(),
  time_zone: z.string(),
  reminder: z.object({
    id: z.uuid(),
    title: z.string(),
    assignee_id: z.uuid().nullable(),
    due_at: Instant,
    has_time: z.boolean(),
    rollover: ReminderRollover,
    late_from: Instant,
    snoozed: z.boolean().default(false),
    created_at: Instant,
  }),
});
type Candidate = z.infer<typeof Candidate>;

type Analytics = (familyId: string) => Tracker;

export function createTodoJob(db: ServiceDb, notifier: Pick<Notifier, 'send'>, analytics: Analytics, now: () => Date = () => new Date()) {
  /** L146: each family with a repeat whose next date has come, in its home time zone. */
  async function catchUp(at: Date): Promise<number> {
    const { data, error } = await db.rpc('todo_catch_up_families', { p_now: at.toISOString() });
    if (error) throw error;
    let missed = 0;
    for (const f of data ?? []) {
      const n = await catchUpReminders(db, f.time_zone, at, f.family_id);
      for (let i = 0; i < n; i++) analytics(f.family_id).track('reminder_missed', {});
      missed += n;
    }
    return missed;
  }

  /** The families' members, who has a phone with reminders on, and each person's quiet hours and clock. */
  async function loadPeople(familyIds: string[]) {
    const [members, devices] = await Promise.all([
      db.from('members').select('id, family_id, display_name, user_id').in('family_id', familyIds),
      db.from('push_devices').select('member_id, prefs').in('family_id', familyIds).is('disabled_at', null).not('expo_push_token', 'is', null),
    ]);
    if (members.error) throw members.error;
    if (devices.error) throw devices.error;
    const userIds = members.data.flatMap((m) => (m.user_id ? [m.user_id] : []));
    const settings = await db.from('member_calendar_settings').select('user_id, quiet_from, quiet_to, time_format').in('user_id', userIds);
    if (settings.error) throw settings.error;
    const byUser = new Map(settings.data.map((s) => [s.user_id, s]));
    const userOf = new Map(members.data.map((m) => [m.id, m.user_id]));
    const reached = new Set(devices.data.filter((d) => prefsOf(d.prefs).todo_on).map((d) => d.member_id));
    return {
      membersOf: (familyId: string): TodoMember[] => members.data.filter((m) => m.family_id === familyId),
      reached: (memberId: string) => reached.has(memberId),
      quietOf: (memberId: string): QuietHours => {
        const s = byUser.get(userOf.get(memberId) ?? '');
        return QuietHours.catch(DEFAULT_QUIET_HOURS).parse(s && { from: s.quiet_from, to: s.quiet_to });
      },
      timeFormatOf: (memberId: string) => TimeFormatSetting.catch('automatic').parse(byUser.get(userOf.get(memberId) ?? '')?.time_format),
    };
  }

  /** Claims the send for these members; only the ones not claimed before come back. */
  async function claim(c: Candidate, send: ReminderSend, memberIds: string[]): Promise<string[]> {
    const rows = memberIds.map((member_id) => ({ family_id: c.family_id, reminder_id: c.reminder.id, late_from: c.reminder.late_from, kind: send.kind, slot_at: send.slotAt, member_id }));
    const { data, error } = await db
      .from('reminder_nudges')
      .upsert(rows, { onConflict: 'reminder_id,late_from,kind,slot_at,member_id', ignoreDuplicates: true })
      .select('member_id');
    if (error) throw error;
    return data.map((r) => r.member_id);
  }

  /** Runs once a minute. Returns a line for the log, or null when nothing happened. */
  async function run(): Promise<string | null> {
    const at = now();
    const missed = await catchUp(at);
    const { data, error } = await db.rpc('todo_candidates', { p_now: at.toISOString() });
    if (error) throw error;
    const candidates = (data ?? []).flatMap((row) => {
      const parsed = Candidate.safeParse(row);
      return parsed.success ? [parsed.data] : [];
    });
    let sent = 0;
    if (candidates.length) {
      const people = await loadPeople([...new Set(candidates.map((c) => c.family_id))]);
      for (const c of candidates) {
        const r: NotifiedReminder = c.reminder;
        // Everyone it's for gets the same send unless their quiet hours differ: grouped by moment and kind.
        const groups = new Map<string, { send: ReminderSend; forName: string | null; memberIds: string[] }>();
        for (const recipient of todoRecipients(r, people.membersOf(c.family_id))) {
          if (!people.reached(recipient.memberId)) continue;
          const send = reminderSendDue(r, people.quietOf(recipient.memberId), c.time_zone, at);
          if (!send) continue;
          const key = `${send.kind}|${send.slotAt}`;
          const group = groups.get(key) ?? { send, forName: recipient.forName, memberIds: [] };
          group.memberIds.push(recipient.memberId);
          groups.set(key, group);
        }
        for (const { send, forName, memberIds } of groups.values()) {
          const claimed = await claim(c, send, memberIds);
          if (claimed.length === 0) continue;
          const result = await notifier.send({
            kind: 'todo',
            memberIds: claimed,
            text: (device) =>
              reminderNotificationText(r, send, { use24h: uses24h(people.timeFormatOf(device.member_id), device.prefs.clock_24h ?? true), tz: c.time_zone, forName }),
            payload: PushPayload.parse({ kind: 'todo', route: `/reminders?open=${r.id}`, due_at: c.reminder.due_at }),
            ref: `${r.id}:${send.slotAt}:${send.kind}`,
            interruptionLevel: 'active',
            categoryId: r.has_time ? TODO_CATEGORY.timed : TODO_CATEGORY.untimed,
          });
          // Every phone failed twice: logged in notification_log, not counted as sent.
          if (result.sent === 0) continue;
          analytics(c.family_id).track('reminder_notification_sent', { kind: send.kind, rollover: r.rollover });
          sent++;
        }
      }
    }
    const parts = [sent ? `${sent} sent` : null, missed ? `${missed} missed` : null].filter(Boolean);
    return parts.length ? parts.join(', ') : null;
  }

  return { run };
}
