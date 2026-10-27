// @vitest-environment node
// Spec 035 against local Supabase. US1: Eva adds "Yoga" and Gabriel's open app hears about it
// within a second, as it does for its checklist and a "this event only" change; Sam, in another
// family, hears nothing. US2: through the shared data layer Gabriel only ever gets "Busy" for
// Eva's private event. Edge case: two saves in a row, the last one wins and both are heard.
// Skipped with a notice when local Supabase isn't running (CI starts it).
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient, type RealtimeChannel } from '@supabase/supabase-js';
import { ChangeEvent, familyChannel, type Database } from '@cocon/schemas';
import { loadEvent, loadEvents, saveEvent, saveException, setChecklistDone } from '@cocon/data';
import { clientOptions as options, localSupabase, signInPerson, type Client } from '../test/local-supabase';

const local = localSupabase();
if (!local && process.env.CI) throw new Error('Local Supabase must be running in CI for the events integration test');
if (!local) console.warn('events.integration.test.ts skipped: local Supabase is not running (pnpm dev starts it).');

describe.skipIf(!local)('events against local Supabase', () => {
  const { url, anonKey, serviceKey } = local ?? { url: '', anonKey: '', serviceKey: '' };
  const admin = createClient<Database>(url, serviceKey, options);
  const run = randomUUID().slice(0, 8);
  const userIds: string[] = [];
  const channels: [Client, RealtimeChannel][] = [];
  const heard: (ChangeEvent & { at: number })[] = [];
  let gabriel: Client;
  let eva: Client;
  let sam: Client;
  let familyId: string;
  let evaMember: string;

  const person = (name: string) => signInPerson(admin, url, anonKey, `events-${name}-${run}@example.com`, userIds);

  async function listen(client: Client, onChange: (change: ChangeEvent) => void): Promise<string> {
    await client.realtime.setAuth();
    const channel = client.channel(familyChannel(familyId), { config: { private: true } });
    channels.push([client, channel]);
    channel.on('broadcast', { event: 'change' }, ({ payload }) => {
      const change = ChangeEvent.safeParse(payload);
      if (change.success) onChange(change.data);
    });
    return new Promise((resolve) => {
      channel.subscribe((status) => {
        if (status !== 'CLOSED') resolve(status);
      });
    });
  }

  /** When Gabriel heard a change to `table` matching `match`, after `since`; fails after 5 s. */
  async function heardBy(table: ChangeEvent['table'], match: (c: ChangeEvent) => boolean, since: number): Promise<number> {
    for (let waited = 0; waited < 5000; waited += 10) {
      const change = heard.find((c) => c.table === table && c.at >= since && match(c));
      if (change) return change.at;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error(`Gabriel never heard a change to ${table}`);
  }

  beforeAll(async () => {
    [gabriel, eva, sam] = await Promise.all([person('gabriel'), person('eva'), person('sam')]);
    const fam = await gabriel.rpc('create_family', { family_name: 'Events test', display_name: 'Gabriel' });
    if (fam.error) throw fam.error;
    familyId = fam.data;
    const invite = await gabriel.rpc('create_invite');
    if (invite.error) throw invite.error;
    const joined = await eva.rpc('accept_invite', { token: invite.data, display_name: 'Eva' });
    if (joined.error) throw joined.error;
    const other = await sam.rpc('create_family', { family_name: 'Other family', display_name: 'Sam' });
    if (other.error) throw other.error;
    const me = await eva.from('members').select('id').eq('display_name', 'Eva').single();
    if (me.error) throw me.error;
    evaMember = me.data.id;
  }, 30_000);

  afterAll(async () => {
    for (const [client, channel] of channels) await client.removeChannel(channel);
    for (const id of userIds) await admin.auth.admin.deleteUser(id);
  });

  it('US1: Eva adds Yoga and Gabriel hears it within a second, details and all', async () => {
    expect(await listen(gabriel, (change) => heard.push({ ...change, at: performance.now() }))).toBe('SUBSCRIBED');
    const samHeard: ChangeEvent[] = [];
    expect(await listen(sam, (change) => samHeard.push(change))).not.toBe('SUBSCRIBED');

    let start = performance.now();
    const id = await saveEvent(eva, { title: 'Yoga', starts_on: '2026-11-03', ends_on: '2026-11-03', time_type: 'slot', slots: ['evening'], members: [evaMember], checklist: [{ label: 'Mat' }] });
    expect((await heardBy('events', (c) => c.id === id && c.op === 'insert', start)) - start).toBeLessThan(1000);

    // What Gabriel's refetch returns.
    const [yoga] = await loadEvents(gabriel, '2026-11-01', '2026-11-30');
    expect(yoga).toMatchObject({ id, title: 'Yoga', members: [evaMember], source: 'app' });

    const item = yoga?.checklist?.[0]?.id ?? '';
    start = performance.now();
    await setChecklistDone(gabriel, item, true);
    expect((await heardBy('event_checklist_items', (c) => c.id === item, start)) - start).toBeLessThan(1000);

    start = performance.now();
    await saveException(eva, familyId, id, { occurrence_date: '2026-11-03', override: { slots: ['afternoon'] } });
    expect((await heardBy('event_exceptions', (c) => c.op === 'insert', start)) - start).toBeLessThan(1000);

    expect(samHeard).toEqual([]);
    expect(await loadEvents(sam, '2026-11-01', '2026-11-30')).toEqual([]);
  }, 30_000);

  it('US2: Gabriel only ever gets "Busy" for Eva\'s private event', async () => {
    const id = await saveEvent(eva, {
      title: 'Therapist', location: 'Rue Oberkampf', notes: 'Bring the letter', starts_on: '2026-11-05', ends_on: '2026-11-05',
      time_type: 'custom', start_time: '14:30', end_time: '15:30', members: [evaMember], visibility: 'private', checklist: [{ label: 'Letter' }],
    });
    const seen = await loadEvent(gabriel, id);
    expect(seen).toMatchObject({ title: 'Busy', location: null, notes: null, checklist: null, members: [evaMember], start_time: '14:30', visibility: 'private' });
    expect(JSON.stringify(seen)).not.toMatch(/Therapist|Oberkampf|letter/i);
    const direct = await gabriel.from('events').select('title').eq('id', id);
    expect(direct.data).toEqual([]);
    expect((await loadEvent(eva, id))?.title).toBe('Therapist');
  }, 30_000);

  it('last write wins, and both saves reach the other screen', async () => {
    const draft = { title: 'Swim', starts_on: '2026-11-07', ends_on: '2026-11-07', time_type: 'all_day', members: ['everyone'] };
    const id = await saveEvent(eva, draft);
    const start = performance.now();
    await saveEvent(eva, { ...draft, title: 'Swim lesson' }, id);
    await saveEvent(gabriel, { ...draft, title: 'Swimming' }, id);
    const updates = () => new Set(heard.filter((c) => c.id === id && c.op === 'update' && c.at >= start).map((c) => c.by));
    for (let waited = 0; updates().size < 2 && waited < 5000; waited += 10) await new Promise((resolve) => setTimeout(resolve, 10));
    expect(updates().size).toBe(2);
    expect((await loadEvent(eva, id))?.title).toBe('Swimming');
  }, 30_000);
});
