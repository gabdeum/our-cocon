import { describe, expect, it, vi } from 'vitest';
import { completeSignIn, sendMagicLink, signInEvent, signInNatively, signInWithProvider, suggestedName, type NativeSignIn } from './auth';
import { linkOn, safeNext } from './links';

vi.mock('expo-linking', () => ({ createURL: (p: string) => `exp://192.168.1.20:8081/--${p}` }));
vi.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  randomUUID: () => 'raw',
  digestStringAsync: async (_: string, v: string) => `sha256(${v})`,
}));

const origin = window.location.origin;

describe('sendMagicLink', () => {
  it('sends a link to /auth/confirm, carrying the invite to return to', async () => {
    const signInWithOtp = vi.fn().mockResolvedValue({ error: null });
    expect(await sendMagicLink({ signInWithOtp }, ' Alex@Example.com ', '/join/abc')).toEqual({ ok: true, email: 'alex@example.com' });
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: 'alex@example.com',
      options: { emailRedirectTo: `${origin}/auth/confirm?next=%2Fjoin%2Fabc`, shouldCreateUser: true },
    });
  });

  it('always ends the address with a query, as the email appends &token_hash= (spec 045 FR-001)', async () => {
    const signInWithOtp = vi.fn().mockResolvedValue({ error: null });
    await sendMagicLink({ signInWithOtp }, 'a@b.co');
    await sendMagicLink({ signInWithOtp }, 'a@b.co', 'https://evil.example');
    expect(signInWithOtp.mock.calls.map(([c]) => c.options.emailRedirectTo)).toEqual([`${origin}/auth/confirm?next=%2F`, `${origin}/auth/confirm?next=%2F`]);
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

it('signs in with Google on the web through /auth/callback', async () => {
  const signInWithOAuth = vi.fn().mockResolvedValue({ error: null });
  await signInWithProvider({ signInWithOAuth }, 'google');
  expect(signInWithOAuth).toHaveBeenCalledWith({ provider: 'google', options: { redirectTo: `${origin}/auth/callback` } });
});

describe('completeSignIn', () => {
  const now = Date.parse('2026-10-16T12:00:00Z');
  const user = (created: string, provider = 'email') => ({ created_at: created, app_metadata: { provider } });

  it('reports a sign-up for an account made just now', async () => {
    const exchangeCodeForSession = vi.fn().mockResolvedValue({ data: { user: user('2026-10-16T11:59:50Z') }, error: null });
    expect(await completeSignIn({ exchangeCodeForSession, verifyOtp: vi.fn() }, { code: 'c', next: '/join/abc' }, now)).toEqual({
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
    expect(await completeSignIn({ exchangeCodeForSession, verifyOtp: vi.fn() }, { error: 'access_denied', error_code: 'otp_expired' })).toEqual({ ok: false, reason: 'expired' });
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("signs in from the email's token, in any browser (spec 045 FR-001)", async () => {
    const verifyOtp = vi.fn().mockResolvedValue({ data: { user: user('2026-09-01T00:00:00Z') }, error: null });
    const exchangeCodeForSession = vi.fn();
    expect(await completeSignIn({ verifyOtp, exchangeCodeForSession }, { token_hash: 'h', type: 'email', next: '/recipes' }, now)).toEqual({
      ok: true,
      event: 'signed_in',
      method: 'email',
      next: '/recipes',
    });
    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: 'h', type: 'email' });
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("only goes back to this app's own paths", async () => {
    const verifyOtp = vi.fn().mockResolvedValue({ data: { user: user('2026-09-01T00:00:00Z') }, error: null });
    expect(await completeSignIn({ verifyOtp, exchangeCodeForSession: vi.fn() }, { token_hash: 'h', type: 'email', next: '//evil.example' }, now)).toMatchObject({ next: '/' });
  });

  it('reads a used or expired token as an expired link', async () => {
    const verifyOtp = vi.fn().mockResolvedValue({ data: { user: null }, error: { status: 403, message: 'Email link is invalid or has expired' } });
    expect(await completeSignIn({ verifyOtp, exchangeCodeForSession: vi.fn() }, { token_hash: 'h', type: 'email' })).toEqual({ ok: false, reason: 'expired' });
    expect(await completeSignIn({ verifyOtp, exchangeCodeForSession: vi.fn() }, { token_hash: 'h', type: 'recovery' })).toEqual({ ok: false, reason: 'expired' });
    expect(verifyOtp).toHaveBeenCalledTimes(1);
  });

  it('explains a link opened in another browser', async () => {
    const exchangeCodeForSession = vi.fn().mockResolvedValue({ data: { user: null }, error: { message: 'invalid request: both auth code and code verifier should be non-empty' } });
    expect(await completeSignIn({ exchangeCodeForSession, verifyOtp: vi.fn() }, { code: 'c' })).toEqual({ ok: false, reason: 'other_browser' });
  });
});

describe('signInNatively (spec 045)', () => {
  const now = () => Date.parse('2026-10-31T12:00:00Z');
  const newUser = (provider: string, meta: Record<string, unknown> = {}) => ({ created_at: '2026-10-31T11:59:58Z', app_metadata: { provider }, user_metadata: meta });
  const client = (user: unknown = newUser('apple'), error: unknown = null) => ({
    auth: { signInWithIdToken: vi.fn().mockResolvedValue({ data: { user }, error }), updateUser: vi.fn().mockResolvedValue({ data: {}, error: null }) },
    functions: { invoke: vi.fn().mockResolvedValue({ data: null, error: null }) },
  });
  const native = (over: Partial<NativeSignIn> = {}): NativeSignIn => ({
    apple: vi.fn(async () => ({ idToken: 'apple-token', code: 'apple-code', givenName: 'Eva' })),
    google: vi.fn(async () => ({ idToken: 'google-token' })),
    ...over,
  });

  it("gives Apple the nonce's hash and Supabase the nonce itself", async () => {
    const c = client();
    const n = native();
    expect(await signInNatively(c, n, 'apple', '/join/abc', now)).toEqual({ ok: true, event: 'signed_up', method: 'apple', next: '/join/abc' });
    expect(n.apple).toHaveBeenCalledWith('sha256(rawraw)');
    expect(c.auth.signInWithIdToken).toHaveBeenCalledWith({ provider: 'apple', token: 'apple-token', nonce: 'rawraw' });
  });

  it("keeps the first name Apple gives for “Your name”, and sends Apple's code to the server", async () => {
    const c = client();
    await signInNatively(c, native(), 'apple', undefined, now);
    expect(c.auth.updateUser).toHaveBeenCalledWith({ data: { given_name: 'Eva' } });
    expect(c.functions.invoke).toHaveBeenCalledWith('apple-sign-in', { body: { code: 'apple-code' } });
  });

  it('leaves the name empty when Apple gives none (every sign-in after the first)', async () => {
    const c = client(newUser('apple'));
    await signInNatively(c, native({ apple: async () => ({ idToken: 't', code: null, givenName: null }) }), 'apple', undefined, now);
    expect(c.auth.updateUser).not.toHaveBeenCalled();
    expect(c.functions.invoke).not.toHaveBeenCalled();
  });

  it("signs in with Google's token, with no nonce, and keeps Google's own name", async () => {
    const c = client(newUser('google', { given_name: 'Alex' }));
    expect(await signInNatively(c, native(), 'google', undefined, now)).toEqual({ ok: true, event: 'signed_up', method: 'google', next: '/' });
    expect(c.auth.signInWithIdToken).toHaveBeenCalledWith({ provider: 'google', token: 'google-token' });
    expect(c.auth.updateUser).not.toHaveBeenCalled();
  });

  it('treats a closed sheet as nothing, and a refused token or a broken sheet as a failure', async () => {
    const c = client();
    expect(await signInNatively(c, native({ apple: async () => 'cancelled' }), 'apple', undefined, now)).toEqual({ ok: false, reason: 'cancelled' });
    expect(c.auth.signInWithIdToken).not.toHaveBeenCalled();
    expect(await signInNatively(client(null, { message: 'Bad ID token' }), native(), 'apple', undefined, now)).toEqual({ ok: false, reason: 'failed' });
    expect(await signInNatively(c, native({ google: async () => Promise.reject(new Error('network')) }), 'google', undefined, now)).toEqual({ ok: false, reason: 'failed' });
  });

  it("never fails the sign-in because the server could not keep Apple's code", async () => {
    const c = client();
    c.functions.invoke.mockRejectedValue(new Error('offline'));
    expect(await signInNatively(c, native(), 'apple', undefined, now)).toMatchObject({ ok: true });
  });
});

it('builds links on the web address when an iPhone build has one, and the app scheme in local dev (spec 045 FR-003)', () => {
  expect(linkOn('https://app.ourcocon.com', '/auth/confirm?next=%2F')).toBe('https://app.ourcocon.com/auth/confirm?next=%2F');
  expect(linkOn(undefined, '/r/abc')).toBe('exp://192.168.1.20:8081/--/r/abc');
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
