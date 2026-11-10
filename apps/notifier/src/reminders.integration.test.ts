// Spec 049 against local Supabase: the reminders job finds what's due, sends it to the right
// phones with the right words, never twice (SC-003), follows a moved event and skips a deleted one.
// Expo is a fake; the clock is set. Skipped with a notice when Supabase isn't running locally.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { addDays, todayIn, zonedInstant } from '@cocon/calendar';
import { createNotifier } from '@cocon/notify';
import { createTracker, type Database, type Json } from '@cocon/schemas';
import { clientOptions, localSupabase, signInPerson, type Client } from '../test/local';
import { createReminderJob } from './reminders';

const local = localSupabase();
if (!local && process.env.CI) throw new Error('Local Supabase must be running in CI for the reminders integration test');
if (!local) console.warn('reminders.integration.test.ts skipped: local Supabase is not running (pnpm dev starts it).');

const TZ = 'America/New_York';
const at = (date: string, time: string) => zonedInstant(date, time, TZ);
// The stories happen from the day after tomorrow: an event gets no reminder when it was added after
// its reminder time, so fixed dates stopped sending once the real date passed them.
const day = (n: number) => addDays(todayIn(TZ), 2 + n);
const SWIM = day(0);
const BIRTHDAY_EVE = day(1);
const BIRTHDAY = day(2);
const DOCTOR = day(4);
const GONE = day(5);
const weekdayOf = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });

describe.skipIf(!local)('event reminders against local Supabase', () => {
  const { url, anonKey, serviceKey } = local ?? { url: '', anonKey: '', serviceKey: '' };
  const admin = createClient<Database>(url, serviceKey, clientOptions);
  const run = randomUUID().slice(0, 8);
  const userIds: string[] = [];
  let gabriel: Client;
  let eva: Client;
  const ids: Record<string, string> = {};
  const token = (name: string) => `ExponentPushToken[${name}${run}]`;
  type Sent = { to: string; title: string; body: string; data: { route: string } };
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
  const job = () => createReminderJob(admin, createNotifier(admin, { fetch }, () => now), analytics, () => now);
  const gabrielId = () => ids.gabriel as string;
  const sentTo = (name: string) => sent.filter((m) => m.to === token(name));

  const register = async (client: Client, name: string, prefs: Json = {}) => {
    const { error } = await client.rpc('register_push_device', { p_device_id: `${name}-${run}-device`, p_platform: 'ios', p_token: token(name), p_prefs: prefs, p_app_version: '1.0.0' });
    if (error) throw error;
  };
  const save = async (fields: Record<string, unknown>, members: Json, id?: string) => {
    const { data, error } = await gabriel.rpc('save_event', { p_event: fields as Json, p_members: members, ...(id ? { p_id: id } : {}) });
    if (error) throw error;
    return data;
  };

  beforeAll(async () => {
    gabriel = await signInPerson(admin, url, anonKey, `reminders-gabriel-${run}@example.com`, userIds);
    const fam = await gabriel.rpc('create_family', { family_name: 'Reminders test', display_name: 'Gabriel' });
    if (fam.error) throw fam.error;
    const invite = await gabriel.rpc('create_invite', {});
    if (invite.error) throw invite.error;
    eva = await signInPerson(admin, url, anonKey, `reminders-eva-${run}@example.com`, userIds);
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
    await register(gabriel, 'gabriel', { clock_24h: true });
    await register(eva, 'evamine', { reminders_scope: 'mine' });
    await register(eva, 'evaall', { reminders_scope: 'all', clock_24h: false });

    // Story 1: Baby swim class at 14:30, for James; Gabriel takes him.
    ids.swim = await save(
      { title: 'Baby swim class', location: 'Aquatic Center', starts_on: SWIM, ends_on: SWIM, time_type: 'custom', start_time: '14:30', end_time: '15:15', reminder: 'hour_before', responsible_member_id: ids.gabriel },
      [ids.james],
    );
    // Story 2: Eva's birthday, all day, everyone.
    ids.birthday = await save({ title: 'Eva’s birthday', starts_on: BIRTHDAY, ends_on: BIRTHDAY, time_type: 'all_day', reminder: 'day_before' }, ['everyone']);
  }, 30_000);

  afterAll(async () => {
    if (ids.family) await admin.from('families').delete().eq('id', ids.family);
    for (const id of userIds) await admin.auth.admin.deleteUser(id);
  });

  beforeEach(() => {
    sent = [];
    tracked.length = 0;
  });

  it('Story 1: Gabriel gets "Baby swim class in 1 hour" at 13:30; Eva only on her "All family events" phone', async () => {
    now = at(SWIM, '13:30');
    await job().run();
    expect(sentTo('gabriel')).toEqual([
      expect.objectContaining({ title: 'Baby swim class in 1 hour', body: '14:30 · Aquatic Center · Gabriel takes James', data: expect.objectContaining({ route: `/calendar/${ids.swim}?date=${SWIM}` }) }),
    ]);
    expect(sentTo('evamine')).toEqual([]);
    expect(sentTo('evaall').map((m) => m.body)).toEqual(['2:30 PM · Aquatic Center · Gabriel takes James']);
    expect(tracked).toContainEqual({ event: 'event_reminder_sent', props: { kind: 'hour_before', recipients: 2 } });
  });

  it('SC-003: never twice, even after the worker restarts', async () => {
    now = at(SWIM, '13:31');
    await job().run();
    await job().run();
    expect(sent).toEqual([]);
    const claims = await admin.from('reminder_deliveries').select('member_id').eq('event_id', ids.swim as string);
    expect(claims.data).toHaveLength(2);
  });

  it('Story 2: the evening before, to everyone on it', async () => {
    now = at(BIRTHDAY_EVE, '18:00');
    await job().run();
    expect(sent.map((m) => [m.to, m.title, m.body]).sort()).toEqual(
      [
        [token('evaall'), 'Tomorrow: Eva’s birthday', `All day · ${weekdayOf(BIRTHDAY)}`],
        [token('evamine'), 'Tomorrow: Eva’s birthday', `All day · ${weekdayOf(BIRTHDAY)}`],
        [token('gabriel'), 'Tomorrow: Eva’s birthday', `All day · ${weekdayOf(BIRTHDAY)}`],
      ].sort(),
    );
  });

  it('Story 3: a moved event reminds at its new time; a deleted one sends nothing', async () => {
    const fields = { title: 'Pediatrician', location: 'Dr. Lee', starts_on: DOCTOR, ends_on: DOCTOR, time_type: 'custom', start_time: '10:00', end_time: '10:30', reminder: 'hour_before' };
    const id = await save(fields, [gabrielId()]);
    await save({ ...fields, start_time: '11:00', end_time: '11:30' }, [gabrielId()], id);
    now = at(DOCTOR, '09:00');
    await job().run();
    expect(sentTo('gabriel')).toEqual([]);
    now = at(DOCTOR, '10:00');
    await job().run();
    expect(sentTo('gabriel').map((m) => m.title)).toEqual(['Pediatrician in 1 hour']);

    const gone = await save({ ...fields, starts_on: GONE, ends_on: GONE }, [gabrielId()]);
    const deleted = await admin.from('events').update({ deleted_at: new Date().toISOString() }).eq('id', gone);
    if (deleted.error) throw deleted.error;
    sent = [];
    now = at(GONE, '09:00');
    await job().run();
    expect(sent).toEqual([]);
  });
});
