// Spec 060 against local Supabase, through real OAuth connections (Claude's return address) and the
// MCP server over HTTP. FR-001 each tool, SC-001 pages by next_cursor, FR-002 the permission (a
// refused write), FR-003 activity with Undo and Restore, FR-004 what to fix. The family has no home
// time zone, so dates are UTC. Skipped locally when Supabase isn't running.
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { addDays, todayIn } from '@cocon/calendar';
import { createReminder, loadReminder, loadReminderHistory, setAiPermission, type Db } from '@cocon/data';
import { ActivityEntry, createTracker } from '@cocon/schemas';
import { loadConfig } from '../../src/config.js';
import { createHttpServer } from '../../src/server.js';
import { adminClient, connectAssistant, localSupabase, signInPerson } from '../../test/local.js';

const local = localSupabase();
if (!local && process.env.CI) throw new Error('Local Supabase must be running in CI for the MCP integration test');
if (!local) console.warn('reminders.integration.test.ts skipped: local Supabase is not running (pnpm dev starts it).');

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- tool results are checked field by field
type Result = Record<string, any>;

describe.skipIf(!local)('reminder tools and permission against local Supabase', () => {
  const { url, anonKey, serviceKey } = local ?? { url: '', anonKey: '', serviceKey: '' };
  const admin = adminClient(url, serviceKey);
  const run = randomUUID().slice(0, 8);
  const userIds: string[] = [];
  const captured: [string, Record<string, unknown>][] = [];
  const analytics = {
    forCaller: () =>
      createTracker({ capture: (event, properties) => captured.push([event, properties ?? {}]), identify: () => undefined, group: () => undefined, reset: () => undefined }),
    shutdown: async () => undefined,
  };
  const server = createHttpServer(loadConfig({ SUPABASE_URL: url, SUPABASE_ANON_KEY: anonKey, APP_URL: 'http://localhost:8081' }), { analytics });
  const today = todayIn('UTC');
  const tomorrow = addDays(today, 1);
  const nextWeek = addDays(today, 7);
  let gabriel: Db;
  let eva: Db;
  let familyId: string;
  let evaMember: string;
  let gabrielsClaude: Client;

  const person = (name: string) => signInPerson(admin, url, anonKey, `mcpr-${name}-${run}@example.com`, userIds);
  const call = async (name: string, args: Record<string, unknown> = {}): Promise<{ error: string | null; data: Result | null }> => {
    const result = await gabrielsClaude.callTool({ name, arguments: args });
    const text = (result.content as { type: string; text: string }[])[0]?.text ?? '';
    return { error: result.isError ? text : null, data: result.isError ? null : (JSON.parse(text) as Result) };
  };
  const entries = async (client: Db) => {
    const { data, error } = await client.rpc('activity_entries', { p_limit: 50 });
    if (error) throw error;
    return ActivityEntry.array().parse(data);
  };
  const entryOf = async (id: string) => (await entries(gabriel)).find((e) => e.reminder_id === id && e.source !== 'app');

  beforeAll(async () => {
    gabriel = await person('gabriel');
    eva = await person('eva');
    const fam = await gabriel.rpc('create_family', { family_name: 'The Demanges', display_name: 'Gabriel' });
    if (fam.error) throw fam.error;
    familyId = fam.data as string;
    const invite = await gabriel.rpc('create_invite');
    if (invite.error) throw invite.error;
    const joined = await eva.rpc('accept_invite', { token: invite.data, display_name: 'Eva' });
    if (joined.error) throw joined.error;
    const members = await gabriel.from('members').select('id, display_name');
    if (members.error) throw members.error;
    evaMember = members.data.find((m) => m.display_name === 'Eva')?.id ?? '';

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const { token } = await connectAssistant(url, gabriel);
    gabrielsClaude = new Client({ name: 'test', version: '1' });
    await gabrielsClaude.connect(
      new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${(server.address() as AddressInfo).port}/mcp`), { requestInit: { headers: { authorization: `Bearer ${token}` } } }),
    );
  });

  afterAll(async () => {
    await gabrielsClaude?.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    if (familyId) await admin.from('families').delete().eq('id', familyId);
    for (const id of userIds) await admin.auth.admin.deleteUser(id);
  });

  it('FR-001: "Remind Eva to water the plants every week from tomorrow, at 9" is added via Claude, and listed', async () => {
    captured.length = 0;
    const added = await call('create_reminder', {
      title: 'Water the plants',
      due_date: tomorrow,
      time: '09:00',
      repeat: { freq: 'weekly' },
      assignee: 'Eva',
      notes: 'The ferns too',
    });
    expect(added.error).toBeNull();
    expect(added.data).toMatchObject({ title: 'Water the plants', due: { date: tomorrow, time: '09:00' }, link: `http://localhost:8081/reminders?open=${added.data?.id}` });
    const stored = await loadReminder(eva, added.data?.id as string);
    expect(stored).toMatchObject({ assignee_id: evaMember, has_time: true, rollover: 'hour', source: 'claude' });
    expect(captured).toContainEqual(['assistant_reminder_action', { tool: 'create_reminder', assistant: 'claude' }]);

    const listed = await call('list_reminders', { section: 'tomorrow' });
    expect(listed.data?.reminders).toEqual([
      expect.objectContaining({
        id: added.data?.id,
        title: 'Water the plants',
        notes: 'The ferns too',
        assignee: 'Eva',
        due: expect.objectContaining({ date: tomorrow, time: '09:00' }),
        repeat: 'every week',
        rollover: 'hour',
        late_days: 0,
        section: 'tomorrow',
      }),
    ]);
    expect(listed.data?.next_cursor).toBeNull();
    expect((await call('list_reminders', { assignee: 'everyone' })).data?.reminders).toEqual([]);
    expect((await call('list_reminders', { assignee: 'Eva' })).data?.reminders).toHaveLength(1);
  });

  it('SC-001: pages follow next_cursor across sections until it is null', async () => {
    for (const [title, due_date] of [
      ['Call the plumber', today],
      ['Renew the passport', nextWeek],
      ['Book the vet', nextWeek],
    ] as const) {
      await createReminder(gabriel, familyId, { title, due_date }, 'UTC');
    }
    const seen: string[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const page: { data: Result | null; error: string | null } = await call('list_reminders', { limit: 2, ...(cursor ? { cursor } : {}) });
      expect(page.error).toBeNull();
      seen.push(...(page.data?.reminders as Result[]).map((r) => r.title as string));
      cursor = page.data?.next_cursor as string | null;
      pages++;
    } while (cursor && pages < 5);
    expect(pages).toBe(2);
    // Today, then tomorrow, then later (the two later ones share a time, so their order is the ids').
    expect(seen.slice(0, 2)).toEqual(['Call the plumber', 'Water the plants']);
    expect(seen.slice(2).sort()).toEqual(['Book the vet', 'Renew the passport']);
    expect((await call('list_reminders', { cursor: 'nonsense' })).error).toBe('cursor isn’t one list_reminders gave for these filters. Start again without it.');
  });

  // Spec 073: notes up to 5000 characters, formatting kept as written (the tool took 2000 and the table 1000).
  it('keeps a long formatted note, and refuses one past 5000 characters', async () => {
    const notes = `# Groceries\n${'- [ ] onion\n'.repeat(400)}`.slice(0, 5000);
    const added = await call('create_reminder', { title: 'Shop', due_date: tomorrow, notes });
    expect(added.error).toBeNull();
    expect((await loadReminder(eva, added.data?.id as string)).notes).toBe(notes);
    expect((await call('create_reminder', { title: 'Shop', due_date: tomorrow, notes: 'a'.repeat(5001) })).error).not.toBeNull();
    expect((await call('delete_reminder', { id: added.data?.id })).error).toBeNull();
  });

  it('changes, snoozes, ticks off and deletes, each with Undo or Restore in the activity', async () => {
    const { data } = await call('create_reminder', { title: 'Pay the nanny', due_date: today, repeat: { freq: 'weekly' } });
    const id = data?.id as string;

    const changed = await call('update_reminder', { id, title: 'Pay Nadia', time: '18:00' });
    expect(changed.data).toMatchObject({ title: 'Pay Nadia', changed: ['title', 'time'], due: { date: today, time: '18:00' } });
    expect(await entryOf(id)).toBeDefined();

    const snoozed = await call('snooze_reminder', { id, until: 'tomorrow' });
    expect(snoozed.data).toMatchObject({ snoozed: 'Pay Nadia', back: { date: tomorrow, time: '18:00' } });
    expect((await loadReminder(gabriel, id)).due_at).toMatch(new RegExp(`^${today}`));

    const done = await call('complete_reminder', { id });
    expect(done.data).toMatchObject({ done: 'Pay Nadia', next_due: { date: addDays(today, 7), time: '18:00' } });
    const completion = (await entries(gabriel)).find((e) => e.reminder_id === id && e.kind === 'reminder_completed');
    expect(completion).toMatchObject({ source: 'claude', reminder_name: 'Pay Nadia', can_undo: true });
    const undone = await gabriel.rpc('undo_ai_change', { p_key: completion?.key as string });
    expect(undone.error).toBeNull();
    expect((await loadReminder(gabriel, id)).due_at).toMatch(new RegExp(`^${today}`));
    expect(await loadReminderHistory(gabriel, id)).toEqual([]);

    const deleted = await call('delete_reminder', { id });
    expect(deleted.data).toEqual({ deleted: 'Pay Nadia', in_recently_deleted: true });
    const removal = (await entries(gabriel)).find((e) => e.reminder_id === id && e.kind === 'reminder_deleted');
    expect(removal).toMatchObject({ can_restore: true, can_undo: false });
    expect((await call('complete_reminder', { id })).error).toBe('That reminder isn’t there any more: it was deleted. Use list_reminders to find it.');
    const restored = await gabriel.rpc('undo_ai_change', { p_key: removal?.key as string });
    expect(restored.error).toBeNull();
    expect((await loadReminder(gabriel, id)).title).toBe('Pay Nadia');
  });

  it('FR-003: undoing an add removes the reminder for good', async () => {
    const { data } = await call('create_reminder', { title: 'Buy stamps', due_date: today });
    const entry = await entryOf(data?.id as string);
    expect(entry).toMatchObject({ kind: 'reminder_created', reminder_name: 'Buy stamps' });
    expect((await gabriel.rpc('undo_ai_change', { p_key: entry?.key as string })).error).toBeNull();
    const gone = await admin.from('reminders').select('id').eq('id', data?.id as string);
    expect(gone.data).toEqual([]);
    expect((await entries(gabriel)).find((e) => e.key === entry?.key)).toMatchObject({ reminder_name: 'Buy stamps', undo_action: 'undo' });
  });

  it('FR-002: with "Add & change reminders" off, the assistant reads but can’t change reminders', async () => {
    const id = await createReminder(gabriel, familyId, { title: 'Take the bins out', due_date: today }, 'UTC');
    const off = await setAiPermission(gabriel, familyId, userIds[0] as string, 'reminders', false);
    expect(off.error).toBeNull();
    const refused = 'This member hasn’t allowed AI to change reminders. They can change it in Menu › AI assistants.';
    expect((await call('create_reminder', { title: 'Swim', due_date: today })).error).toBe(refused);
    expect((await call('update_reminder', { id, title: 'Bins' })).error).toBe(refused);
    expect((await call('complete_reminder', { id })).error).toBe(refused);
    expect((await call('snooze_reminder', { id, until: 'tomorrow' })).error).toBe(refused);
    expect((await call('delete_reminder', { id })).error).toBe(refused);
    expect((await call('list_reminders', { section: 'today' })).error).toBeNull();
    await setAiPermission(gabriel, familyId, userIds[0] as string, 'reminders', true);
  });

  it('FR-004: says what to fix', async () => {
    captured.length = 0;
    expect((await call('create_reminder', { title: ' ', due_date: today })).error).toBe('title: Give your reminder a name.');
    expect((await call('create_reminder', { title: 'x'.repeat(81), due_date: today })).error).toBe('title: Keep the name under 80 characters.');
    expect((await call('create_reminder', { title: 'Swim' })).error).toBe('due_date is missing. Add it and try again.');
    expect((await call('create_reminder', { title: 'Swim', due_date: today, rollover: 'hour' })).error).toBe('Rollover "hour" needs a time. Add a time, or use rollover "day".');
    expect((await call('create_reminder', { title: 'Swim', due_date: today, assignee: 'Zoe' })).error).toBe("Nobody called 'Zoe' is in the family. Use list_members to see who is.");
    const { data } = await call('create_reminder', { title: 'Swim', due_date: today });
    expect((await call('snooze_reminder', { id: data?.id, until: today })).error).toBe('Pick a day after today to snooze to.');
    expect((await call('snooze_reminder', { id: data?.id, until: 'hour' })).error).toBe('“In 1 hour” needs a reminder with a time. Use tomorrow, week, month or a date instead.');
    expect((await call('update_reminder', { id: data?.id })).error).toBe('Nothing to change. Send what changes.');
    expect(captured.filter(([event]) => event === 'assistant_reminder_action')).toHaveLength(1);
  });
});
