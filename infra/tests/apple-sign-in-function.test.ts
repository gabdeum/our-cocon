import { describe, expect, it, vi } from 'vitest';
import { appleApi, appleConfig, claimsOf, clientSecret, type Apple } from '../../supabase/functions/_shared/apple';
import { handle, type Deps } from '../../supabase/functions/apple-sign-in/handler';

// Spec 045 FR-009: the server keeps what revoking a Sign in with Apple needs, with fake Apple and database.
const serviceKey = 'service-key';
const jwt = (claims: Record<string, unknown>) => `h.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.s`;
const memberJwt = jwt({ sub: 'user-eva', role: 'authenticated' });
const assistantJwt = jwt({ sub: 'user-eva', role: 'cocon_assistant', client_id: 'c1' });
const apple = (over: Partial<Apple> = {}): Apple => ({
  exchange: vi.fn(async () => ({ refreshToken: 'refresh-1', sub: 'apple-eva' })),
  revoke: vi.fn(async () => true),
  ...over,
});
const deps = (over: Partial<Deps> = {}): Deps => ({
  serviceKey,
  apple: apple(),
  member: vi.fn(async (jwt: string) => (jwt === memberJwt ? { id: 'user-eva', appleSub: 'apple-eva' } : null)),
  keepToken: vi.fn(async () => undefined),
  toRevoke: vi.fn(async () => [
    { id: 1, refresh_token: 'r-1' },
    { id: 2, refresh_token: 'r-2' },
  ]),
  tried: vi.fn(async () => undefined),
  ...over,
});
const post = (body: unknown, token?: string) =>
  new Request('http://kong:8000/functions/v1/apple-sign-in', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
const code = 'c0de.from-apple_123';

describe('apple-sign-in: keeping the token', () => {
  it("swaps the member's code at Apple and keeps the refresh token", async () => {
    const d = deps();
    const res = await handle(post({ code }, memberJwt), d);
    expect(res.status).toBe(200);
    expect(d.apple?.exchange).toHaveBeenCalledWith(code);
    expect(d.keepToken).toHaveBeenCalledWith('user-eva', 'refresh-1');
  });

  it('refuses without a member, or for someone who never used Apple', async () => {
    const d = deps();
    expect((await handle(post({ code }), d)).status).toBe(401);
    expect((await handle(post({ code }, jwt({ sub: 'x', role: 'authenticated' })), d)).status).toBe(401);
    const google = deps({ member: async () => ({ id: 'user-alex', appleSub: null }) });
    expect((await handle(post({ code }, memberJwt), google)).status).toBe(403);
    expect(d.keepToken).not.toHaveBeenCalled();
    expect(google.apple?.exchange).not.toHaveBeenCalled();
  });

  it("refuses an AI assistant's token, even for its member", async () => {
    const d = deps({ member: vi.fn(async () => ({ id: 'user-eva', appleSub: 'apple-eva' })) });
    expect((await handle(post({ code }, assistantJwt), d)).status).toBe(401);
    expect(d.member).not.toHaveBeenCalled();
    expect(d.keepToken).not.toHaveBeenCalled();
  });

  it("never keeps a code from another Apple account on this one", async () => {
    const d = deps({ apple: apple({ exchange: async () => ({ refreshToken: 'theirs', sub: 'apple-someone-else' }) }) });
    expect((await handle(post({ code }, memberJwt), d)).status).toBe(403);
    expect(d.keepToken).not.toHaveBeenCalled();
  });

  it('says so when Apple refuses the code, and does nothing without Apple set up', async () => {
    expect((await handle(post({ code }, memberJwt), deps({ apple: apple({ exchange: async () => null }) }))).status).toBe(502);
    const local = deps({ apple: null });
    expect(await (await handle(post({ code }, memberJwt), local)).json()).toEqual({ status: 'not_configured' });
    expect(local.keepToken).not.toHaveBeenCalled();
  });

  it('only takes a code, by POST', async () => {
    expect((await handle(post({ code: 'x' }, memberJwt), deps())).status).toBe(400);
    expect((await handle(post({}, memberJwt), deps())).status).toBe(400);
    expect((await handle(new Request('http://kong:8000/functions/v1/apple-sign-in'), deps())).status).toBe(405);
    expect((await handle(new Request('http://kong:8000/functions/v1/apple-sign-in', { method: 'OPTIONS' }), deps())).status).toBe(204);
  });

  it('hides what went wrong', async () => {
    const res = await handle(post({ code }, memberJwt), deps({ keepToken: async () => Promise.reject(new Error('db down')) }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ status: 'error' });
  });
});

describe('apple-sign-in: the nightly retry', () => {
  it('needs the service key', async () => {
    const d = deps();
    expect((await handle(post({ retry: true }), d)).status).toBe(401);
    expect((await handle(post({ retry: true }, memberJwt), d)).status).toBe(401);
    expect(d.toRevoke).not.toHaveBeenCalled();
  });

  it("revokes what's queued, and keeps what Apple didn't take for the next night", async () => {
    const d = deps({ apple: apple({ revoke: vi.fn(async (t: string) => (t === 'r-1' ? true : Promise.reject(new Error('timeout')))) }) });
    const res = await handle(post({ retry: true }, serviceKey), d);
    expect(await res.json()).toEqual({ revoked: 1, left: 1 });
    expect(d.tried).toHaveBeenCalledWith(1, true);
    expect(d.tried).toHaveBeenCalledWith(2, false);
  });
});

describe('talking to Apple', () => {
  async function key() {
    const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const der = Buffer.from(await crypto.subtle.exportKey('pkcs8', pair.privateKey)).toString('base64');
    const pem = `-----BEGIN PRIVATE KEY-----\n${der.match(/.{1,64}/g)?.join('\n')}\n-----END PRIVATE KEY-----\n`;
    return { pair, pem };
  }

  it('reads its settings, the key stored as base64 (provision.sh)', () => {
    const env: Record<string, string> = { APPLE_TEAM_ID: '59TR87TBX2', APPLE_CLIENT_ID: 'com.ourcocon.app', APPLE_KEY_ID: 'WXJ2WR6RY8', APPLE_PRIVATE_KEY: btoa('PEM') };
    expect(appleConfig((n) => env[n])).toEqual({ teamId: '59TR87TBX2', clientId: 'com.ourcocon.app', keyId: 'WXJ2WR6RY8', privateKey: 'PEM' });
    expect(appleConfig((n) => (n === 'APPLE_KEY_ID' ? undefined : env[n]))).toBeNull();
  });

  it('signs its client secret with the Sign in with Apple key (ES256)', async () => {
    const { pair, pem } = await key();
    const secret = await clientSecret({ teamId: '59TR87TBX2', clientId: 'com.ourcocon.app', keyId: 'WXJ2WR6RY8', privateKey: pem }, Date.parse('2026-10-31T12:00:00Z'));
    const [header, payload, signature] = secret.split('.');
    expect(claimsOf(`x.${header}`)).toEqual({ alg: 'ES256', kid: 'WXJ2WR6RY8' });
    expect(claimsOf(secret)).toEqual({ iss: '59TR87TBX2', sub: 'com.ourcocon.app', aud: 'https://appleid.apple.com', iat: 1793448000, exp: 1793448300 });
    const valid = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      pair.publicKey,
      Buffer.from(signature ?? '', 'base64url'),
      new TextEncoder().encode(`${header}.${payload}`),
    );
    expect(valid).toBe(true);
  });

  it("swaps a code and revokes a token with Apple's endpoints", async () => {
    const { pem } = await key();
    const idToken = `x.${Buffer.from(JSON.stringify({ sub: 'apple-eva' })).toString('base64url')}.sig`;
    const http = vi.fn(async (url: string | URL | Request) =>
      String(url).endsWith('/token') ? new Response(JSON.stringify({ refresh_token: 'refresh-1', id_token: idToken })) : new Response(null, { status: 200 }),
    );
    const api = appleApi({ teamId: 'T', clientId: 'com.ourcocon.app', keyId: 'K', privateKey: pem }, http as typeof fetch);
    expect(await api.exchange('the-code')).toEqual({ refreshToken: 'refresh-1', sub: 'apple-eva' });
    expect(await api.revoke('refresh-1')).toBe(true);
    const [tokenUrl, tokenInit] = http.mock.calls[0] as unknown as [string, RequestInit];
    const [revokeUrl, revokeInit] = http.mock.calls[1] as unknown as [string, RequestInit];
    expect(tokenUrl).toBe('https://appleid.apple.com/auth/token');
    expect(Object.fromEntries(tokenInit.body as URLSearchParams)).toMatchObject({ client_id: 'com.ourcocon.app', code: 'the-code', grant_type: 'authorization_code' });
    expect(revokeUrl).toBe('https://appleid.apple.com/auth/revoke');
    expect(Object.fromEntries(revokeInit.body as URLSearchParams)).toMatchObject({ token: 'refresh-1', token_type_hint: 'refresh_token' });
  });
});
