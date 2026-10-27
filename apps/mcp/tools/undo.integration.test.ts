// Spec 026 against local Supabase: what ChatGPT changes for Alex, through the MCP server over HTTP,
// shows as one entry per tool call (FR-001), and Gabriel's Undo puts the family's recipes and grocery
// list back exactly as they were, for every write tool (SC-001). The "Mia ticked 2 of these items"
// edge case, and Restore for an AI delete (FR-004). Skipped locally when Supabase isn't running.
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { setChecked, type Db } from '@cocon/data';
import { loadConfig } from '../src/config.js';
import { createHttpServer } from '../src/server.js';
import { adminClient, connectAssistant, localSupabase, signInPerson } from '../test/local.js';

const local = localSupabase();
if (!local && process.env.CI) throw new Error('Local Supabase must be running in CI for the MCP integration test');
if (!local) console.warn('undo.integration.test.ts skipped: local Supabase is not running (pnpm dev starts it).');

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- rows and results are checked field by field
type Result = Record<string, any>;

/** Who wrote a row and when: an undo stamps itself, so these are left out of "the same state". */
const STAMPS = ['created_at', 'created_by', 'updated_at', 'updated_by', 'source', 'checked_at', 'checked_by', 'deleted_by'];

describe.skipIf(!local)('AI activity and undo against local Supabase', () => {
  const { url, anonKey, serviceKey } = local ?? { url: '', anonKey: '', serviceKey: '' };
  const admin = adminClient(url, serviceKey);
  const run = randomUUID().slice(0, 8);
  const userIds: string[] = [];
  const server = createHttpServer(loadConfig({ SUPABASE_URL: url, SUPABASE_ANON_KEY: anonKey, APP_URL: 'http://localhost:8081' }));
  let gabriel: Db;
  let mia: Db;
  let familyId: string;
  let alexId: string;
  let gabrielId: string;
  let miaId: string;
  let mcp: Client;
  let quiche: string;

  const person = (name: string) => signInPerson(admin, url, anonKey, `undo-${name}-${run}@example.com`, userIds);
  const call = async (name: string, args: Record<string, unknown> = {}): Promise<Result> => {
    const result = await mcp.callTool({ name, arguments: args });
    const text = (result.content as { type: string; text: string }[])[0]?.text ?? '';
    if (result.isError) throw new Error(`${name}: ${text}`);
    return JSON.parse(text) as Result;
  };
  const clean = (rows: Result[]) =>
    rows.map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => !STAMPS.includes(k)))).sort((a, b) => String(a.id).localeCompare(String(b.id)));
  /**
   * Everything the family can see: live recipes with their rows, and the grocery list with the
   * servings of the recipes on it (a recipe's servings row stays, unused, once its items go: spec 022).
   */
  const snapshot = async () => {
    const recipes = await admin.from('recipes').select('*').eq('family_id', familyId).is('deleted_at', null);
    const ids = (recipes.data ?? []).map((r) => r.id);
    const [ingredients, steps, variants, items, servings] = await Promise.all([
      admin.from('recipe_ingredients').select('*').in('recipe_id', ids),
      admin.from('recipe_steps').select('*').in('recipe_id', ids),
      admin.from('recipe_variants').select('*').in('recipe_id', ids),
      admin.from('grocery_items').select('*').eq('family_id', familyId).is('deleted_at', null),
      admin.from('grocery_recipes').select('*').eq('family_id', familyId),
    ]);
    return {
      recipes: clean(recipes.data ?? []),
      ingredients: clean(ingredients.data ?? []),
      steps: clean(steps.data ?? []),
      variants: clean(variants.data ?? []),
      items: clean(items.data ?? []),
      servings: clean((servings.data ?? []).filter((s) => items.data?.some((i) => i.recipe_id === s.recipe_id))),
    };
  };
  const latest = async () => {
    const { data, error } = await gabriel.rpc('activity_entries', { p_limit: 1 });
    if (error) throw error;
    return data[0] as Result;
  };
  const undo = async (key: string, skipChanged = false) => {
    const { data, error } = await gabriel.rpc('undo_ai_change', { p_key: key, p_skip_changed: skipChanged });
    if (error) throw error;
    return data as Result;
  };
  /** SC-001: a tool call, then Undo, leaves the family's things as they were. */
  const undoesExactly = async (tool: string, args: Record<string, unknown>, kind: string) => {
    const before = await snapshot();
    await call(tool, args);
    expect(await snapshot()).not.toEqual(before);
    const entry = await latest();
    expect(entry).toMatchObject({ kind, actor_id: alexId, source: 'chatgpt', can_undo: true });
    expect(await undo(entry.key)).toMatchObject({ applied: true, kind, conflicts: [] });
    expect(await snapshot()).toEqual(before);
    expect(await latest()).toMatchObject({ key: entry.key, undone_by: gabrielId, undo_action: 'undo', can_undo: false });
  };

  beforeAll(async () => {
    gabriel = await person('gabriel');
    const alex = await person('alex');
    mia = await person('mia');
    [gabrielId, alexId, miaId] = userIds as [string, string, string];
    const fam = await gabriel.rpc('create_family', { family_name: 'The Demanges', display_name: 'Gabriel' });
    if (fam.error) throw fam.error;
    familyId = fam.data as string;
    for (const [db, name] of [[alex, 'Alex'], [mia, 'Mia']] as const) {
      const invite = await gabriel.rpc('create_invite');
      if (invite.error) throw invite.error;
      const joined = await db.rpc('accept_invite', { token: invite.data, display_name: name });
      if (joined.error) throw joined.error;
    }

    const { token } = await connectAssistant(url, alex, 'https://chatgpt.com/connector_platform_oauth_redirect');
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    mcp = new Client({ name: 'test', version: '1' });
    await mcp.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`), { requestInit: { headers: { authorization: `Bearer ${token}` } } }));

    // Gabriel's own recipe and list, from the app (never logged).
    const saved = await gabriel.from('recipes').insert({ family_id: familyId, name: 'Leek & bacon quiche', serves: 4 }).select('id').single();
    if (saved.error) throw saved.error;
    quiche = saved.data.id;
    await call('update_recipe', {
      id: quiche,
      ingredients: ['2 leeks', '3 eggs', '300 ml heavy cream'],
      steps: ['Soften the leeks.', 'Whisk the eggs and cream.', 'Bake for 35 minutes.'],
      variants: [{ name: 'Cheesy', kind: 'option', changes: [{ type: 'add_ingredient', ingredient: '100 g gruyère' }] }],
    });
    const listed = await gabriel.from('grocery_items').insert({ family_id: familyId, name: 'Lemons', quantity: 1, unit: 'piece' });
    if (listed.error) throw listed.error;
  });

  afterAll(async () => {
    await mcp?.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    for (const id of userIds) await admin.auth.admin.deleteUser(id);
  });

  it('US1: six items Alex added via ChatGPT are one entry; US2: Undo removes exactly those six', async () => {
    const before = await snapshot();
    await call('add_groceries', { items: ['milk', 'bread', '2 onions', 'butter', 'rice', 'carrots'] });
    const entry = await latest();
    expect(entry).toMatchObject({ kind: 'groceries_added', count: 6, actor_id: alexId, source: 'chatgpt', can_undo: true, can_restore: false, undone_by: null });
    expect(entry.names).toHaveLength(3);

    expect(await undo(entry.key)).toMatchObject({ applied: true, done: 6, conflicts: [] });
    expect(await snapshot()).toEqual(before);
    expect(await latest()).toMatchObject({ key: entry.key, undone_by: gabrielId, undo_action: 'undo', can_undo: false });
    // FR-003: an undo isn't an entry of its own, and can't be done twice.
    const { error } = await gabriel.rpc('undo_ai_change', { p_key: entry.key });
    expect(error?.message).toBe('already_undone');
  });

  it('a merge is reverted: the lemons already on the list go back to 1', async () => {
    await undoesExactly('add_groceries', { items: ['2 lemons'] }, 'groceries_added');
  });

  it('SC-001: adding a recipe to the list', async () => {
    await undoesExactly('add_recipe_to_groceries', { recipe_id: quiche }, 'groceries_added');
  });

  it('SC-001: ticking, removing and clearing', async () => {
    const lemon = (await gabriel.from('grocery_items').select('id').eq('family_id', familyId).eq('name', 'Lemons').is('deleted_at', null).single()).data?.id as string;
    await undoesExactly('check_grocery', { id: lemon }, 'groceries_ticked');
    await undoesExactly('remove_grocery', { id: lemon }, 'groceries_removed');
    await setChecked(gabriel, lemon, true);
    await undoesExactly('clear_done_groceries', {}, 'groceries_cleared');
    await undoesExactly('check_grocery', { id: lemon, ticked: false }, 'groceries_unticked');
  });

  it('SC-001: a new recipe goes to Recently deleted, whole', async () => {
    await undoesExactly('create_recipe', { name: 'Pumpkin soup', serves: 4, ingredients: ['1 onion', '1 kg pumpkin'], steps: ['Simmer {ing:pumpkin} with the onion.'] }, 'recipe_created');
    const soup = await admin.from('recipes').select('deleted_at, recipe_ingredients(name)').eq('family_id', familyId).eq('name', 'Pumpkin soup').single();
    expect(soup.data?.deleted_at).not.toBeNull();
    expect(soup.data?.recipe_ingredients).toHaveLength(2);
  });

  it('SC-001 and L37: an edit, with a removed step and a removed variant, comes back whole', async () => {
    await undoesExactly(
      'update_recipe',
      { id: quiche, name: 'Leek quiche', ingredients: ['3 leeks', '3 eggs'], steps: ['Bake everything for 35 minutes.'], variants: [] },
      'recipe_edited',
    );
  });

  it('FR-004: an AI delete offers Restore, not Undo, and Restore brings it back', async () => {
    await call('delete_recipe', { id: quiche });
    const entry = await latest();
    expect(entry).toMatchObject({ kind: 'recipe_deleted', recipe_id: quiche, recipe_name: 'Leek & bacon quiche', can_undo: false, can_restore: true });
    expect(await undo(entry.key)).toMatchObject({ applied: true, kind: 'recipe_deleted' });
    expect((await admin.from('recipes').select('deleted_at').eq('id', quiche).single()).data?.deleted_at).toBeNull();
    expect(await latest()).toMatchObject({ key: entry.key, undone_by: gabrielId, undo_action: 'restore', can_restore: false });
  });

  it('edge: Mia ticked 2 of these items, so Undo asks, then does only the rest', async () => {
    const before = await snapshot();
    await call('add_groceries', { items: ['milk', 'bread', '2 onions', 'butter', 'rice', 'carrots'] });
    const entry = await latest();
    const added = await mia.from('grocery_items').select('id, name').eq('family_id', familyId).in('name', ['Milk', 'Bread']);
    await setChecked(mia, (added.data ?? []).map((i) => i.id), true);
    const during = await snapshot();

    expect(await undo(entry.key)).toEqual({ applied: false, kind: 'groceries_added', done: 0, left: 4, conflicts: [{ kind: 'ticked', by: miaId, count: 2 }] });
    expect(await snapshot()).toEqual(during);

    expect(await undo(entry.key, true)).toMatchObject({ applied: true, done: 4, conflicts: [{ kind: 'ticked', by: miaId, count: 2 }] });
    const left = (await snapshot()).items.filter((i) => !before.items.some((b) => b.id === i.id));
    expect(left.map((i) => [i.name, i.checked]).sort()).toEqual([
      ['Bread', true],
      ['Milk', true],
    ]);
  });
});
