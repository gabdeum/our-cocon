import { afterAll, beforeAll, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import { createAssistantCheckServer } from './assistant-check.js';

const jwt = (claims: Record<string, unknown>) => `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.signature-part`;
const server = createAssistantCheckServer();
let base = '';

beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

const check = (token?: string, path = '/assistant-check') =>
  fetch(`${base}${path}`, { headers: token ? { authorization: `Bearer ${token}` } : {} });

// 032-later L62: Caddy asks before /auth/v1/logout, the OAuth approvals and grants, and account changes.
it('refuses an assistant’s token', async () => {
  const res = await check(jwt({ sub: 'u1', client_id: 'c0ffee00-0000-4000-8000-000000000001' }));
  expect(res.status).toBe(403);
  expect(await res.json()).toMatchObject({ error_code: 'assistant_not_allowed' });
});

it('refuses it however the header is spelled, long or not', async () => {
  const token = jwt({ sub: 'u1', client_id: 'c1', pad: 'x'.repeat(5000) });
  for (const authorization of [`bearer ${token}`, `BEARER ${token}`, `Bearer  ${token}`]) {
    const res = await fetch(`${base}/assistant-check`, { headers: { authorization } });
    expect(res.status, authorization.slice(0, 7)).toBe(403);
  }
});

it('refuses a header it can’t read (Supabase might)', async () => {
  for (const authorization of ['Bearer not-a-token', 'Bearer a.%%%.c', `Bearer x.${Buffer.from('[1]').toString('base64url')}.y`, 'Basic dXNlcjpwYXNz']) {
    const res = await fetch(`${base}/assistant-check`, { headers: { authorization } });
    expect(res.status, authorization).toBe(403);
  }
});

it('passes the app’s own sessions and signed-out requests on to Supabase', async () => {
  expect((await check(jwt({ sub: 'u1', role: 'authenticated' }))).status).toBe(200);
  expect((await check(jwt({ role: 'anon' }))).status).toBe(200);
  expect((await check()).status).toBe(200);
});

it('answers nothing else', async () => {
  expect((await check(undefined, '/mcp')).status).toBe(404);
});
