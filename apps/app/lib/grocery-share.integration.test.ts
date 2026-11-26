// @vitest-environment node
// Spec 072 against local Supabase: a member creates the link; a guest, signed out, is pinged on the
// link's public topic when the list changes (FR-006), and the endpoint's functions read and write
// only through a live link (FR-003–005). Skipped with a notice when Supabase isn't running locally.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createClient, type RealtimeChannel } from '@supabase/supabase-js';
import type { Database } from '@cocon/schemas';
import { clientOptions as options, localSupabase, signInPerson, type Client } from '../test/local-supabase';
import { createGroceryShare, loadGroceryShare, setGroceryShareOptions, stopGroceryShare } from './grocery-share';
import { addItem, loadGroceryList, sourceLine } from './groceries';
import { sharedAdd, sharedGroceriesTopic } from './shared-groceries';

vi.mock('expo-clipboard', () => ({ setStringAsync: vi.fn() }));
vi.mock('expo-linking', () => ({ createURL: (p: string) => `ourcocon://${p}` }));

const local = localSupabase();
if (!local && process.env.CI) throw new Error('Local Supabase must be running in CI for the grocery share integration test');
if (!local) console.warn('grocery-share.integration.test.ts skipped: local Supabase is not running (pnpm dev starts it).');

describe.skipIf(!local)('the shared grocery list against local Supabase', () => {
  const { url, anonKey, serviceKey } = local ?? { url: '', anonKey: '', serviceKey: '' };
  const admin = createClient<Database>(url, serviceKey, options);
  // The guest: no session, the anon key only.
  const guest = createClient<Database>(url, anonKey, options);
  const run = randomUUID().slice(0, 8);
  const userIds: string[] = [];
  let alex: Client;
  let alexId: string;
  let familyId: string;
  let channel: RealtimeChannel | null = null;

  beforeAll(async () => {
    alex = await signInPerson(admin, url, anonKey, `grocery-share-alex-${run}@example.com`, userIds);
    alexId = (await alex.auth.getUser()).data.user?.id ?? '';
    const fam = await alex.rpc('create_family', { family_name: 'Share test', display_name: 'Alex' });
    if (fam.error) throw fam.error;
    familyId = fam.data;
  }, 30_000);

  afterAll(async () => {
    if (channel) await guest.removeChannel(channel);
    for (const id of userIds) await admin.auth.admin.deleteUser(id);
  });

  it('US1: a member creates one link, and the sheet finds it again', async () => {
    const made = await createGroceryShare(alex, 'today', true);
    expect(made).toMatchObject({ duration: 'today', can_edit: true, created: true });
    expect((await createGroceryShare(alex, '1h', false)).created).toBe(false);
    expect(await loadGroceryShare(alex)).toMatchObject({ token: made.token, duration: 'today' });
  });

  it('FR-006: a member\'s change pings the guest\'s public topic', async () => {
    const link = await loadGroceryShare(alex);
    if (!link) throw new Error('No link');
    const pinged = new Promise<unknown>((resolve) => {
      channel = guest.channel(sharedGroceriesTopic(link.token)).on('broadcast', { event: 'change' }, ({ payload }) => resolve(payload));
    });
    await new Promise<void>((resolve, reject) =>
      channel?.subscribe((status) => {
        if (status === 'SUBSCRIBED') resolve();
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') reject(new Error(status));
      }),
    );
    expect(await addItem(alex, familyId, alexId, [], '2 lemons')).toMatchObject({ status: 'added' });
    // Content-free: which table, never the row (Realtime adds its own message id).
    const payload = (await pinged) as Record<string, unknown>;
    expect(payload.table).toBe('grocery_items');
    expect(Object.keys(payload).sort()).toEqual(['id', 'table']);
  }, 15_000);

  it('FR-004/005: the endpoint adds as a guest, ticks and removes, through the live link only', async () => {
    const link = await loadGroceryShare(alex);
    if (!link) throw new Error('No link');
    const add = sharedAdd('3 onions');
    if (!add) throw new Error('Nothing to add');
    const added = await admin.rpc('shared_grocery_add', { p_token: link.token, p_name: add.name, p_quantity: add.quantity as number, p_unit: add.unit as string, p_full: add.full, p_core: add.core });
    expect(added.error).toBeNull();
    const onions = (await loadGroceryList(alex)).find((i) => i.name === 'Onions');
    expect(onions).toMatchObject({ quantity: 3, unit: 'piece', aisle: 'produce', catalog_key: 'onion', created_by: null, source: 'link' });
    expect(sourceLine(onions as NonNullable<typeof onions>, [])).toBe('Added via the shared link');

    await setGroceryShareOptions(alex, link.token, { can_edit: false });
    const refused = await admin.rpc('shared_grocery_clear', { p_token: link.token, p_ids: [onions?.id ?? ''] });
    expect(refused.error?.message).toBe('read_only');

    await stopGroceryShare(alex, link.token);
    expect((await admin.rpc('shared_groceries', { p_token: link.token })).data).toBeNull();
    expect(await loadGroceryShare(alex)).toBeNull();
    // Signed out, nobody reaches the functions directly.
    expect((await guest.rpc('shared_groceries', { p_token: link.token })).error).not.toBeNull();
  });
});
