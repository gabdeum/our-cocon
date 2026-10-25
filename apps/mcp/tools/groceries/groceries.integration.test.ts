// Spec 024 against local Supabase, through a real OAuth connection (ChatGPT's return address) and
// the MCP server over HTTP. US1: a recipe's groceries minus what the family has. US2: quick list
// edits, seen by the family as "Alex via ChatGPT". US3 and SC-001: a delete that can be restored.
// The permission and removed-member edge cases. Skipped locally when Supabase isn't running.
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { loadGroceryList, restoreItems, setAiPermission, type Db, type GroceryItem } from '@cocon/data';
import { loadConfig } from '../../src/config.js';
import { createHttpServer } from '../../src/server.js';
import { adminClient, connectAssistant, localSupabase, signInPerson } from '../../test/local.js';

const local = localSupabase();
if (!local && process.env.CI) throw new Error('Local Supabase must be running in CI for the MCP integration test');
if (!local) console.warn('groceries.integration.test.ts skipped: local Supabase is not running (pnpm dev starts it).');

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- tool results are checked field by field
type Result = Record<string, any>;

describe.skipIf(!local)('grocery tools and permissions against local Supabase', () => {
  const { url, anonKey, serviceKey } = local ?? { url: '', anonKey: '', serviceKey: '' };
  const admin = adminClient(url, serviceKey);
  const run = randomUUID().slice(0, 8);
  const userIds: string[] = [];
  const server = createHttpServer(loadConfig({ SUPABASE_URL: url, SUPABASE_ANON_KEY: anonKey, APP_URL: 'http://localhost:8081' }));
  let gabriel: Db;
  let alex: Db;
  let alexId: string;
  let familyId: string;
  let mcp: Client;
  let quiche: string;

  const person = (name: string) => signInPerson(admin, url, anonKey, `mcpg-${name}-${run}@example.com`, userIds);
  const call = async (name: string, args: Record<string, unknown> = {}): Promise<{ error: string | null; data: Result | null }> => {
    const result = await mcp.callTool({ name, arguments: args });
    const text = (result.content as { type: string; text: string }[])[0]?.text ?? '';
    return { error: result.isError ? text : null, data: result.isError ? null : (JSON.parse(text) as Result) };
  };
  /** Rows added in one statement share a time, so the list's order between them isn't fixed. */
  const byName = (items: GroceryItem[]) => [...items].sort((a, b) => a.name.localeCompare(b.name));
  const allow = async (permission: 'recipes_edit' | 'groceries' | 'recipes_delete', allowed: boolean) => {
    const { error } = await setAiPermission(alex, familyId, alexId, permission, allowed);
    if (error) throw error;
  };

  beforeAll(async () => {
    gabriel = await person('gabriel');
    alex = await person('alex');
    alexId = userIds[1] as string;
    const fam = await gabriel.rpc('create_family', { family_name: 'The Demanges', display_name: 'Gabriel' });
    if (fam.error) throw fam.error;
    familyId = fam.data as string;
    const invite = await gabriel.rpc('create_invite');
    if (invite.error) throw invite.error;
    const joined = await alex.rpc('accept_invite', { token: invite.data, display_name: 'Alex' });
    if (joined.error) throw joined.error;

    // Alex connects ChatGPT: its writes read "Alex via ChatGPT".
    const { token } = await connectAssistant(url, alex, 'https://chatgpt.com/connector_platform_oauth_redirect');
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    mcp = new Client({ name: 'test', version: '1' });
    await mcp.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`), { requestInit: { headers: { authorization: `Bearer ${token}` } } }));

    const saved = await call('create_recipe', {
      name: 'Leek & bacon quiche',
      serves: 4,
      ingredients: [
        { name: 'Leeks', quantity: 2, unit: 'piece' },
        { name: 'Eggs', quantity: 3, unit: 'piece' },
        { name: 'Heavy cream', quantity: 300, unit: 'ml' },
        { name: 'Butter', quantity: 30, unit: 'g' },
      ],
      steps: [{ text: 'Soften the leeks in the butter, then bake with the eggs and cream.' }],
    });
    if (saved.error) throw new Error(saved.error);
    quiche = saved.data?.id as string;
  });

  afterAll(async () => {
    await mcp?.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    for (const id of userIds) await admin.auth.admin.deleteUser(id);
  });

  it('lists every grocery tool, and tells assistants to ask what the family has first (FR-001, FR-004)', async () => {
    const { tools } = await mcp.listTools();
    const names = tools.map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining(['list_groceries', 'add_groceries', 'check_grocery', 'remove_grocery', 'clear_done_groceries', 'add_recipe_to_groceries']));
    expect(tools.find((t) => t.name === 'add_recipe_to_groceries')?.description).toMatch(/ask the member which of the recipe’s ingredients they already have/);
    expect(tools.find((t) => t.name === 'remove_grocery')?.annotations).toMatchObject({ destructiveHint: true });
  });

  it('US1: "Add what I need for the quiche, we have eggs and butter" adds the rest, and a second add tops it up', async () => {
    const { data, error } = await call('add_recipe_to_groceries', { recipe_id: quiche, exclude_ingredients: ['eggs', 'butter'] });
    expect(error).toBeNull();
    expect(data?.left_off).toEqual(['Eggs', 'Butter']);
    expect(data?.added).toEqual(['2 · 300 g Leeks', '300 ml Heavy cream']);
    expect(data?.servings_on_list).toBe(4);
    const list = byName(await loadGroceryList(gabriel));
    expect(list.map((i) => [i.name, i.quantity, i.unit, i.recipe_id, i.source])).toEqual([
      ['Heavy cream', 300, 'ml', quiche, 'chatgpt'],
      ['Leeks', 2, 'piece', quiche, 'chatgpt'],
    ]);

    // Spec 022's merge rule: the same recipe again only updates its items, and the servings add up.
    const again = await call('add_recipe_to_groceries', { recipe_id: quiche, servings: 2, exclude_ingredients: ['Eggs', 'Butter'] });
    expect(again.data?.servings_on_list).toBe(6);
    expect(again.data?.already_on_list).toMatch(/^2 of these/);
    const after = byName(await loadGroceryList(gabriel));
    expect(after.map((i) => [i.name, i.quantity])).toEqual([
      ['Heavy cream', 450],
      ['Leeks', 3],
    ]);
  });

  it('US1 edge: an ingredient the recipe doesn’t have is refused with its ingredients, so the assistant can fix it', async () => {
    const { error } = await call('add_recipe_to_groceries', { recipe_id: quiche, exclude_ingredients: ['saffron'] });
    expect(error).toBe("This recipe has no ingredient 'saffron'. Its ingredients: Leeks, Eggs, Heavy cream, Butter. Use those names in exclude_ingredients.");
  });

  it('US2: "Add milk and lemons", "tick off the leeks": the list updates for everyone, as Alex via ChatGPT', async () => {
    const added = await call('add_groceries', { items: ['milk', '2 lemons'] });
    expect(added.error).toBeNull();
    expect(added.data?.results).toEqual([
      { item: 'milk', added: true },
      { item: '2 lemons', added: true },
    ]);
    const topUp = await call('add_groceries', { items: ['1 lemon'] });
    expect(topUp.data?.results).toEqual([{ item: '1 lemon', added: true, already_on_list: true, now: '3 pieces' }]);

    const ticked = await call('check_grocery', { name: 'leeks' });
    expect(ticked.data).toMatchObject({ item: 'Leeks', ticked: true });

    // Gabriel's app reads it: Alex added it, through ChatGPT, and Alex ticked the leeks.
    const list = await loadGroceryList(gabriel);
    const lemon = list.find((i) => i.name.toLowerCase().startsWith('lemon'));
    expect(lemon).toMatchObject({ quantity: 3, source: 'chatgpt', created_by: alexId });
    expect(list.find((i) => i.name === 'Leeks')).toMatchObject({ checked: true, checked_by: alexId });

    const read = await call('list_groceries');
    const items = (read.data?.aisles as { aisle: string; items: Result[] }[]).flatMap((a) => a.items.map((i): Result => ({ ...i, aisle: a.aisle })));
    // Named as the catalog does, with what to buy in the family's store sizes (spec 021).
    expect(items.find((i) => i.name === 'Leek')).toMatchObject({ ticked: true, amount: '3 pieces', for_recipes: ['Leek & bacon quiche'], aisle: 'Produce' });
    expect(items.find((i) => i.name === 'Heavy cream')).toMatchObject({ amount: '1 pint carton', note: 'need 450 ml' });
    expect(items.find((i) => i.name === 'Lemon')).toMatchObject({ ticked: false, amount: '3 pieces', added_by: ['Alex · via ChatGPT'] });
    expect(read.data?.recipes).toEqual([{ id: quiche, name: 'Leek & bacon quiche', servings: 6, link: `http://localhost:8081/recipes/${quiche}` }]);

    const milk = items.find((i) => i.name === 'Milk');
    expect((await call('remove_grocery', { id: milk?.id })).data).toMatchObject({ removed: 'Milk' });
    expect((await call('clear_done_groceries')).data).toMatchObject({ cleared: ['Leeks'] });
    expect(byName(await loadGroceryList(gabriel)).map((i) => i.name)).toEqual(['Heavy cream', 'Lemons']);
  });

  it('FR-003: every assistant grocery write is logged with the row as it was, so it can be undone', async () => {
    const { data } = await admin.from('activity').select('action, target_kind, source, payload').eq('family_id', familyId).eq('target_kind', 'grocery_items');
    const entries = data ?? [];
    expect(entries.every((e) => e.source === 'chatgpt')).toBe(true);
    const cleared = entries.find((e) => e.action === 'update' && (e.payload as Result).before?.name === 'Leeks' && (e.payload as Result).before?.checked === true);
    expect(cleared?.payload).toMatchObject({ tool: 'clear_done_groceries', before: { deleted_at: null } });
    expect(entries.some((e) => e.action === 'insert' && (e.payload as Result).name === 'Milk')).toBe(true);

    // A removal or clear is undone the app's way (spec 020's Undo): the item comes back as it was.
    const leeks = (cleared?.payload as Result).before.id as string;
    expect(await restoreItems(gabriel, [leeks])).toBe(true);
    expect((await loadGroceryList(gabriel)).find((i) => i.id === leeks)).toMatchObject({ name: 'Leeks', checked: true, created_by: alexId, source: 'chatgpt' });
  });

  it('US3 and SC-001: "Delete the quiche" moves it to Recently deleted, logged, and it can be restored', async () => {
    const { data, error } = await call('delete_recipe', { id: quiche });
    expect(error).toBeNull();
    expect(data).toMatchObject({ deleted: true, name: 'Leek & bacon quiche' });
    const deleted = await gabriel.from('recipes').select('deleted_at, deleted_by').eq('id', quiche).single();
    expect(deleted.data?.deleted_by).toBe(alexId);
    const logged = await admin.from('activity').select('source, payload').eq('target_id', quiche).eq('action', 'update').order('created_at', { ascending: false }).limit(1);
    expect(logged.data?.[0]).toMatchObject({ source: 'chatgpt', payload: { tool: 'delete_recipe', name: 'Leek & bacon quiche', before: { deleted_at: null } } });

    // Restore, as Settings › Recently deleted (spec 018) and 026's activity card do.
    const restored = await gabriel.from('recipes').update({ deleted_at: null }).eq('id', quiche).select('id');
    expect(restored.data).toHaveLength(1);
    expect((await gabriel.from('recipes').select('deleted_at').eq('id', quiche).single()).data?.deleted_at).toBeNull();
  });

  it('edge: a permission set to Not allowed returns a refusal the assistant can relay, and changes nothing', async () => {
    await allow('groceries', false);
    const before = (await loadGroceryList(gabriel)).length;
    expect((await call('add_groceries', { items: ['bread'] })).error).toBe(
      'This member hasn’t allowed AI to change the grocery list. They can change it in Settings › AI assistants.',
    );
    expect((await call('add_recipe_to_groceries', { recipe_id: quiche })).error).toMatch(/hasn’t allowed AI to change the grocery list/);
    expect(await loadGroceryList(gabriel)).toHaveLength(before);
    expect((await call('list_groceries')).error).toBeNull();
    await allow('groceries', true);

    await allow('recipes_delete', false);
    expect((await call('delete_recipe', { id: quiche })).error).toBe('This member hasn’t allowed AI to delete recipes. They can change it in Settings › AI assistants.');
    expect((await gabriel.from('recipes').select('deleted_at').eq('id', quiche).single()).data?.deleted_at).toBeNull();
    await allow('recipes_delete', true);

    await allow('recipes_edit', false);
    expect((await call('update_recipe', { id: quiche, serves: 6 })).error).toMatch(/hasn’t allowed AI to create or edit recipes/);
    await allow('recipes_edit', true);
  });

  it('edge: a member removed from the family loses all MCP access at once', async () => {
    const removed = await gabriel.rpc('remove_member', { member_id: alexId });
    expect(removed.error).toBeNull();
    // Removing ends their sessions, so the server refuses the assistant's token before any tool runs.
    await expect(call('list_groceries')).rejects.toThrow(/Connect Our Cocon first/);
    expect((await admin.from('grocery_items').select('id').eq('family_id', familyId).eq('name', 'Bread')).data).toEqual([]);
  });
});
