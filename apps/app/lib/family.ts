import { InviteAccepted, InviteStatus, TimeZone, familyErrorOf, type FamilyError, type MemberColor } from '@cocon/schemas';
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

/**
 * Spec 045 FR-009: deleting an account goes through the delete-account Edge Function, which runs
 * `delete_my_account` as the member and then revokes their Sign in with Apple. Its refusals carry
 * the database's message, as the RPC's do.
 */
async function deleteAccount(client: Pick<Client, 'functions'>) {
  const { error } = await client.functions.invoke('delete-account', { method: 'POST' });
  if (!error) return { data: null, error: null };
  const context = (error as { context?: { json?: () => Promise<unknown> } }).context;
  const body = (await context?.json?.().catch(() => null)) as { message?: unknown } | null | undefined;
  return { data: null, error: { message: typeof body?.message === 'string' ? body.message : error.message } };
}

/** The family functions of spec 003 (supabase/migrations, accounts_family). Each checks the caller. */
export function familyApi(client: Pick<Client, 'rpc' | 'functions'>) {
  return {
    createFamily: (familyName: string, displayName: string) =>
      call(() => client.rpc('create_family', { family_name: familyName, display_name: displayName }), String),
    /** `forMember`: a link for that member without the app (spec 033 FR-006). */
    createInvite: (forMember?: string) => call(() => client.rpc('create_invite', forMember ? { for_member: forMember } : {}), String),
    inviteStatus: (token: string) => call(() => client.rpc('invite_status', { token }), (d) => InviteStatus.parse(d)),
    acceptInvite: (token: string, displayName: string, replaceOwnFamily = false) =>
      call(() => client.rpc('accept_invite', { token, display_name: displayName, replace_own_family: replaceOwnFamily }), (d) => InviteAccepted.parse(d)),
    removeMember: (userId: string) => call(() => client.rpc('remove_member', { member_id: userId }), nothing),
    makeOwner: (userId: string) => call(() => client.rpc('make_owner', { member_id: userId }), nothing),
    setDisplayName: (name: string) => call(() => client.rpc('set_display_name', { display_name: name }), nothing),
    deleteFamily: () => call(() => client.rpc('delete_family'), Number),
    deleteMyAccount: () => call(() => deleteAccount(client), nothing),
    // Spec 033: members without the app (any member) and member colors.
    addManagedMember: (name: string, color?: MemberColor) =>
      call(() => client.rpc('add_managed_member', color ? { name, pick: color } : { name }), String),
    renameManagedMember: (memberId: string, name: string) => call(() => client.rpc('rename_managed_member', { member_id: memberId, name }), nothing),
    removeManagedMember: (memberId: string) => call(() => client.rpc('remove_managed_member', { member_id: memberId }), nothing),
    /** Spec 035 (032-later L78): how many of their events are still to come, for the Remove dialog. */
    managedMemberUpcomingEvents: (memberId: string) => call(() => client.rpc('managed_member_upcoming_events', { member_id: memberId }), Number),
    setMemberColor: (memberId: string, color: MemberColor) => call(() => client.rpc('set_member_color', { member_id: memberId, pick: color }), nothing),
    /** Spec 035: the family's home time zone, from the first device that opens the app (a no-op once set). */
    claimHomeTimeZone: (timeZone: string) => call(() => client.rpc('claim_home_time_zone', { tz: TimeZone.parse(timeZone) }), nothing),
  };
}

export type FamilyApi = ReturnType<typeof familyApi>;
