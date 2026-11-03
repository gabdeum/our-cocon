import type { SupabaseClient } from '@supabase/supabase-js';
import { DEFAULT_NOTIFICATION_PREFS, NotificationPrefs, type Database, type PushPayload } from '@cocon/schemas';
import { getReceipts, sendPushes, type ExpoOptions, type PushMessage } from './expo';

/** A Supabase client with the service role key: the notifier works for every family (FR-005). */
export type ServiceDb = SupabaseClient<Database>;

export type LogKind = 'timer_done' | 'reminder' | 'test';

export type Notification = {
  kind: LogKind;
  memberIds: string[];
  title: string;
  body: string;
  payload: PushPayload;
  /** What it's about, for the log (an event id and date for reminders). Never user text. */
  ref?: string;
  interruptionLevel?: PushMessage['interruptionLevel'];
};

/** Expo's answer for a token Apple no longer accepts (app deleted, notifications reset). */
const GONE = 'DeviceNotRegistered';
const RECEIPT_DELAY_MS = 15 * 60 * 1000;

function prefsOf(raw: unknown): NotificationPrefs {
  return { ...DEFAULT_NOTIFICATION_PREFS, ...NotificationPrefs.partial().catch({}).parse(raw) };
}

export type SendResult = { sent: number; failed: number };

export function createNotifier(db: ServiceDb, expo: ExpoOptions, now: () => Date = () => new Date()) {
  async function disable(deviceIds: string[]) {
    if (deviceIds.length === 0) return;
    const { error } = await db.from('push_devices').update({ disabled_at: now().toISOString() }).in('id', deviceIds);
    if (error) throw error;
  }

  /** Sends to every enabled phone of these members; reminders skip phones that turned them off. */
  async function send(n: Notification): Promise<SendResult> {
    if (n.memberIds.length === 0) return { sent: 0, failed: 0 };
    const { data, error } = await db
      .from('push_devices')
      .select('id, family_id, member_id, expo_push_token, prefs')
      .in('member_id', n.memberIds)
      .is('disabled_at', null)
      .not('expo_push_token', 'is', null);
    if (error) throw error;
    const devices = (data ?? []).filter((d) => n.kind !== 'reminder' || prefsOf(d.prefs).reminders_on);
    if (devices.length === 0) return { sent: 0, failed: 0 };

    const tickets = await sendPushes(
      devices.map((d) => ({
        to: d.expo_push_token as string,
        title: n.title,
        body: n.body,
        data: n.payload,
        sound: 'default',
        ...(n.interruptionLevel ? { interruptionLevel: n.interruptionLevel } : {}),
      })),
      expo,
    );
    const sentAt = now().toISOString();
    const rows = devices.map((d, i) => {
      const t = tickets[i] ?? { ok: false as const, message: 'No ticket' };
      return {
        kind: n.kind,
        family_id: d.family_id,
        member_id: d.member_id,
        device_id: d.id,
        ref: n.ref ?? null,
        sent_at: sentAt,
        status: t.ok ? 'sent' : 'error',
        ticket_id: t.ok ? t.id : null,
        error: t.ok ? null : (t.error ?? t.message),
      };
    });
    const logged = await db.from('notification_log').insert(rows);
    if (logged.error) throw logged.error;
    await disable(devices.filter((_, i) => { const t = tickets[i]; return t && !t.ok && t.error === GONE; }).map((d) => d.id));
    const sent = rows.filter((r) => r.status === 'sent').length;
    return { sent, failed: rows.length - sent };
  }

  /** FR-005: receipts for sends at least 15 minutes old. Turns off phones Apple no longer accepts. */
  async function checkReceipts(): Promise<{ checked: number; failed: number }> {
    const before = new Date(now().getTime() - RECEIPT_DELAY_MS).toISOString();
    const { data, error } = await db
      .from('notification_log')
      .select('id, ticket_id, device_id')
      .eq('status', 'sent')
      .is('receipt_checked_at', null)
      .not('ticket_id', 'is', null)
      .lte('sent_at', before)
      .limit(1000);
    if (error) throw error;
    const pending = data ?? [];
    if (pending.length === 0) return { checked: 0, failed: 0 };
    const receipts = await getReceipts(pending.map((p) => p.ticket_id as string), expo);
    const checkedAt = now().toISOString();
    const gone: string[] = [];
    let failed = 0;
    for (const p of pending) {
      const r = receipts.get(p.ticket_id as string);
      // No receipt: Expo has forgotten it (over 24 h old). Nothing more to learn.
      const change = !r ? { receipt_checked_at: checkedAt } : r.ok
        ? { status: 'delivered', receipt_checked_at: checkedAt }
        : { status: 'failed', error: r.error ?? r.message, receipt_checked_at: checkedAt };
      if (r && !r.ok) {
        failed++;
        if (r.error === GONE && p.device_id) gone.push(p.device_id);
      }
      const updated = await db.from('notification_log').update(change).eq('id', p.id);
      if (updated.error) throw updated.error;
    }
    await disable(gone);
    return { checked: pending.length, failed };
  }

  return { send, checkReceipts };
}
export type Notifier = ReturnType<typeof createNotifier>;
