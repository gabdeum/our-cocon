// @vitest-environment node
// Spec 045 FR-009 against local Supabase: "Delete my account" goes through the delete-account Edge
// Function, which deletes as the member (the database's own checks still apply) and queues their
// Sign in with Apple token to be revoked. Locally Apple isn't set up, so the token stays queued.
// Skipped with a notice when Supabase isn't running locally.
import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@cocon/schemas';
import { clientOptions as options, localSupabase, signInPerson } from '../test/local-supabase';
import { familyApi } from './family';

const local = localSupabase();
if (!local && process.env.CI) throw new Error('Local Supabase must be running in CI for the delete account integration test');
if (!local) console.warn('delete-account.integration.test.ts skipped: local Supabase is not running (pnpm dev starts it).');

describe.skipIf(!local)('deleting an account, against local Supabase', () => {
  const { url, anonKey, serviceKey } = local ?? { url: '', anonKey: '', serviceKey: '' };
  const admin = createClient<Database>(url, serviceKey, options);
  const run = randomUUID().slice(0, 8);
  const userIds: string[] = [];
  const person = (name: string) => signInPerson(admin, url, anonKey, `delete-${name}-${run}@example.com`, userIds);

  // Deleting a person queues their Apple token; clear what this run queued.
  const clearQueue = async (id: string) => {
    const { data } = await admin.rpc('apple_tokens_to_revoke', { p_user: id });
    for (const q of data ?? []) await admin.rpc('apple_revocation_tried', { p_id: q.id, p_revoked: true });
  };

  afterAll(async () => {
    for (const id of userIds) {
      await admin.auth.admin.deleteUser(id);
      await clearQueue(id);
    }
  });

  it("deletes the account and queues its Apple token for revoking", async () => {
    const eva = await person('eva');
    const { data: user } = await eva.auth.getUser();
    const id = user.user?.id ?? '';
    expect((await admin.rpc('apple_keep_token', { p_user: id, p_token: `r-${run}` })).error).toBeNull();

    expect(await familyApi(eva).deleteMyAccount()).toEqual({ ok: true, data: undefined });
    expect((await admin.auth.admin.getUserById(id)).data.user).toBeNull();
    const { data: queued } = await admin.rpc('apple_tokens_to_revoke', { p_user: id });
    expect(queued?.map((q) => q.refresh_token)).toEqual([`r-${run}`]);
    await clearQueue(id);
  }, 30_000);

  it('SC-004 (spec 029, L71): a member who joined by invite deletes their account; what they made stays, by a former member', async () => {
    const [gabriel, alex] = await Promise.all([person('owner'), person('joined')]);
    const fam = await familyApi(gabriel).createFamily('Joined delete test', 'Gabriel');
    if (!fam.ok) throw new Error('No family');
    const invite = await gabriel.rpc('create_invite');
    if (invite.error) throw invite.error;
    expect((await alex.rpc('accept_invite', { token: invite.data, display_name: 'Alex' })).error).toBeNull();
    const id = (await alex.auth.getUser()).data.user?.id ?? '';
    // What a member leaves behind: a recipe, a ticked grocery, an event with a ticked checklist, a changed name.
    const recipe = await alex.from('recipes').insert({ family_id: fam.data, name: 'Alex soup' }).select('id').single();
    expect(recipe.error).toBeNull();
    expect((await alex.from('grocery_items').insert({ family_id: fam.data, name: 'onion', checked: true })).error).toBeNull();
    const event = await alex.rpc('save_event', {
      p_event: { title: 'Swim', starts_on: '2026-11-03', ends_on: '2026-11-03', time_type: 'all_day', slots: [], visibility: 'family' },
      p_members: ['everyone'],
      p_checklist: [{ label: 'Towel' }],
    });
    expect(event.error).toBeNull();
    expect((await alex.from('event_checklist_items').update({ done: true }).eq('event_id', event.data ?? '')).error).toBeNull();
    expect((await alex.rpc('set_display_name', { display_name: 'Alex D' })).error).toBeNull();

    expect(await familyApi(alex).deleteMyAccount()).toEqual({ ok: true, data: undefined });
    expect((await admin.auth.admin.getUserById(id)).data.user).toBeNull();
    const { data: kept } = await gabriel.from('recipes').select('created_by').eq('id', recipe.data?.id ?? '').single();
    expect(kept).toEqual({ created_by: null });
    const { data: swim } = await gabriel.from('events').select('created_by').eq('id', event.data ?? '').single();
    expect(swim).toEqual({ created_by: null });
    await clearQueue(id);
  }, 30_000);

  it("passes on the database's refusal: an owner deletes the family first", async () => {
    const gabriel = await person('gabriel');
    expect((await familyApi(gabriel).createFamily('Delete test', 'Gabriel')).ok).toBe(true);
    expect(await familyApi(gabriel).deleteMyAccount()).toEqual({ ok: false, error: 'owner_must_delete_family' });
  }, 30_000);
});
