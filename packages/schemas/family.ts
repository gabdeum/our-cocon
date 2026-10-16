import { z } from 'zod';

/**
 * Spec 003 inputs. The database checks the same limits (supabase/migrations, accounts_family);
 * these give the forms an answer before anything is sent.
 */
export const DisplayName = z.string().trim().min(1).max(40);
export const FamilyName = z.string().trim().min(1).max(60);
export const Email = z.string().trim().toLowerCase().pipe(z.email());
/** 32 random bytes, base64url without padding (create_invite). */
export const InviteToken = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
export const MemberRole = z.enum(['owner', 'editor']);
export const AvatarTone = z.enum(['honey', 'sage', 'peach']);
export const SignInMethod = z.enum(['email', 'google']);

export type MemberRole = z.infer<typeof MemberRole>;
export type AvatarTone = z.infer<typeof AvatarTone>;
export type SignInMethod = z.infer<typeof SignInMethod>;

/** What invite_status returns. */
export const InviteStatus = z.discriminatedUnion('status', [
  z.object({ status: z.literal('valid'), family_name: z.string(), inviter_name: z.string() }),
  z.object({ status: z.literal('expired') }),
]);
export type InviteStatus = z.infer<typeof InviteStatus>;

/** Error codes raised by the family functions, as the app maps them to copy. */
export const FamilyError = z.enum([
  'not_signed_in',
  'not_in_family',
  'not_owner',
  'already_in_family',
  'already_in_this_family',
  'own_family_has_members',
  'invite_expired',
  'rate_limited',
  'cannot_remove_self',
  'not_a_member',
  'owner_must_delete_family',
]);
export type FamilyError = z.infer<typeof FamilyError>;

export function familyErrorOf(error: { message?: string } | null | undefined): FamilyError | null {
  const parsed = FamilyError.safeParse(error?.message);
  return parsed.success ? parsed.data : null;
}
