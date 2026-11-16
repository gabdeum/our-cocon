// @vitest-environment node
// Spec 057 against local Supabase. SC-001: with 200 reminders the screen's first pages are one
// request per section, and "Show more" brings the next 20 without asking for the earlier ones again.
// FR-007: a tick on one phone reaches the other's open app (the `reminders` live table). 032-later
// L147: deleted reminders are in Recently deleted, come back, and can be removed for good. Needs
// local Supabase (`pnpm dev` starts it; CI starts it before the tests).
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createClient, type RealtimeChannel } from '@supabase/supabase-js';
import { addDays, todayIn } from '@cocon/calendar';
import { catchUpReminders, completeReminder, createReminder, deleteReminder, deleteReminderNow, loadReminderSection, undoCompleteReminder } from '@cocon/data';
import { draftToFields } from '@cocon/reminders';
import { ChangeEvent, ReminderDraft, familyChannel, type Database } from '@cocon/schemas';
import { clientOptions as options, localSupabase, signInPerson, type Client } from '../test/local-supabase';

// Recently deleted's module reaches the recipes' photo code: Expo's native modules aren't here.
vi.mock('expo-image-picker', () => ({}));
vi.mock('expo-image-manipulator', () => ({ ImageManipulator: {}, SaveFormat: { JPEG: 'jpeg' } }));
vi.mock('expo-crypto', () => ({ randomUUID }));
vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
const { loadDeletedReminderItems } = await import('./recently-deleted');

const local = localSupabase();
if (!local && process.env.CI) throw new Error('Local Supabase must be running in CI for the reminders integration test');
if (!local) console.warn('reminders.integration.test.ts skipped: local Supabase is not running (pnpm dev starts it).');

const tz = 'Europe/Paris';

describe.skipIf(!local)('reminders screens against local Supabase', () => {
  const { url, anonKey, serviceKey } = local ?? { url: '', anonKey: '', serviceKey: '' };
  const admin = createClient<Database>(url, serviceKey, options);
  const run = randomUUID().slice(0, 8);
  const userIds: string[] = [];
  const channels: [Client, RealtimeChannel][] = [];
  let alex: Client;
  let mia: Client;
  let familyId: string;
  const today = todayIn(tz);

  const person = (name: string) => signInPerson(admin, url, anonKey, `reminders-${name}-${run}@example.com`, userIds);

  beforeAll(async () => {
    [alex, mia] = await Promise.all([person('alex'), person('mia')]);
    const fam = await alex.rpc('create_family', { family_name: 'Reminders test', display_name: 'Alex' });
    if (fam.error) throw fam.error;
    familyId = fam.data;
    const invite = await alex.rpc('create_invite');
    if (invite.error) throw invite.error;
    const joined = await mia.rpc('accept_invite', { token: invite.data, display_name: 'Mia' });
    if (joined.error) throw joined.error;
    // 200 one-off reminders: 10 overdue, 10 today, 10 tomorrow and 170 later.
    const day = (i: number) => (i < 10 ? addDays(today, -1 - i) : i < 20 ? today : i < 30 ? addDays(today, 1) : addDays(today, 2 + (i % 60)));
    const rows = Array.from({ length: 200 }, (_, i) => ({ ...draftToFields(ReminderDraft.parse({ title: `Reminder ${i}`, due_date: day(i), rollover: 'day' }), tz), family_id: familyId }));
    const { error } = await alex.from('reminders').insert(rows);
    if (error) throw error;
  }, 30_000);

  afterAll(async () => {
    for (const [client, channel] of channels) await client.removeChannel(channel);
    // Deleting the people removes their family and everything in it.
    for (const id of userIds) await admin.auth.admin.deleteUser(id);
  });

  it('SC-001: one request per section, then 20 more without the earlier ones', async () => {
    await catchUpReminders(alex, tz);
    const calls = vi.spyOn(alex, 'rpc');
    const pages = await Promise.all((['overdue', 'today', 'tomorrow', 'later'] as const).map((section) => loadReminderSection(alex, { section, mine: false, tz, caughtUp: true })));
    expect(calls).toHaveBeenCalledTimes(4);
    expect(pages.map((p) => p.rows.length)).toEqual([10, 10, 10, 20]);
    const later = pages[3];
    expect(later?.nextCursor).not.toBeNull();

    calls.mockClear();
    const more = await loadReminderSection(alex, { section: 'later', mine: false, tz, cursor: later?.nextCursor });
    expect(calls).toHaveBeenCalledTimes(1);
    calls.mockRestore();
    expect(more.rows).toHaveLength(20);
    const first = new Set(later?.rows.map((x) => x.id));
    expect(more.rows.some((x) => first.has(x.id))).toBe(false);
  });

  it('FR-007: a tick reaches another member’s open app, and its Undo puts it back', async () => {
    await mia.realtime.setAuth();
    const heard: ChangeEvent[] = [];
    const channel = mia.channel(familyChannel(familyId), { config: { private: true } });
    channels.push([mia, channel]);
    channel.on('broadcast', { event: 'change' }, ({ payload }) => {
      const change = ChangeEvent.safeParse(payload);
      if (change.success) heard.push(change.data);
    });
    const status = await new Promise<string>((resolve) => channel.subscribe((s) => s !== 'CLOSED' && resolve(s)));
    expect(status).toBe('SUBSCRIBED');

    const id = await createReminder(alex, familyId, { title: 'Water the plants', due_date: today }, tz);
    const done = await completeReminder(alex, id, tz);
    if (!done) throw new Error('not completed');
    expect(done.repeating).toBe(false);
    await expect.poll(() => heard.some((c) => c.table === 'reminders' && c.id === id), { timeout: 5000 }).toBe(true);
    const { data } = await mia.from('reminders').select('completed_at').eq('id', id).single();
    expect(data?.completed_at).not.toBeNull();

    expect(await undoCompleteReminder(alex, done.undo)).toBe(true);
    const back = await mia.from('reminders').select('completed_at').eq('id', id).single();
    expect(back.data?.completed_at).toBeNull();
  });

  it('L147: a deleted reminder is in Recently deleted, comes back, and can be removed for good', async () => {
    const id = await createReminder(alex, familyId, { title: 'Renew the parking permit', due_date: today }, tz);
    await expect(deleteReminderNow(mia, id)).rejects.toThrow();

    await deleteReminder(alex, id);
    const listed = (await loadDeletedReminderItems(mia)).find((d) => d.id === id);
    expect(listed).toMatchObject({ kind: 'reminder', name: 'Renew the parking permit' });
    expect(listed?.deleted_by).toBe((await alex.auth.getUser()).data.user?.id);

    await deleteReminder(mia, id, false);
    expect((await loadDeletedReminderItems(mia)).some((d) => d.id === id)).toBe(false);

    await deleteReminder(mia, id);
    await deleteReminderNow(mia, id);
    const gone = await admin.from('reminders').select('id').eq('id', id);
    expect(gone.data).toEqual([]);
  });
});
