// Spec 044 against local Supabase, through real OAuth connections (Claude's return address) and the
// MCP server over HTTP. US1: an event added by talking, "Added via Claude", undoable. US2: a day as
// Eva has it, her private event "Busy". L106: a surprise's cover says nothing about a surprise.
// The permission, "this date" and "from then on" changes and deletes. Skipped locally when Supabase
// isn't running.
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { loadDeletedEvents, loadEvent, saveEvent, setAiPermission, type Db } from '@cocon/data';
import { ActivityEntry, createTracker } from '@cocon/schemas';
import { loadConfig } from '../../src/config.js';
import { createHttpServer } from '../../src/server.js';
import { adminClient, connectAssistant, localSupabase, signInPerson } from '../../test/local.js';

const local = localSupabase();
if (!local && process.env.CI) throw new Error('Local Supabase must be running in CI for the MCP integration test');
if (!local) console.warn('calendar.integration.test.ts skipped: local Supabase is not running (pnpm dev starts it).');

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- tool results are checked field by field
type Result = Record<string, any>;

describe.skipIf(!local)('calendar tools and permission against local Supabase', () => {
  const { url, anonKey, serviceKey } = local ?? { url: '', anonKey: '', serviceKey: '' };
  const admin = adminClient(url, serviceKey);
  const run = randomUUID().slice(0, 8);
  const userIds: string[] = [];
  // What the server sends to PostHog, by event name and properties (never the input).
  const captured: [string, Record<string, unknown>][] = [];
  const analytics = {
    forCaller: () =>
      createTracker({ capture: (event, properties) => captured.push([event, properties ?? {}]), identify: () => undefined, group: () => undefined, reset: () => undefined }),
    shutdown: async () => undefined,
  };
  const server = createHttpServer(loadConfig({ SUPABASE_URL: url, SUPABASE_ANON_KEY: anonKey, APP_URL: 'http://localhost:8081' }), { analytics });
  let gabriel: Db;
  let eva: Db;
  let familyId: string;
  let gabrielMember: string;
  let evaMember: string;
  let jamesMember: string;
  let gabrielsClaude: Client;
  let evasClaude: Client;
  let music: string;

  const person = (name: string) => signInPerson(admin, url, anonKey, `mcpc-${name}-${run}@example.com`, userIds);
  const callAs = async (mcp: Client, name: string, args: Record<string, unknown> = {}): Promise<{ error: string | null; data: Result | null; text: string }> => {
    const result = await mcp.callTool({ name, arguments: args });
    const text = (result.content as { type: string; text: string }[])[0]?.text ?? '';
    return { error: result.isError ? text : null, data: result.isError ? null : (JSON.parse(text) as Result), text };
  };
  const call = (name: string, args: Record<string, unknown> = {}) => callAs(gabrielsClaude, name, args);
  const connect = async (member: Db) => {
    const { token } = await connectAssistant(url, member);
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const mcp = new Client({ name: 'test', version: '1' });
    await mcp.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`), { requestInit: { headers: { authorization: `Bearer ${token}` } } }));
    return mcp;
  };
  const entries = async (client: Db) => {
    const { data, error } = await client.rpc('activity_entries', { p_limit: 50 });
    if (error) throw error;
    return ActivityEntry.array().parse(data);
  };

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
    const james = await gabriel.rpc('add_managed_member', { name: 'James' });
    if (james.error) throw james.error;
    jamesMember = james.data as string;
    const members = await gabriel.from('members').select('id, display_name');
    if (members.error) throw members.error;
    gabrielMember = members.data.find((m) => m.display_name === 'Gabriel')?.id ?? '';
    evaMember = members.data.find((m) => m.display_name === 'Eva')?.id ?? '';

    await new Promise<void>((resolve) => server.listen(0, resolve));
    gabrielsClaude = await connect(gabriel);
    evasClaude = await connect(eva);
  });

  afterAll(async () => {
    await gabrielsClaude?.close();
    await evasClaude?.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    if (familyId) await admin.from('families').delete().eq('id', familyId);
    for (const id of userIds) await admin.auth.admin.deleteUser(id);
  });

  it('lists the family, who has the app, and today', async () => {
    const { data } = await call('list_members');
    expect(data?.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(data?.members).toEqual([
      { id: gabrielMember, name: 'Gabriel', color: expect.any(String), has_app: true, is_you: true },
      { id: evaMember, name: 'Eva', color: expect.any(String), has_app: true },
      { id: jamesMember, name: 'James', color: expect.any(String), has_app: false },
    ]);
  });

  it('US1: "Add James’s baby music class every Saturday morning, I’ll take him"', async () => {
    const { data, error } = await call('create_event', {
      title: 'Baby music class',
      date: '2026-11-05',
      slots: ['morning'],
      members: ['James'],
      responsible: 'Gabriel',
      repeat: { freq: 'weekly', weekdays: [6] },
    });
    expect(error).toBeNull();
    music = data?.id as string;
    // 032-later L102, and the call itself.
    expect(captured).toContainEqual([
      'event_created',
      { source: 'assistant', time_type: 'slot', slot: 'morning', member_count: 1, has_repeat: true, used_more_options: false, seconds_to_save: 0 },
    ]);
    expect(captured).toContainEqual(['mcp_tool_called', { tool: 'create_event', assistant: 'claude', ok: true }]);
    // It starts on the first Saturday, as the app's sheet saves it.
    expect(data).toMatchObject({ title: 'Baby music class', date: '2026-11-07', repeats: true, link: `http://localhost:8081/calendar/${music}?date=2026-11-07` });

    const saved = await loadEvent(eva, music);
    expect(saved).toMatchObject({
      source: 'claude',
      time_type: 'slot',
      slots: ['morning'],
      members: [jamesMember],
      responsible_member_id: gabrielMember,
      recurrence: { freq: 'weekly', weekdays: [6], ends: { type: 'never' } },
      visibility: 'family',
    });

    const day = await callAs(evasClaude, 'get_day', { date: '2026-11-14' });
    expect(day.data?.morning).toEqual([
      expect.objectContaining({ id: music, date: '2026-11-14', title: 'Baby music class', when: 'Morning', time: '09:00–12:00', who: ['James'], takes: 'Gabriel takes James', added_by: 'Gabriel · via Claude', repeats: 'every week on Saturday' }),
    ]);

    // FR-004: in the activity list, with Undo.
    const [entry] = await entries(eva);
    expect(entry).toMatchObject({ kind: 'event_created', source: 'claude', event_id: music, event_name: 'Baby music class', can_undo: true });
  });

  it('US2: "What does Eva have on Tuesday?" Her private appointment is Busy', async () => {
    await saveEvent(eva, { title: 'Therapist', location: 'Rue Oberkampf', notes: 'Bring the letter', starts_on: '2026-11-10', ends_on: '2026-11-10', time_type: 'slot', slots: ['afternoon'], members: [evaMember], visibility: 'private' });
    await saveEvent(eva, { title: 'Yoga', starts_on: '2026-11-10', ends_on: '2026-11-10', time_type: 'custom', start_time: '07:30', end_time: '08:30', members: [evaMember] });
    const { data, text } = await call('get_day', { date: '2026-11-10' });
    expect(data?.day).toBe('Tuesday, Nov 10');
    expect(data?.early_morning).toEqual([expect.objectContaining({ title: 'Yoga', when: '07:30', time: '07:30–08:30', who: ['Eva'] })]);
    expect(data?.afternoon).toEqual([{ id: expect.any(String), date: '2026-11-10', when: 'Afternoon', time: '14:00–18:00', who: ['Eva'], title: 'Busy' }]);
    expect(text).not.toMatch(/Therapist|Oberkampf|letter|private/);

    // Eva's own assistant gets it in full, marked private.
    const hers = await callAs(evasClaude, 'get_day', { date: '2026-11-10' });
    expect(hers.data?.afternoon).toEqual([expect.objectContaining({ title: 'Therapist', location: 'Rue Oberkampf', private: true })]);

    const free = await call('find_free_slots', { date: '2026-11-10', members: ['Eva'] });
    expect(free.data?.days[0].free.map((f: Result) => f.slot)).toEqual(['morning', 'lunch', 'evening']);
  });

  it('L106: the person a surprise is kept from gets only its cover, with no hint of a surprise', async () => {
    const dinner = await saveEvent(gabriel, {
      title: 'Eva’s surprise dinner',
      location: 'Café Lalo',
      notes: 'Book for 6',
      starts_on: '2026-11-21',
      ends_on: '2026-11-21',
      time_type: 'slot',
      slots: ['evening'],
      members: [evaMember],
      visibility: 'surprise',
      surprise: { hidden_from: [evaMember], cover_title: 'Dinner out', cover_note: 'Dress nice!' },
    });
    const hers = await callAs(evasClaude, 'list_events', { from: '2026-11-21', to: '2026-11-21' });
    const cover = (hers.data?.events as Result[]).find((e) => e.id === dinner);
    expect(cover).toMatchObject({ title: 'Dinner out', location: 'Café Lalo', notes: 'Dress nice!', added_by: 'Gabriel' });
    expect(hers.text).not.toMatch(/surprise|secret|cover|view|Book for 6|Eva’s surprise dinner/i);
    expect(Object.keys(cover ?? {})).not.toContain('private');

    // Her assistant can't change or delete it, and the refusal doesn't say why.
    expect((await callAs(evasClaude, 'update_event', { id: dinner, patch: { title: 'Dinner' } })).error).toBe('Only the person who added this event can change it.');
    expect((await callAs(evasClaude, 'delete_event', { id: dinner })).error).toBe('Only the person who added this event can change it.');

    // Gabriel's assistant is told who it's kept from, so it doesn't spoil it.
    const his = await call('list_events', { from: '2026-11-21', to: '2026-11-21', member: 'Eva' });
    expect((his.data?.events as Result[]).find((e) => e.id === dinner)).toMatchObject({ title: 'Eva’s surprise dinner', kept_secret_from: ['Eva'] });
  });

  it('changes one date, or every date from then on', async () => {
    expect((await call('update_event', { id: music, patch: { slots: ['afternoon'] } })).error).toMatch(/^This event repeats\. Ask the member whether to change only that date/);
    expect((await call('update_event', { id: music, date: '2026-11-14', scope: 'this', patch: { repeat: null } })).error).toBe(
      'How it repeats and who sees it can’t change for one date. Use scope "future".',
    );

    const one = await call('update_event', { id: music, date: '2026-11-14', scope: 'this', patch: { slots: ['afternoon'] } });
    expect(one.error).toBeNull();
    expect(one.data).toMatchObject({ scope: 'this', changed: ['time'] });
    expect((await loadEvent(gabriel, music))?.exceptions).toEqual([{ occurrence_date: '2026-11-14', cancelled: false, override: { time_type: 'slot', slots: ['afternoon'] } }]);

    const future = await call('update_event', { id: music, date: '2026-11-28', scope: 'future', patch: { title: 'Music class', location: 'Conservatoire' } });
    expect(future.error).toBeNull();
    expect(future.data).toMatchObject({ scope: 'future', title: 'Music class', changed: ['title', 'place'] });
    expect((await loadEvent(gabriel, music))?.recurrence).toEqual({ freq: 'weekly', weekdays: [6], ends: { type: 'on', date: '2026-11-27' } });
    const later = await call('get_day', { date: '2026-12-05' });
    expect(later.data?.morning).toEqual([expect.objectContaining({ title: 'Music class', location: 'Conservatoire', takes: 'Gabriel takes James' })]);
    expect((await entries(gabriel)).slice(0, 2).map((e) => [e.kind, e.event_name])).toEqual([
      ['event_edited', 'Baby music class'],
      ['event_edited', 'Baby music class'],
    ]);
  });

  it('deletes one date, or the whole event to Recently deleted', async () => {
    const one = await call('delete_event', { id: music, date: '2026-11-21', scope: 'this' });
    expect(one.data).toEqual({ deleted: 'Baby music class', dates: 'Saturday, Nov 21', in_recently_deleted: false });
    expect((await loadEvent(gabriel, music))?.exceptions).toContainEqual(expect.objectContaining({ occurrence_date: '2026-11-21', cancelled: true }));

    const all = await call('delete_event', { id: music, scope: 'all' });
    expect(all.data).toEqual({ deleted: 'Baby music class', dates: 'the whole event', in_recently_deleted: true });
    expect((await loadDeletedEvents(gabriel, new Date(Date.now() - 60_000).toISOString())).map((e) => e.id)).toContain(music);
    expect((await call('update_event', { id: music, patch: { title: 'Back' } })).error).toBe('That event isn’t in the calendar any more. Use list_events to find it.');

    // Undo from the activity list puts it back.
    const deleted = (await entries(gabriel)).find((e) => e.kind === 'event_deleted' && e.event_id === music);
    const { error } = await gabriel.rpc('undo_ai_change', { p_key: deleted?.key as string });
    expect(error).toBeNull();
    expect((await loadEvent(gabriel, music))?.deleted_at).toBeNull();
  });

  it('FR-003: with "Add & change events" off, the assistant reads but can’t change the calendar', async () => {
    const off = await setAiPermission(gabriel, familyId, userIds[0] as string, 'events', false);
    expect(off.error).toBeNull();
    const refused = await call('create_event', { title: 'Swim', date: '2026-11-08', slots: ['morning'], members: ['everyone'] });
    expect(refused.error).toBe('This member hasn’t allowed AI to change the calendar. They can change it in Settings › AI assistants.');
    expect((await call('delete_event', { id: music, scope: 'all' })).error).toBe(refused.error);
    expect((await call('get_day', { date: '2026-11-10' })).error).toBeNull();
    // Eva's own setting is hers.
    expect((await callAs(evasClaude, 'create_event', { title: 'Swim', date: '2026-11-08', slots: ['morning'], members: ['Eva'] })).error).toBeNull();
    await setAiPermission(gabriel, familyId, userIds[0] as string, 'events', true);
  });

  it('undoing an add removes the event for good', async () => {
    const { data } = await call('create_event', { title: 'Pediatrician', date: '2026-11-11', slots: ['morning'], members: ['James'], responsible: 'Gabriel' });
    const entry = (await entries(gabriel)).find((e) => e.event_id === data?.id);
    expect(entry).toMatchObject({ kind: 'event_created', event_name: 'Pediatrician' });
    const { error } = await gabriel.rpc('undo_ai_change', { p_key: entry?.key as string });
    expect(error).toBeNull();
    expect(await loadEvent(gabriel, data?.id as string)).toBeNull();
    expect((await entries(gabriel)).find((e) => e.key === entry?.key)).toMatchObject({ event_name: 'Pediatrician', undo_action: 'undo' });
  });

  it('says what to fix', async () => {
    captured.length = 0;
    expect((await call('create_event', { title: 'Swim', date: '2026-11-08', members: ['James'] })).error).toBe('Say when: slots (preferred), start_time and end_time, or all_day.');
    expect((await call('create_event', { title: 'Swim', date: '2026-11-08', slots: ['morning'], members: ['Zoe'] })).error).toBe("Nobody called 'Zoe' is in the family. Use list_members to see who is.");
    expect((await call('create_event', { title: 'Swim', date: '2026-11-08', slots: ['morning'], members: ['James'], responsible: 'James' })).error).toBe(
      'James doesn’t have the app, so can’t take anyone. Pick someone with the app.',
    );
    expect((await call('create_event', { title: 'Swim', date: '2026-11-08', slots: ['early_morning', 'lunch'], members: ['Eva'] })).error).toMatch(/^Slots must be next to each other/);
    expect((await call('list_events', { from: '2026-11-01', to: '2027-03-01' })).error).toBe('Ask for at most 62 days at a time.');
    // Nothing saved, so no event_created.
    expect(captured.map(([event]) => event)).not.toContain('event_created');
  });
});
