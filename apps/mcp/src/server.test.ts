import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { AddressInfo } from 'node:net';
import { createHttpServer } from './server.js';
import { loadConfig } from './config.js';

const commit = '3f2a9c1d0e8b7a6f5e4d3c2b1a0f9e8d7c6b5a49';
const config = loadConfig({
  COCON_ENV: 'staging',
  COCON_COMMIT: commit,
  SUPABASE_URL: 'https://api-staging.ourcocon.com',
  SUPABASE_ANON_KEY: 'anon',
  APP_URL: 'https://app-staging.ourcocon.com',
  MCP_URL: 'https://mcp-staging.ourcocon.com',
});

/** A token as Supabase's OAuth server issues them: with the client's id (only the claims are read). */
const jwt = (claims: Record<string, unknown>) => `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.signature-part`;
const assistantToken = jwt({ sub: 'u1', client_id: 'c0ffee00-0000-4000-8000-000000000001' });
const appToken = jwt({ sub: 'u1' });

// Supabase's /auth/v1/user: only the assistant token is valid.
const supabase = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
  const auth = new Headers(init?.headers).get('authorization');
  return auth === `Bearer ${assistantToken}` || auth === `Bearer ${appToken}`
    ? new Response(JSON.stringify({ id: '00000000-0000-4000-8000-00000000000a' }), { status: 200 })
    : new Response('{}', { status: 401 });
});
const touch = vi.fn(async () => {});
const server = createHttpServer(config, { fetch: supabase as typeof fetch, modules: [], touch });
let base = '';

beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

const initialize = (token?: string) =>
  fetch(`${base}/mcp`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } },
    }),
  });

it('reports its commit on /health, for the deploy check', async () => {
  const res = await fetch(`${base}/health`);
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ ok: true, env: 'staging', commit });
});

describe('connecting (spec 023 FR-001)', () => {
  it('names Supabase as the place to sign in (RFC 9728)', async () => {
    for (const path of ['/.well-known/oauth-protected-resource', '/.well-known/oauth-protected-resource/mcp']) {
      const res = await fetch(`${base}${path}`);
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({
        resource: 'https://mcp-staging.ourcocon.com/mcp',
        authorization_servers: ['https://api-staging.ourcocon.com/auth/v1'],
      });
    }
  });

  it('answers 401 with where to sign in when there is no token', async () => {
    const res = await initialize();
    expect(res.status).toBe(401);
    expect(res.headers.get('www-authenticate')).toBe('Bearer resource_metadata="https://mcp-staging.ourcocon.com/.well-known/oauth-protected-resource"');
  });

  it('refuses a token Supabase rejects', async () => {
    expect((await initialize(jwt({ sub: 'x', client_id: 'c' }))).status).toBe(401);
  });

  it('refuses the app’s own session: only tokens issued to an assistant', async () => {
    expect((await initialize(appToken)).status).toBe(401);
  });

  it('answers an MCP initialize with an assistant’s token, with Our Cocon’s instructions', async () => {
    const res = await initialize(assistantToken);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('"name":"our-cocon"');
    expect(text).toContain('Our Cocon is a family household app');
  });

  it('records the assistant’s use, for "Connected · used just now" (spec 025)', async () => {
    touch.mockClear();
    await initialize(assistantToken);
    expect(touch).toHaveBeenCalledWith(expect.objectContaining({ userId: '00000000-0000-4000-8000-00000000000a', clientId: 'c0ffee00-0000-4000-8000-000000000001' }));
    touch.mockRejectedValueOnce(new Error('database down'));
    vi.spyOn(console, 'error').mockImplementationOnce(() => {});
    expect((await initialize(assistantToken)).status).toBe(200);
  });
});

it('returns 404 elsewhere', async () => {
  expect((await fetch(`${base}/`)).status).toBe(404);
});

describe('loadConfig', () => {
  it('refuses to start without a Supabase URL', () => {
    expect(() => loadConfig({})).toThrow();
  });

  it('needs its addresses outside local development', () => {
    expect(() => loadConfig({ COCON_ENV: 'prod', SUPABASE_URL: 'https://api.ourcocon.com', SUPABASE_ANON_KEY: 'k' })).toThrow();
  });

  it('defaults to the local app and anon key in development', () => {
    expect(loadConfig({ SUPABASE_URL: 'http://127.0.0.1:54321', EXPO_PUBLIC_SUPABASE_ANON_KEY: 'k' })).toMatchObject({
      supabaseAnonKey: 'k',
      appUrl: 'http://localhost:8081',
      mcpUrl: 'http://localhost:8787',
    });
  });
});
