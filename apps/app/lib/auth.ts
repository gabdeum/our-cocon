import type { User } from '@supabase/supabase-js';
import { Email, type SignInMethod } from '@cocon/schemas';
import type { Client } from './supabase';
import { appUrl, safeNext } from './links';

type Auth = Client['auth'];

/** Sign-in providers besides email. Apple is iPhone only (spec 045 FR-005). */
export type SignInProvider = 'google' | 'apple';

function callbackUrl(next?: string) {
  const path = next && safeNext(next) !== '/' ? `/auth/callback?next=${encodeURIComponent(safeNext(next))}` : '/auth/callback';
  return appUrl(path);
}

/**
 * Spec 045 FR-001: where the email link goes. Always with a `?`, as the email template appends
 * `&token_hash=…&type=email` to it. On the iPhone this is the web address, which opens the app.
 */
export function confirmUrl(next?: string) {
  return appUrl(`/auth/confirm?next=${encodeURIComponent(safeNext(next))}`);
}

export type SendLinkResult = { ok: true; email: string } | { ok: false; reason: 'invalid_email' | 'rate_limited' | 'failed' };

/** Emails a one-time sign-in link, valid 1 hour (FR-001b). New people get an account on first use. */
export async function sendMagicLink(auth: Pick<Auth, 'signInWithOtp'>, rawEmail: string, next?: string): Promise<SendLinkResult> {
  const email = Email.safeParse(rawEmail);
  if (!email.success) return { ok: false, reason: 'invalid_email' };
  const { error } = await auth.signInWithOtp({ email: email.data, options: { emailRedirectTo: confirmUrl(next), shouldCreateUser: true } });
  if (!error) return { ok: true, email: email.data };
  return { ok: false, reason: error.status === 429 ? 'rate_limited' : 'failed' };
}

/** On the web: leaves for the provider's sign-in page; it comes back to /auth/callback. */
export async function signInWithProvider(auth: Pick<Auth, 'signInWithOAuth'>, provider: 'google', next?: string) {
  const { error } = await auth.signInWithOAuth({ provider, options: { redirectTo: callbackUrl(next) } });
  return { ok: !error };
}

export type CallbackParams = { code?: string; token_hash?: string; type?: string; error_code?: string; error?: string; next?: string };
export type CallbackResult =
  | { ok: true; event: 'signed_up' | 'signed_in'; method: SignInMethod; next: string }
  | { ok: false; reason: 'expired' | 'other_browser' };

/** New accounts are created by the sign-in itself, so a user made in the last minute just signed up. */
export function signInEvent(user: Pick<User, 'created_at' | 'app_metadata'>, now: number) {
  const event = now - Date.parse(user.created_at) < 60_000 ? ('signed_up' as const) : ('signed_in' as const);
  const provider = user.app_metadata.provider;
  const method: SignInMethod = provider === 'google' || provider === 'apple' ? provider : 'email';
  return { event, method };
}

/**
 * The sign-in link's page: `/auth/confirm` checks the email's one-time token (spec 045 FR-001, in
 * any browser), `/auth/callback` swaps Google's code (web) or an older email link's code.
 */
export async function completeSignIn(auth: Pick<Auth, 'exchangeCodeForSession' | 'verifyOtp'>, params: CallbackParams, now = Date.now()): Promise<CallbackResult> {
  if (params.error || params.error_code) return { ok: false, reason: 'expired' };
  if (params.token_hash) {
    if (params.type !== 'email') return { ok: false, reason: 'expired' };
    const { data, error } = await auth.verifyOtp({ token_hash: params.token_hash, type: 'email' });
    if (error || !data.user) return { ok: false, reason: 'expired' };
    return { ok: true, ...signInEvent(data.user, now), next: safeNext(params.next) };
  }
  if (!params.code) return { ok: false, reason: 'expired' };
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

/**
 * The iPhone's own Google and Apple sheets (lib/native-sign-in). Each gives an ID token the app
 * signs in with, with no redirect (spec 045 FR-004, FR-005). Null where they can't run: the web,
 * Expo Go.
 */
export interface NativeSignIn {
  /** Apple signs `nonce` (the SHA-256 of ours) into its token; the first sign-in also gives a first name. */
  apple(nonce: string): Promise<{ idToken: string; code: string | null; givenName: string | null } | 'cancelled'>;
  /** Google's iOS library takes no nonce (spec 045 FR-010: Supabase skips Google's nonce check). Absent without a client ID. */
  google?(): Promise<{ idToken: string } | 'cancelled'>;
}

/** Which ways in the Sign in screen offers: Google's web redirect, or the iPhone's own sheets. */
export interface SignInOptions {
  webGoogle: boolean;
  native: NativeSignIn | null;
}

export type NativeSignInResult = { ok: true; event: 'signed_up' | 'signed_in'; method: SignInMethod; next: string } | { ok: false; reason: 'cancelled' | 'failed' };

/** A one-time value only this sign-in knows: Apple gets its hash, Supabase checks the two match. */
async function makeNonce() {
  const { CryptoDigestAlgorithm, digestStringAsync, randomUUID } = await import('expo-crypto');
  const raw = `${randomUUID()}${randomUUID()}`;
  return { raw, hashed: await digestStringAsync(CryptoDigestAlgorithm.SHA256, raw) };
}

/**
 * Signs in with a native sheet. A closed sheet is not an error. Apple gives a name only on the
 * first sign-in: it's kept as `given_name`, so "Your name" is prefilled (`suggestedName`).
 * Apple's one-time code goes to the server, which keeps what deleting the account needs to revoke
 * it at Apple (FR-009, supabase/functions/apple-sign-in). That never holds up signing in.
 */
export async function signInNatively(
  { auth, functions }: { auth: Pick<Auth, 'signInWithIdToken' | 'updateUser'>; functions: Pick<Client['functions'], 'invoke'> },
  native: NativeSignIn,
  provider: SignInProvider,
  next?: string,
  now = () => Date.now(),
): Promise<NativeSignInResult> {
  try {
    let token: string;
    let nonce: string | undefined;
    let givenName: string | null = null;
    let appleCode: string | undefined;
    if (provider === 'apple') {
      const made = await makeNonce();
      const result = await native.apple(made.hashed);
      if (result === 'cancelled') return { ok: false, reason: 'cancelled' };
      ({ idToken: token, givenName } = result);
      appleCode = result.code ?? undefined;
      nonce = made.raw;
    } else {
      if (!native.google) return { ok: false, reason: 'failed' };
      const result = await native.google();
      if (result === 'cancelled') return { ok: false, reason: 'cancelled' };
      token = result.idToken;
    }
    const { data, error } = await auth.signInWithIdToken(nonce ? { provider, token, nonce } : { provider, token });
    if (error || !data.user) return { ok: false, reason: 'failed' };
    const name = givenName?.trim();
    // Best effort: an empty "Your name" is the worst case.
    if (name && !suggestedName(data.user)) await auth.updateUser({ data: { given_name: name } }).catch(() => undefined);
    if (appleCode) void functions.invoke('apple-sign-in', { body: { code: appleCode } }).catch(() => undefined);
    return { ok: true, ...signInEvent(data.user, now()), next: safeNext(next) };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}
