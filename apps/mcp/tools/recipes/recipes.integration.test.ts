// Spec 023 against local Supabase, through a real OAuth connection (registered with Claude's return
// address) and the MCP server over HTTP. US2: search with filters gives links. get_recipe scales and
// writes amounts and temperatures. SC-002: another family's recipe is never found. Skipped locally
// when Supabase isn't running.
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { Db } from '@cocon/data';
import { loadConfig } from '../../src/config.js';
import { memberClient } from '../../src/context.js';
import { createHttpServer } from '../../src/server.js';
import { adminClient, claimsOf, connectAssistant, localSupabase, refreshAssistant, signInPerson, type Connection } from '../../test/local.js';

const local = localSupabase();
if (!local && process.env.CI) throw new Error('Local Supabase must be running in CI for the MCP integration test');
if (!local) console.warn('recipes.integration.test.ts skipped: local Supabase is not running (pnpm dev starts it).');

describe.skipIf(!local)('recipe tools against local Supabase', () => {
  const { url, anonKey, serviceKey } = local ?? { url: '', anonKey: '', serviceKey: '' };
  const admin = adminClient(url, serviceKey);
  const run = randomUUID().slice(0, 8);
  const userIds: string[] = [];
  const config = loadConfig({ SUPABASE_URL: url, SUPABASE_ANON_KEY: anonKey, APP_URL: 'http://localhost:8081' });
  const server = createHttpServer(config);
  const month = new Date().getMonth() + 1;
  const ids = { quick: randomUUID(), slow: randomUUID(), other: randomUUID(), gone: randomUUID(), leek: randomUUID(), cream: randomUUID() };
  let token = '';
  let connection: Connection;
  let gabriel: Db;
  let base = '';
  let mcp: Client;

  const person = (name: string) => signInPerson(admin, url, anonKey, `mcp-${name}-${run}@example.com`, userIds);
  const call = async (name: string, args: Record<string, unknown>) => {
    const result = await mcp.callTool({ name, arguments: args });
    const text = (result.content as { type: string; text: string }[])[0]?.text ?? '';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tool results are checked field by field below
    return { error: result.isError ? text : null, data: result.isError ? null : (JSON.parse(text) as Record<string, any>) };
  };

  async function addRecipe(db: Db, id: string, fields: Record<string, unknown>) {
    const { error } = await db.from('recipes').insert({ id, family_id: randomUUID(), ...fields } as never);
    if (error) throw error;
  }

  beforeAll(async () => {
    gabriel = await person('gabriel');
    const sam = await person('sam');
    for (const [db, name] of [[gabriel, 'Gabriel'], [sam, 'Sam']] as const) {
      const fam = await db.rpc('create_family', { family_name: `${name}'s`, display_name: name });
      if (fam.error) throw fam.error;
    }
    await addRecipe(gabriel, ids.quick, { name: 'Leek & cream pasta', serves: 4, total_minutes: 20, cuisine: 'italian', best_months: [month] });
    await addRecipe(gabriel, ids.slow, { name: 'Slow lamb', serves: 6, total_minutes: 240, best_months: [] });
    await addRecipe(gabriel, ids.gone, { name: 'Deleted gratin', serves: 4, total_minutes: 20, best_months: [] });
    const deleted = await gabriel.from('recipes').update({ deleted_at: new Date().toISOString() }).eq('id', ids.gone);
    if (deleted.error) throw deleted.error;
    await addRecipe(sam, ids.other, { name: 'Sam’s quick soup', serves: 2, total_minutes: 15, best_months: [] });
    const ing = await gabriel.rpc('save_recipe_ingredients', {
      p_recipe_id: ids.quick,
      p_ingredients: [
        { id: ids.leek, name: 'Leeks', quantity: 2, unit: 'piece', catalog_key: null, prep_note: 'sliced' },
        { id: ids.cream, name: 'Double cream', quantity: 200, unit: 'ml' },
      ],
    });
    if (ing.error) throw ing.error;
    const steps = await gabriel.rpc('save_recipe_steps', {
      p_recipe_id: ids.quick,
      p_steps: [{ id: randomUUID(), body: `Soften {ing:${ids.leek}}, add {ing:${ids.cream}} and bake at {temp:180}.`, timer_seconds: 600 }],
    });
    if (steps.error) throw steps.error;

    connection = await connectAssistant(url, gabriel);
    token = connection.token;
    await new Promise<void>((resolve) => server.listen(0, resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    mcp = new Client({ name: 'test', version: '1' });
    await mcp.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`), { requestInit: { headers: { authorization: `Bearer ${token}` } } }));
  });

  afterAll(async () => {
    await mcp?.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    for (const id of userIds) await admin.auth.admin.deleteUser(id);
  });

  it('names the assistant from where it was registered (L1)', async () => {
    const { data } = await memberClient(config, token).rpc('request_source');
    expect(data).toBe('claude');
  });

  it('lists the recipe tools with read-only hints', async () => {
    const { tools } = await mcp.listTools();
    expect(tools.map((t) => t.name)).toEqual(['search_recipes', 'get_recipe']);
    expect(tools.every((t) => t.annotations?.readOnlyHint)).toBe(true);
  });

  it('US2: "under 30 minutes this month" finds the matching recipe, with a link', async () => {
    const { data } = await call('search_recipes', { time: 'under_30', months: [month] });
    expect(data?.recipes.map((r: { name: string }) => r.name)).toEqual(['Leek & cream pasta']);
    expect(data?.recipes[0]).toMatchObject({ link: `http://localhost:8081/recipes/${ids.quick}`, added_by: 'Gabriel', cuisine: 'italian' });
  });

  it('searches like the app: accents and capitals don’t matter, ingredient names count', async () => {
    const { data } = await call('search_recipes', { query: 'CRÈME' });
    expect(data?.count).toBe(0);
    const cream = await call('search_recipes', { query: 'double CREAM' });
    expect(cream.data?.recipes.map((r: { id: string }) => r.id)).toEqual([ids.quick]);
  });

  it('filters by who added it, by name, and says who exists when the name is unknown', async () => {
    expect((await call('search_recipes', { added_by: ['gabriel'] })).data?.count).toBe(2);
    expect((await call('search_recipes', { added_by: ['Mia'] })).error).toBe("No one in this family is called 'Mia'. Members: Gabriel.");
  });

  it('rejects an unknown cuisine with the keys to use (FR-002a)', async () => {
    const { error } = await call('search_recipes', { cuisines: ['italien'] });
    expect(error).toMatch(/^Unknown cuisine 'italien'\. Use one of: american, british, .*, or other for recipes with no cuisine\.$/);
  });

  it('get_recipe scales and writes amounts and both temperatures (FR-003, FR-004)', async () => {
    const { data } = await call('get_recipe', { id: ids.quick, servings: 8 });
    expect(data?.servings).toBe(8);
    expect(data?.ingredients.map((i: { text: string }) => i.text)).toEqual(['4 leeks, sliced', '400 ml double cream']);
    expect(data?.steps[0]).toMatchObject({ number: 1, text: 'Soften 4 leeks, add 400 ml double cream and bake at 180 °C (350 °F).', timer_minutes: 10 });
  });

  it('SC-002: another family’s recipe is never found or listed', async () => {
    expect((await call('get_recipe', { id: ids.other })).error).toBe('There’s no recipe with that id in this family. Use search_recipes to find it.');
    const all = await call('search_recipes', {});
    expect(all.data?.recipes.map((r: { id: string }) => r.id)).not.toContain(ids.other);
  });

  it('a wrong id reads as one sentence', async () => {
    expect((await call('get_recipe', { id: 'quiche' })).error).toBe('id: Use a recipe id from search_recipes.');
  });

  it('hides deleted recipes from search and get (L40)', async () => {
    const all = await call('search_recipes', { query: 'gratin' });
    expect(all.data?.count).toBe(0);
    expect((await call('get_recipe', { id: ids.gone })).error).toBe('There’s no recipe with that id in this family. Use search_recipes to find it.');
  });

  describe('the token is no more than the tools (security)', () => {
    it('carries the assistant role, also after a refresh', async () => {
      expect(claimsOf(token).role).toBe('cocon_assistant');
      expect(claimsOf(await refreshAssistant(url, connection)).role).toBe('cocon_assistant');
    });

    it('cannot write through the API directly', async () => {
      const direct = memberClient(config, token);
      const { error } = await direct.from('recipes').insert({ name: 'Sneaky', family_id: randomUUID() } as never);
      expect(error?.code).toBe('42501');
      const del = await direct.from('recipes').delete().eq('id', ids.slow).select();
      expect(del.error?.code ?? del.data?.length).toBeTruthy();
      const { data } = await gabriel.from('recipes').select('id').eq('id', ids.slow);
      expect(data).toHaveLength(1);
    });

    it('a password set with the token can never sign anyone in', async () => {
      const direct = memberClient(config, token);
      await direct.auth.updateUser({ password: 'a-long-password-123' });
      const email = `mcp-gabriel-${run}@example.com`;
      const signIn = await adminClient(url, anonKey).auth.signInWithPassword({ email, password: 'a-long-password-123' });
      expect(signIn.data.session).toBeNull();
    });

    it('stops working as soon as the member disconnects the assistant', async () => {
      const second = await connectAssistant(url, gabriel);
      const revoked = await gabriel.auth.oauth.revokeGrant({ clientId: second.clientId });
      expect(revoked.error).toBeNull();
      const res = await fetch(`${base}/mcp`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', authorization: `Bearer ${second.token}` },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
      });
      expect(res.status).toBe(401);
    });
  });
});
