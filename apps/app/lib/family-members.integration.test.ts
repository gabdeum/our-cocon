// @vitest-environment node
// Spec 033 against local Supabase, through the app's family functions: US1.1 (Gabriel adds James,
// who has no account), US1.2 (James gets the app from his own link and stays the same member),
// US2 (three members, three colors) and US3 (Eva picks a free color; a taken one is refused).
// Skipped with a notice when Supabase isn't running locally.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { memberKind, type Database } from '@cocon/schemas';
import { clientOptions as options, localSupabase, signInPerson, type Client } from '../test/local-supabase';
import { familyApi } from './family';

const local = localSupabase();
if (!local && process.env.CI) throw new Error('Local Supabase must be running in CI for the family members integration test');
if (!local) console.warn('family-members.integration.test.ts skipped: local Supabase is not running (pnpm dev starts it).');

describe.skipIf(!local)('members without the app, against local Supabase', () => {
  const { url, anonKey, serviceKey } = local ?? { url: '', anonKey: '', serviceKey: '' };
  const admin = createClient<Database>(url, serviceKey, options);
  const run = randomUUID().slice(0, 8);
  const userIds: string[] = [];
  let gabriel: Client;
  let eva: Client;
  let james: Client;
  let jamesId: string;

  const person = (name: string) => signInPerson(admin, url, anonKey, `members-${name}-${run}@example.com`, userIds);
  const members = async (client: Client) => {
    const { data, error } = await client.from('members').select('*').order('joined_at');
    if (error) throw error;
    return data;
  };

  beforeAll(async () => {
    [gabriel, eva, james] = await Promise.all([person('gabriel'), person('eva'), person('james')]);
    const g = familyApi(gabriel);
    expect((await g.createFamily('Members test', 'Gabriel')).ok).toBe(true);
    const invite = await g.createInvite();
    if (!invite.ok) throw new Error(invite.error);
    expect((await familyApi(eva).acceptInvite(invite.data, 'Eva')).ok).toBe(true);
  }, 30_000);

  afterAll(async () => {
    for (const id of userIds) await admin.auth.admin.deleteUser(id);
  });

  it('US1.1 and US2: Gabriel adds James; three members, three colors', async () => {
    const added = await familyApi(gabriel).addManagedMember('James');
    if (!added.ok) throw new Error(added.error);
    jamesId = added.data;
    const list = await members(eva);
    const row = list.find((m) => m.id === jamesId);
    const gabrielRow = list.find((m) => m.display_name === 'Gabriel');
    expect(row && memberKind(row)).toBe('managed');
    expect(row?.managed_by).toBe(gabrielRow?.id);
    expect(list.map((m) => m.color)).toEqual(['honey', 'rose', 'sky']);
  });

  it('US3: Eva picks a free color; a taken one is refused', async () => {
    const e = familyApi(eva);
    const evaRow = (await members(eva)).find((m) => m.display_name === 'Eva');
    if (!evaRow) throw new Error('Eva is not in the family');
    expect(await e.setMemberColor(evaRow.id, 'honey')).toEqual({ ok: false, error: 'color_taken' });
    expect((await e.setMemberColor(evaRow.id, 'lilac')).ok).toBe(true);
    expect((await members(gabriel)).find((m) => m.id === evaRow.id)?.color).toBe('lilac');
  });

  it('US1.2: James gets the app from his own link and keeps his member and color', async () => {
    const link = await familyApi(gabriel).createInvite(jamesId);
    if (!link.ok) throw new Error(link.error);
    const status = await familyApi(james).inviteStatus(link.data);
    expect(status.ok && status.data.status === 'valid' && status.data.member_name).toBe('James');
    const joined = await familyApi(james).acceptInvite(link.data, 'James');
    expect(joined).toEqual({ ok: true, data: { days_since_sent: 0, days_since_added: 0 } });
    const list = await members(james);
    expect(list).toHaveLength(3);
    const row = list.find((m) => m.id === jamesId);
    expect(row && memberKind(row)).toBe('account');
    expect(row?.color).toBe('sky');
    expect(row?.managed_by).toBeNull();
  });
});
