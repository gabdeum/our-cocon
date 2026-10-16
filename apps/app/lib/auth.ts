import type { User } from '@supabase/supabase-js';
import { Email, type SignInMethod } from '@cocon/schemas';
import type { Client } from './supabase';
import { appUrl, safeNext } from './links';

type Auth = Client['auth'];

/** Sign-in providers besides email. Apple joins with the iPhone app (V2): add it here and in the Auth config. */
export type SignInProvider = 'google';

function callbackUrl(next?: string) {
  const path = next && safeNext(next) !== '/' ? `/auth/callback?next=${encodeURIComponent(safeNext(next))}` : '/auth/callback';
  return appUrl(path);
}

export type SendLinkResult = { ok: true; email: string } | { ok: false; reason: 'invalid_email' | 'rate_limited' | 'failed' };

/** Emails a one-time sign-in link, valid 1 hour (FR-001b). New people get an account on first use. */
export async function sendMagicLink(auth: Pick<Auth, 'signInWithOtp'>, rawEmail: string, next?: string): Promise<SendLinkResult> {
  const email = Email.safeParse(rawEmail);
  if (!email.success) return { ok: false, reason: 'invalid_email' };
  const { error } = await auth.signInWithOtp({ email: email.data, options: { emailRedirectTo: callbackUrl(next), shouldCreateUser: true } });
  if (!error) return { ok: true, email: email.data };
  return { ok: false, reason: error.status === 429 ? 'rate_limited' : 'failed' };
}

/** Leaves for the provider's sign-in page; it comes back to /auth/callback. */
export async function signInWithProvider(auth: Pick<Auth, 'signInWithOAuth'>, provider: SignInProvider, next?: string) {
  const { error } = await auth.signInWithOAuth({ provider, options: { redirectTo: callbackUrl(next) } });
  return { ok: !error };
}

export type CallbackParams = { code?: string; error_code?: string; error?: string; next?: string };
export type CallbackResult =
  | { ok: true; event: 'signed_up' | 'signed_in'; method: SignInMethod; next: string }
  | { ok: false; reason: 'expired' | 'other_browser' };

/** New accounts are created by the sign-in itself, so a user made in the last minute just signed up. */
export function signInEvent(user: Pick<User, 'created_at' | 'app_metadata'>, now: number) {
  const event = now - Date.parse(user.created_at) < 60_000 ? ('signed_up' as const) : ('signed_in' as const);
  const method: SignInMethod = user.app_metadata.provider === 'google' ? 'google' : 'email';
  return { event, method };
}

/** /auth/callback: swaps the link's code for a session. */
export async function completeSignIn(auth: Pick<Auth, 'exchangeCodeForSession'>, params: CallbackParams, now = Date.now()): Promise<CallbackResult> {
  if (!params.code || params.error || params.error_code) return { ok: false, reason: 'expired' };
  const { data, error } = await auth.exchangeCodeForSession(params.code);
  if (error || !data.user) {
    // The PKCE verifier lives in the browser that asked for the link.
    return { ok: false, reason: /code verifier/i.test(error?.message ?? '') ? 'other_browser' : 'expired' };
  }
  return { ok: true, ...signInEvent(data.user, now), next: safeNext(params.next) };
}

/** A first name to prefill "Your name" from the provider's profile (Google gives one, email doesn't). */
export function suggestedName(user: Pick<User, 'user_metadata'>): string {
  const meta = user.user_metadata as Record<string, unknown>;
  const name = [meta.given_name, meta.full_name, meta.name].find((v): v is string => typeof v === 'string' && v.trim() !== '');
  return name ? (name.trim().split(/\s+/)[0] ?? '').slice(0, 40) : '';
}
