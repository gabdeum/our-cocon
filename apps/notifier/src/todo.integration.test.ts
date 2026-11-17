// Spec 059 against local Supabase: the reminders job sends each reminder to the right phones with the
// right words and actions, never twice after a restart (SC-002), stops once it's done (SC-003), keeps
// each person's quiet hours, and closes a missed repeat (L146). Expo is a fake; the clock is set.
// Skipped with a notice when Supabase isn't running locally.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { addDays, todayIn, zonedInstant } from '@cocon/calendar';
import { completeReminder, createReminder } from '@cocon/data';
import { createNotifier } from '@cocon/notify';
import { createTracker, type Database, type Json } from '@cocon/schemas';
import { clientOptions, localSupabase, signInPerson, type Client } from '../test/local';
import { createTodoJob } from './todo';

const local = localSupabase();
if (!local && process.env.CI) throw new Error('Local Supabase must be running in CI for the todo integration test');
if (!local) console.warn('todo.integration.test.ts skipped: local Supabase is not running (pnpm dev starts it).');

const TZ = 'America/New_York';
const at = (date: string, time: string) => zonedInstant(date, time, TZ);
// From the day after tomorrow: a reminder never notifies before it was added.
const day = (n: number) => addDays(todayIn(TZ), 2 + n);
const PLUMBER = day(0);
const BINS = day(1);
const SWIM = day(2);
const PILLS = day(4);

describe.skipIf(!local)('reminder notifications against local Supabase', () => {
  const { url, anonKey, serviceKey } = local ?? { url: '', anonKey: '', serviceKey: '' };
  const admin = createClient<Database>(url, serviceKey, clientOptions);
  const run = randomUUID().slice(0, 8);
  const userIds: string[] = [];
  let gabriel: Client;
  let eva: Client;
  const ids: Record<string, string> = {};
  const token = (name: string) => `ExponentPushToken[${name}${run}]`;
  type Sent = { to: string; title: string; body: string; categoryId?: string; interruptionLevel?: string; data: { kind: string; route: string; due_at?: string } };
  let sent: Sent[] = [];
  const tracked: { event: string; props: Record<string, unknown> }[] = [];
  let now = new Date();

  // Expo: takes everything. Only this test's phones are kept, other local data may be about.
  const fetch = (async (_: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as Sent[];
    sent.push(...body.filter((m) => m.to.endsWith(`${run}]`)));
    return new Response(JSON.stringify({ data: body.map((m) => ({ status: 'ok', id: `ticket-${m.to}` })) }));
  }) as unknown as typeof globalThis.fetch;
  const analytics = () => createTracker({ capture: (event, props) => tracked.push({ event, props }), identify: () => undefined, group: () => undefined, reset: () => undefined });
  const job = () => createTodoJob(admin, createNotifier(admin, { fetch }, () => now), analytics, () => now);
  const sentTo = (name: string) => sent.filter((m) => m.to === token(name));
  const tick = async (date: string, time: string) => {
    sent = [];
    tracked.length = 0;
    now = at(date, time);
    await job().run();
  };

  const register = async (client: Client, name: string, prefs: Json = {}) => {
    const { error } = await client.rpc('register_push_device', { p_device_id: `${name}-${run}-device`, p_platform: 'ios', p_token: token(name), p_prefs: prefs, p_app_version: '1.0.0' });
    if (error) throw error;
  };
  const add = (draft: Record<string, unknown>) =>
    createReminder(gabriel, ids.family as string, { notes: null, repeat: null, assignee: 'everyone', ...draft }, TZ);

  beforeAll(async () => {
    gabriel = await signInPerson(admin, url, anonKey, `todo-gabriel-${run}@example.com`, userIds);
    const fam = await gabriel.rpc('create_family', { family_name: 'Todo test', display_name: 'Gabriel' });
    if (fam.error) throw fam.error;
    const invite = await gabriel.rpc('create_invite', {});
    if (invite.error) throw invite.error;
    eva = await signInPerson(admin, url, anonKey, `todo-eva-${run}@example.com`, userIds);
    const joined = await eva.rpc('accept_invite', { token: invite.data, display_name: 'Eva' });
    if (joined.error) throw joined.error;
    const james = await gabriel.rpc('add_managed_member', { name: 'James' });
    if (james.error) throw james.error;
    ids.james = james.data;
    const me = await admin.from('members').select('id, family_id').eq('user_id', userIds[0] as string).single();
    if (me.error) throw me.error;
    ids.gabriel = me.data.id;
    ids.family = me.data.family_id;
    const tz = await gabriel.rpc('claim_home_time_zone', { tz: TZ });
    if (tz.error) throw tz.error;
    // Eva's quiet hours run until 10:00; her iPad has reminders off.
    const quiet = await eva.from('member_calendar_settings').insert({ family_id: ids.family, quiet_from: '22:00', quiet_to: '10:00' });
    if (quiet.error) throw quiet.error;
    await register(gabriel, 'gabriel', { clock_24h: true });
    await register(eva, 'eva', { clock_24h: false });
    await register(eva, 'evaipad', { todo_on: false });

    ids.plumber = await add({ title: 'Call the plumber', due_date: PLUMBER, time: '15:00', rollover: 'hour', assignee: ids.gabriel });
    ids.bins = await add({ title: 'Bins', due_date: BINS, time: null, rollover: 'day' });
    ids.swim = await add({ title: 'Pack the swim bag', due_date: SWIM, time: '16:00', rollover: 'none', assignee: ids.james });
    ids.pills = await add({ title: 'Vitamins', due_date: PILLS, time: '08:00', rollover: 'none', assignee: ids.gabriel, repeat: { freq: 'daily', ends: { type: 'never' } } });
  }, 30_000);

  afterAll(async () => {
    if (ids.family) await admin.from('families').delete().eq('id', ids.family);
    for (const id of userIds) await admin.auth.admin.deleteUser(id);
  });

  beforeEach(() => {
    sent = [];
    tracked.length = 0;
  });

  it('FR-001: Gabriel gets "In 1 hour" at 14:00, with Done, In 1 hour and Tomorrow; nobody else', async () => {
    await tick(PLUMBER, '14:00');
    expect(sent).toEqual([
      expect.objectContaining({
        to: token('gabriel'),
        title: 'In 1 hour: Call the plumber',
        body: 'Due at 15:00',
        categoryId: 'todo_timed',
        interruptionLevel: 'active',
        data: expect.objectContaining({ kind: 'todo', route: `/reminders?open=${ids.plumber}` }),
      }),
    ]);
    expect(tracked).toEqual([{ event: 'reminder_notification_sent', props: { kind: 'before', rollover: 'hour' } }]);
  });

  it('SC-002: never twice for the same slot, even after the worker restarts', async () => {
    await tick(PLUMBER, '14:01');
    now = at(PLUMBER, '14:02');
    await job().run();
    expect(sent).toEqual([]);
    const claims = await admin.from('reminder_nudges').select('kind').eq('reminder_id', ids.plumber as string);
    expect(claims.data).toEqual([{ kind: 'before' }]);
  });

  it('FR-001: at its time, then a nudge on the hour', async () => {
    await tick(PLUMBER, '15:00');
    expect(sentTo('gabriel').map((m) => [m.title, m.body])).toEqual([['Now: Call the plumber', 'Nudges every hour until it’s done.']]);
    await tick(PLUMBER, '16:00');
    expect(sentTo('gabriel').map((m) => [m.title, m.body])).toEqual([['Still to do: Call the plumber', 'Was due at 15:00 · 1 hour late']]);
  });

  it('SC-003: Done stops the nudges by the next tick', async () => {
    now = at(PLUMBER, '16:30');
    await completeReminder(gabriel, ids.plumber as string, TZ, now);
    await tick(PLUMBER, '17:00');
    expect(sent).toEqual([]);
  });

  it('FR-002, FR-003: Everyone, untimed, at 09:00, to each phone with reminders on, after each one\'s quiet hours', async () => {
    await tick(BINS, '09:00');
    expect(sent.map((m) => [m.to, m.title, m.body, m.categoryId])).toEqual([[token('gabriel'), 'Today: Bins', 'Due today · for everyone', 'todo']]);
    await tick(BINS, '10:00');
    expect(sent.map((m) => [m.to, m.title, m.body])).toEqual([[token('eva'), 'Today: Bins', 'Due today · for everyone']]);
  });

  it('FR-003: a member without the app → everyone with the app, named, in their own clock', async () => {
    await tick(SWIM, '15:00');
    expect(sent.map((m) => [m.to, m.body]).sort()).toEqual([
      [token('eva'), 'Due at 4:00 PM · for James'],
      [token('gabriel'), 'Due at 16:00 · for James'],
    ]);
  });

  it('L146: a repeat nobody ticked is closed as missed when the next one comes', async () => {
    await tick(addDays(PILLS, 1), '08:00');
    const missed = await admin.from('reminder_occurrences').select('status').eq('reminder_id', ids.pills as string);
    expect(missed.data).toEqual([{ status: 'missed' }]);
    expect(tracked).toContainEqual({ event: 'reminder_missed', props: {} });
    expect(sentTo('gabriel').map((m) => m.title)).toEqual(['Now: Vitamins']);
  });
});
