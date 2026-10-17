import { InviteStatus, familyErrorOf, type FamilyError } from '@cocon/schemas';
import type { Client } from './supabase';

export type Result<T> = { ok: true; data: T } | { ok: false; error: FamilyError | 'failed' };

async function call<T>(run: () => PromiseLike<{ data: unknown; error: { message?: string } | null }>, parse: (d: unknown) => T): Promise<Result<T>> {
  try {
    const { data, error } = await run();
    if (error) return { ok: false, error: familyErrorOf(error) ?? 'failed' };
    return { ok: true, data: parse(data) };
  } catch {
    return { ok: false, error: 'failed' };
  }
}

const nothing = () => undefined;

/** The family functions of spec 003 (supabase/migrations, accounts_family). Each checks the caller. */
export function familyApi(client: Pick<Client, 'rpc'>) {
  return {
    createFamily: (familyName: string, displayName: string) =>
      call(() => client.rpc('create_family', { family_name: familyName, display_name: displayName }), String),
    createInvite: () => call(() => client.rpc('create_invite'), String),
    inviteStatus: (token: string) => call(() => client.rpc('invite_status', { token }), (d) => InviteStatus.parse(d)),
    acceptInvite: (token: string, displayName: string, replaceOwnFamily = false) =>
      call(() => client.rpc('accept_invite', { token, display_name: displayName, replace_own_family: replaceOwnFamily }), Number),
    removeMember: (userId: string) => call(() => client.rpc('remove_member', { member_id: userId }), nothing),
    makeOwner: (userId: string) => call(() => client.rpc('make_owner', { member_id: userId }), nothing),
    setDisplayName: (name: string) => call(() => client.rpc('set_display_name', { display_name: name }), nothing),
    deleteFamily: () => call(() => client.rpc('delete_family'), Number),
    deleteMyAccount: () => call(() => client.rpc('delete_my_account'), nothing),
  };
}

export type FamilyApi = ReturnType<typeof familyApi>;
