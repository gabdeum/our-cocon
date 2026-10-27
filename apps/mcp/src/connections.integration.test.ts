// Spec 025 against local Supabase, through real OAuth connections and the MCP server over HTTP.
// US1: once allowed, the assistant is listed and its first call reads as "used just now". US2:
// Disconnect stops it at once. Edge: a member removed from the family loses every connection.
// Skipped locally when Supabase isn't running.
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { disconnectAssistant, loadAssistants, type Db } from '@cocon/data';
import { loadConfig } from './config.js';
import { createHttpServer } from './server.js';
import { adminClient, connectAssistant, localSupabase, refreshAssistant, signInPerson } from '../test/local.js';

const local = localSupabase();
if (!local && process.env.CI) throw new Error('Local Supabase must be running in CI for the MCP integration test');
if (!local) console.warn('connections.integration.test.ts skipped: local Supabase is not running (pnpm dev starts it).');

describe.skipIf(!local)('AI connections against local Supabase', () => {
  const { url, anonKey, serviceKey } = local ?? { url: '', anonKey: '', serviceKey: '' };
  const admin = adminClient(url, serviceKey);
  const run = randomUUID().slice(0, 8);
  const userIds: string[] = [];
  const server = createHttpServer(loadConfig({ SUPABASE_URL: url, SUPABASE_ANON_KEY: anonKey, APP_URL: 'http://localhost:8081' }));
  let base = '';
  let gabriel: Db;
  let alex: Db;

  const person = (name: string) => signInPerson(admin, url, anonKey, `connect-${name}-${run}@example.com`, userIds);
  const listTools = (token: string) =>
    fetch(`${base}/mcp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', authorization: `Bearer ${token}` },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    });

  beforeAll(async () => {
    await new Promise<void>((resolve) => server.listen(0, resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    gabriel = await person('gabriel');
    alex = await person('alex');
    const fam = await gabriel.rpc('create_family', { family_name: 'The Demanges', display_name: 'Gabriel' });
    if (fam.error) throw fam.error;
    const invite = await gabriel.rpc('create_invite');
    if (invite.error) throw invite.error;
    const joined = await alex.rpc('accept_invite', { token: invite.data, display_name: 'Alex' });
    if (joined.error) throw joined.error;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    for (const id of userIds) await admin.auth.admin.deleteUser(id);
  });

  it('US1: an allowed assistant is listed, and reads "used just now" after its first call', async () => {
    const before = await loadAssistants(gabriel);
    expect(before.known.claude).toBeUndefined();
    const claude = await connectAssistant(url, gabriel);
    const after = await loadAssistants(gabriel);
    expect(after.known.claude?.clientIds).toEqual([claude.clientId]);
    expect((await loadAssistants(alex)).known.claude).toBeUndefined();

    expect((await listTools(claude.token)).status).toBe(200);
    let used: string | null = null;
    for (let i = 0; i < 20 && !used; i++) {
      const rows = await gabriel.rpc('my_assistants');
      used = rows.data?.[0]?.last_used_at ?? null;
      if (!used) await new Promise((r) => setTimeout(r, 50));
    }
    expect(Date.now() - new Date(used ?? 0).getTime()).toBeLessThan(10_000);
  });

  it('an assistant can’t list or touch the member’s connections', async () => {
    const chatgpt = await connectAssistant(url, gabriel, 'https://chatgpt.com/connector_platform_oauth_redirect');
    const asAssistant = await fetch(`${url}/rest/v1/rpc/my_assistants`, {
      method: 'POST',
      headers: { apikey: anonKey, authorization: `Bearer ${chatgpt.token}`, 'content-type': 'application/json' },
      body: '{}',
    });
    expect(asAssistant.status).toBe(403);
    expect((await loadAssistants(gabriel)).known.chatgpt).toBeDefined();
  });

  const rest = (token: string) => fetch(`${url}/rest/v1/recipes?select=id`, { headers: { apikey: anonKey, authorization: `Bearer ${token}` } });

  it('US2: Disconnect stops the assistant at once and it leaves the list', async () => {
    const claude = (await loadAssistants(gabriel)).known.claude;
    const another = await connectAssistant(url, gabriel);
    expect((await rest(another.token)).status).toBe(200);
    expect((await loadAssistants(gabriel)).known.claude?.clientIds).toHaveLength(2);
    const { error } = await disconnectAssistant(gabriel.auth.oauth, [...(claude?.clientIds ?? []), another.clientId]);
    expect(error).toBeNull();
    expect((await listTools(another.token)).status).toBe(401);
    // Straight to the API too, though the token itself hasn't expired (check_request).
    expect((await rest(another.token)).status).toBe(401);
    expect((await loadAssistants(gabriel)).known.claude).toBeUndefined();
    // The app's own session is untouched.
    expect((await gabriel.from('recipes').select('id')).error).toBeNull();
  });

  it('a member removed from the family loses every connection', async () => {
    const alexAssistant = await connectAssistant(url, alex);
    expect((await listTools(alexAssistant.token)).status).toBe(200);
    const removed = await gabriel.rpc('remove_member', { member_id: userIds[1] ?? '' });
    expect(removed.error).toBeNull();
    expect((await listTools(alexAssistant.token)).status).toBe(401);
    await expect(refreshAssistant(url, alexAssistant)).rejects.toThrow();
  });
});
