// @vitest-environment node
// Spec 021 against local Supabase: US2 (Mia picks European stores and Alex's list buys 2 × 20 cl),
// US3 (round-up off), and FR-004 (the family's own pack size replaces the catalog's, for this family
// only, and can be put back). Skipped with a notice when Supabase isn't running locally.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@cocon/schemas';
import { clientOptions as options, localSupabase, signInPerson, type Client } from '../test/local-supabase';
import { loadFamilySettings, saveFamilySettings } from './family-settings';
import { addItem, loadGroceryList, loadPacks, packKeys, rowAmounts, savePackSize } from './groceries';

const local = localSupabase();
if (!local && process.env.CI) throw new Error('Local Supabase must be running in CI for the family settings integration test');
if (!local) console.warn('family-settings.integration.test.ts skipped: local Supabase is not running (pnpm dev starts it).');

describe.skipIf(!local)('store sizes against local Supabase', () => {
  const { url, anonKey, serviceKey } = local ?? { url: '', anonKey: '', serviceKey: '' };
  const admin = createClient<Database>(url, serviceKey, options);
  const run = randomUUID().slice(0, 8);
  const userIds: string[] = [];
  let alex: Client;
  let mia: Client;
  let sam: Client;
  let familyId: string;
  let samFamilyId: string;

  const person = (name: string) => signInPerson(admin, url, anonKey, `stores-${name}-${run}@example.com`, userIds);

  /** Alex's list as the screen shows it, with the family's settings as they are now. */
  const creamRow = async (client: Client) => {
    const [items, settings] = await Promise.all([loadGroceryList(client), loadFamilySettings(client)]);
    const packs = await loadPacks(client, packKeys(items));
    const cream = items.find((i) => i.catalog_key === 'heavy_cream');
    if (!cream) throw new Error('Heavy cream is not on the list');
    return rowAmounts(items, packs, settings).get(cream.id);
  };

  beforeAll(async () => {
    [alex, mia, sam] = await Promise.all([person('alex'), person('mia'), person('sam')]);
    const fam = await alex.rpc('create_family', { family_name: 'Stores test', display_name: 'Alex' });
    if (fam.error) throw fam.error;
    familyId = fam.data;
    const invite = await alex.rpc('create_invite');
    if (invite.error) throw invite.error;
    const joined = await mia.rpc('accept_invite', { token: invite.data, display_name: 'Mia' });
    if (joined.error) throw joined.error;
    const other = await sam.rpc('create_family', { family_name: 'Other stores test', display_name: 'Sam' });
    if (other.error) throw other.error;
    samFamilyId = other.data;
    expect(await addItem(alex, familyId, [], '300 ml heavy cream')).toMatchObject({ status: 'added' });
  }, 30_000);

  afterAll(async () => {
    for (const id of userIds) await admin.auth.admin.deleteUser(id);
  });

  it('US1: a new family shops in US stores, rounding up', async () => {
    expect(await loadFamilySettings(alex)).toEqual({ store_profile: 'us', round_to_packs: true });
    expect(await creamRow(alex)).toEqual({ buy: 'Buy 1 pint carton', need: 'Need 300 ml · ~170 ml left over' });
  });

  it('US2: Mia picks European stores, and Alex’s list follows', async () => {
    expect((await saveFamilySettings(mia, familyId, { store_profile: 'eu' })).error).toBeNull();
    expect(await creamRow(alex)).toEqual({ buy: 'Buy 2 × 20 cl', need: 'Need 300 ml · 100 ml left over' });
    // Another family keeps its own.
    expect(await loadFamilySettings(sam)).toEqual({ store_profile: 'us', round_to_packs: true });
  });

  it('US3: with round-up off, only what recipes need', async () => {
    expect((await saveFamilySettings(alex, familyId, { round_to_packs: false })).error).toBeNull();
    expect(await creamRow(mia)).toEqual({ need: 'Need 300 ml' });
    expect(await loadFamilySettings(alex)).toEqual({ store_profile: 'eu', round_to_packs: false });
    await saveFamilySettings(alex, familyId, { round_to_packs: true });
  });

  it('FR-004: the family’s own pack size replaces the catalog’s, for that family only', async () => {
    expect(await savePackSize(mia, familyId, { catalog_key: 'heavy_cream' }, '25 cl')).toBe('saved');
    expect(await creamRow(alex)).toEqual({ buy: 'Buy 2 × 25 cl', need: 'Need 300 ml · 200 ml left over' });
    const theirs = await loadPacks(sam, ['heavy_cream']);
    expect(theirs.heavy_cream?.corrected).toBeNull();
    expect(theirs.heavy_cream?.packs.eu[0]?.label).toBe('20 cl');
    // Back to the usual sizes.
    expect(await savePackSize(alex, familyId, { catalog_key: 'heavy_cream' }, null)).toBe('saved');
    expect(await creamRow(alex)).toEqual({ buy: 'Buy 2 × 20 cl', need: 'Need 300 ml · 100 ml left over' });
  });

  it('a member of another family can not change these settings', async () => {
    const { error } = await saveFamilySettings(sam, familyId, { store_profile: 'us' });
    // The upsert lands in Sam's own family (the database sets the family), never Alex's.
    expect(error).toBeNull();
    expect((await loadFamilySettings(alex)).store_profile).toBe('eu');
    expect(samFamilyId).not.toBe(familyId);
  });
});
