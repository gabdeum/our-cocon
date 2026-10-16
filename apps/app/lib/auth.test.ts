import { describe, expect, it, vi } from 'vitest';
import { completeSignIn, sendMagicLink, signInEvent, signInWithProvider, suggestedName } from './auth';
import { safeNext } from './links';

vi.mock('expo-linking', () => ({ createURL: (p: string) => `ourcocon://${p}` }));

const origin = window.location.origin;

describe('sendMagicLink', () => {
  it('sends a link back to /auth/callback, carrying the invite to return to', async () => {
    const signInWithOtp = vi.fn().mockResolvedValue({ error: null });
    expect(await sendMagicLink({ signInWithOtp }, ' Alex@Example.com ', '/join/abc')).toEqual({ ok: true, email: 'alex@example.com' });
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: 'alex@example.com',
      options: { emailRedirectTo: `${origin}/auth/callback?next=%2Fjoin%2Fabc`, shouldCreateUser: true },
    });
  });

  it('checks the address before sending', async () => {
    const signInWithOtp = vi.fn();
    expect(await sendMagicLink({ signInWithOtp }, 'alex@')).toEqual({ ok: false, reason: 'invalid_email' });
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it('tells rate limits apart from other failures', async () => {
    const limited = vi.fn().mockResolvedValue({ error: { status: 429 } });
    const down = vi.fn().mockResolvedValue({ error: { status: 500 } });
    expect(await sendMagicLink({ signInWithOtp: limited }, 'a@b.co')).toEqual({ ok: false, reason: 'rate_limited' });
    expect(await sendMagicLink({ signInWithOtp: down }, 'a@b.co')).toEqual({ ok: false, reason: 'failed' });
  });
});

it('signs in with Google through the same callback', async () => {
  const signInWithOAuth = vi.fn().mockResolvedValue({ error: null });
  await signInWithProvider({ signInWithOAuth }, 'google');
  expect(signInWithOAuth).toHaveBeenCalledWith({ provider: 'google', options: { redirectTo: `${origin}/auth/callback` } });
});

describe('completeSignIn', () => {
  const now = Date.parse('2026-10-16T12:00:00Z');
  const user = (created: string, provider = 'email') => ({ created_at: created, app_metadata: { provider } });

  it('reports a sign-up for an account made just now', async () => {
    const exchangeCodeForSession = vi.fn().mockResolvedValue({ data: { user: user('2026-10-16T11:59:50Z') }, error: null });
    expect(await completeSignIn({ exchangeCodeForSession }, { code: 'c', next: '/join/abc' }, now)).toEqual({
      ok: true,
      event: 'signed_up',
      method: 'email',
      next: '/join/abc',
    });
  });

  it('reports a sign-in for an older account, with its method', () => {
    expect(signInEvent(user('2026-09-01T00:00:00Z', 'google'), now)).toEqual({ event: 'signed_in', method: 'google' });
  });

  it('reads an expired or used link from the redirect', async () => {
    const exchangeCodeForSession = vi.fn();
    expect(await completeSignIn({ exchangeCodeForSession }, { error: 'access_denied', error_code: 'otp_expired' })).toEqual({ ok: false, reason: 'expired' });
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('explains a link opened in another browser', async () => {
    const exchangeCodeForSession = vi.fn().mockResolvedValue({ data: { user: null }, error: { message: 'invalid request: both auth code and code verifier should be non-empty' } });
    expect(await completeSignIn({ exchangeCodeForSession }, { code: 'c' })).toEqual({ ok: false, reason: 'other_browser' });
  });
});

it('only returns to this app after signing in', () => {
  expect(safeNext('/join/abc')).toBe('/join/abc');
  expect(safeNext('//evil.example')).toBe('/');
  expect(safeNext('https://evil.example')).toBe('/');
  expect(safeNext(undefined)).toBe('/');
});

it('prefills a first name from the provider profile only', () => {
  expect(suggestedName({ user_metadata: { full_name: 'Gabriel Demange' } })).toBe('Gabriel');
  expect(suggestedName({ user_metadata: {} })).toBe('');
});
