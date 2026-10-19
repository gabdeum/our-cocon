// @vitest-environment node
// Spec 004 US1 and SC-001 against local Supabase: when Alex writes, Mia's open app hears about it
// within a second (p95), and Sam, in another family, hears nothing. Also FR-005: the seeded
// variants match the shared VariantChange schema. Needs local Supabase (`pnpm dev` starts it;
// CI starts it before the tests). Locally it is skipped with a notice when Supabase isn't running.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient, type RealtimeChannel } from '@supabase/supabase-js';
import { ChangeEvent, VariantChange, familyChannel, type Database } from '@cocon/schemas';
import { clientOptions as options, localSupabase, signInPerson, type Client } from '../test/local-supabase';

const local = localSupabase();
if (!local && process.env.CI) throw new Error('Local Supabase must be running in CI for the sync integration test');
if (!local) console.warn('sync.integration.test.ts skipped: local Supabase is not running (pnpm dev starts it).');

describe.skipIf(!local)('live changes against local Supabase', () => {
  const { url, anonKey, serviceKey } = local ?? { url: '', anonKey: '', serviceKey: '' };
  const admin = createClient<Database>(url, serviceKey, options);
  const run = randomUUID().slice(0, 8);
  const userIds: string[] = [];
  const channels: [Client, RealtimeChannel][] = [];
  let alex: Client;
  let mia: Client;
  let sam: Client;
  let familyId: string;

  const person = (name: string) => signInPerson(admin, url, anonKey, `sync-${name}-${run}@example.com`, userIds);

  /** Listens on a family channel the way SyncProvider does. Resolves once joined, or on refusal. */
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

  beforeAll(async () => {
    [alex, mia, sam] = await Promise.all([person('alex'), person('mia'), person('sam')]);
    const fam = await alex.rpc('create_family', { family_name: 'Sync test', display_name: 'Alex' });
    if (fam.error) throw fam.error;
    familyId = fam.data;
    const invite = await alex.rpc('create_invite');
    if (invite.error) throw invite.error;
    const joined = await mia.rpc('accept_invite', { token: invite.data, display_name: 'Mia' });
    if (joined.error) throw joined.error;
    const other = await sam.rpc('create_family', { family_name: 'Other family', display_name: 'Sam' });
    if (other.error) throw other.error;
  }, 30_000);

  afterAll(async () => {
    for (const [client, channel] of channels) await client.removeChannel(channel);
    // Deleting the people removes their families and everything in them.
    for (const id of userIds) await admin.auth.admin.deleteUser(id);
  });

  it('delivers each of 20 writes to another member within 1 s at p95, and nothing to another family', async () => {
    const waiting = new Map<string, (at: number) => void>();
    expect(await listen(mia, (change) => waiting.get(change.id)?.(performance.now()))).toBe('SUBSCRIBED');
    const samHeard: ChangeEvent[] = [];
    // Realtime refuses Sam's subscription (realtime.messages policy): an error, or a timeout under load.
    expect(await listen(sam, (change) => samHeard.push(change))).not.toBe('SUBSCRIBED');

    const latencies: number[] = [];
    for (let i = 0; i < 20; i += 1) {
      const id = randomUUID();
      const heard = new Promise<number>((resolve, reject) => {
        waiting.set(id, resolve);
        setTimeout(() => reject(new Error(`Mia never heard about write ${i + 1}`)), 5000);
      });
      const start = performance.now();
      // Alternate between a grocery item and a recipe (FR-002 tables).
      const write =
        i % 2 === 0
          ? await alex.from('grocery_items').insert({ id, name: `Item ${i}`, family_id: familyId })
          : await alex.from('recipes').insert({ id, name: `Recipe ${i}`, family_id: familyId });
      expect(write.error).toBeNull();
      latencies.push((await heard) - start);
    }

    latencies.sort((a, b) => a - b);
    const p95 = latencies[Math.ceil(latencies.length * 0.95) - 1] ?? Infinity;
    expect(p95).toBeLessThan(1000);

    // Mia's refetch (what SyncProvider triggers) returns the new rows through RLS.
    const seen = await mia.from('grocery_items').select('id').eq('family_id', familyId);
    expect(seen.data).toHaveLength(10);
    // Sam, in another family, got no message and reads none of the rows.
    expect(samHeard).toEqual([]);
    const samReads = await sam.from('grocery_items').select('id').eq('family_id', familyId);
    expect(samReads.data).toEqual([]);
  }, 60_000);

  it('seeds variants whose changes match the shared schema (FR-005)', async () => {
    const { data, error } = await admin.from('recipe_variants').select('name, changes');
    expect(error).toBeNull();
    expect(data?.length).toBeGreaterThanOrEqual(2);
    for (const variant of data ?? []) {
      expect(VariantChange.array().safeParse(variant.changes).success, variant.name).toBe(true);
    }
  });
});
