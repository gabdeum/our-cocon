import { afterAll, beforeAll, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import { createHttpServer } from './server.js';
import { loadConfig } from './config.js';

const commit = '3f2a9c1d0e8b7a6f5e4d3c2b1a0f9e8d7c6b5a49';
const server = createHttpServer(
  loadConfig({ COCON_ENV: 'staging', COCON_COMMIT: commit, SUPABASE_URL: 'https://api-staging.ourcocon.com' }),
);
let base = '';

beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

it('reports its commit on /health, for the deploy check', async () => {
  const res = await fetch(`${base}/health`);
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ ok: true, env: 'staging', commit });
});

it('answers an MCP initialize on /mcp', async () => {
  const res = await fetch(`${base}/mcp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } },
    }),
  });
  expect(res.status).toBe(200);
  expect(await res.text()).toContain('"name":"our-cocon"');
});

it('returns 404 elsewhere', async () => {
  expect((await fetch(`${base}/`)).status).toBe(404);
});

it('refuses to start without a Supabase URL', () => {
  expect(() => loadConfig({})).toThrow();
});
