// Spec 023 part B against local Supabase, through a real OAuth connection (Claude's return address)
// and the MCP server over HTTP. US1: a recipe saved by talking. US3: an edit, logged with what it
// was. Variants, delete, the edge cases and SC-002. Skipped locally when Supabase isn't running.
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { Db } from '@cocon/data';
import { loadConfig } from '../../src/config.js';
import { createHttpServer } from '../../src/server.js';
import { adminClient, connectAssistant, localSupabase, signInPerson } from '../../test/local.js';

const local = localSupabase();
if (!local && process.env.CI) throw new Error('Local Supabase must be running in CI for the MCP integration test');
if (!local) console.warn('write.integration.test.ts skipped: local Supabase is not running (pnpm dev starts it).');

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- tool results are checked field by field
type Result = Record<string, any>;

describe.skipIf(!local)('recipe write tools against local Supabase', () => {
  const { url, anonKey, serviceKey } = local ?? { url: '', anonKey: '', serviceKey: '' };
  const admin = adminClient(url, serviceKey);
  const run = randomUUID().slice(0, 8);
  const userIds: string[] = [];
  const server = createHttpServer(loadConfig({ SUPABASE_URL: url, SUPABASE_ANON_KEY: anonKey, APP_URL: 'http://localhost:8081' }));
  const others = randomUUID();
  let gabriel: Db;
  let mcp: Client;
  let ratatouille: Result;

  const person = (name: string) => signInPerson(admin, url, anonKey, `mcpw-${name}-${run}@example.com`, userIds);
  const call = async (name: string, args: Record<string, unknown>): Promise<{ error: string | null; data: Result | null }> => {
    const result = await mcp.callTool({ name, arguments: args });
    const text = (result.content as { type: string; text: string }[])[0]?.text ?? '';
    return { error: result.isError ? text : null, data: result.isError ? null : (JSON.parse(text) as Result) };
  };
  /** The database's log of assistant writes (FR-005): the newest entry for a table and action. */
  const lastActivity = async (table: string, action: 'insert' | 'update' | 'delete') => {
    const { data } = await admin
      .from('activity')
      .select('action, target_kind, source, target_id, payload')
      .eq('target_kind', table)
      .eq('action', action)
      .order('created_at', { ascending: false })
      .limit(1);
    return data?.[0] as (Result & { payload: Result }) | undefined;
  };

  beforeAll(async () => {
    gabriel = await person('gabriel');
    const sam = await person('sam');
    for (const [db, name] of [[gabriel, 'Gabriel'], [sam, 'Sam']] as const) {
      const fam = await db.rpc('create_family', { family_name: `${name}'s`, display_name: name });
      if (fam.error) throw fam.error;
    }
    const theirs = await sam.from('recipes').insert({ id: others, family_id: randomUUID(), name: 'Sam’s soup', serves: 2 } as never);
    if (theirs.error) throw theirs.error;

    const { token } = await connectAssistant(url, gabriel);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    mcp = new Client({ name: 'test', version: '1' });
    await mcp.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`), { requestInit: { headers: { authorization: `Bearer ${token}` } } }));
  });

  afterAll(async () => {
    await mcp?.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    for (const id of userIds) await admin.auth.admin.deleteUser(id);
  });

  it('US1: "Save my mum’s ratatouille, it serves 4" saves a complete recipe, through Claude', async () => {
    const { data, error } = await call('create_recipe', {
      name: 'Mum’s ratatouille',
      serves: 4,
      total_minutes: 75,
      cuisine: 'french',
      source_text: 'Mum',
      ingredients: ['2 aubergines', '3 courgettes, sliced', '400 g tinned tomatoes', '2 tbsp olive oil', '1 large onion', 'Salt to taste'],
      steps: ['Fry the onion in the olive oil for 5 minutes.', 'Add the aubergines and courgettes, then the tinned tomatoes.', 'Bake at 180 °C for 40 minutes.'],
    });
    expect(error).toBeNull();
    ratatouille = data as Result;
    expect(ratatouille).toMatchObject({ name: 'Mum’s ratatouille', serves: 4, cuisine: 'french', added_by: 'Gabriel · via Claude' });
    expect(ratatouille.ingredients.map((i: Result) => i.text)).toContain('3 courgettes (600 g), sliced');
    expect(ratatouille.steps.map((s: Result) => s.text)).toEqual([
      'Fry 1 large onion (200 g) in 2 tbsp olive oil for 5 minutes.',
      'Add 2 aubergines (900 g) and 3 courgettes (600 g), then 400 g tinned tomatoes.',
      'Bake at 180 °C (350 °F) for 40 minutes.',
    ]);
    expect(ratatouille.steps.map((s: Result) => s.timer_minutes)).toEqual([5, null, 40]);

    const { data: row } = await gabriel.from('recipes').select('source, recipe_ingredients(name, quantity, unit, catalog_key, prep_note)').eq('id', ratatouille.id).single();
    expect(row?.source).toBe('claude');
    expect(row?.recipe_ingredients).toContainEqual(expect.objectContaining({ name: 'Tinned tomatoes', quantity: 400, unit: 'g' }));
    expect(row?.recipe_ingredients).toContainEqual(expect.objectContaining({ name: 'Courgettes', prep_note: 'sliced', unit: 'piece' }));
    // Matched against the catalog like the app's rows (L32), so amounts get their weights.
    expect(row?.recipe_ingredients).toContainEqual(expect.objectContaining({ name: 'Olive oil', catalog_key: 'olive_oil' }));
    expect(await lastActivity('recipes', 'insert')).toMatchObject({ source: 'claude', target_id: ratatouille.id, payload: { tool: 'create_recipe', name: 'Mum’s ratatouille' } });
    const steps = await lastActivity('recipe_steps', 'insert');
    expect(steps?.payload.call_id).toMatch(/^[0-9a-f-]{36}$/);
  });

  describe('edge cases: errors the assistant can fix and retry', () => {
    it('an unknown unit', async () => {
      const { error } = await call('create_recipe', { name: 'Pancakes', serves: 2, ingredients: [{ name: 'Flour', quantity: 1, unit: 'cupz' }], steps: [] });
      expect(error).toBe("Unknown unit 'cupz'. Use g, kg, ml, l, tsp, tbsp, cup, oz, lb, piece, pinch.");
    });

    it('an amount with no unit: asks rather than guessing', async () => {
      expect((await call('create_recipe', { name: 'Pancakes', serves: 2, ingredients: [{ name: 'Flour', quantity: 200 }], steps: [] })).error).toBe(
        'Ingredient #1 (Flour) has an amount but no unit. Ask the member for it, or use "piece" for things you count (2 eggs).',
      );
      expect((await call('create_recipe', { name: 'Pancakes', serves: 2, ingredients: ['2 flour'], steps: [] })).error).toMatch(/^Ingredient #1 \(Flour\): 2 of what\? Ask the member for the unit/);
      expect((await call('create_recipe', { name: 'Pancakes', serves: 2, ingredients: ['2 eggs'], steps: [] })).error).toBeNull();
    });

    it('a missing name or serving count', async () => {
      expect((await call('create_recipe', { serves: 2, ingredients: [], steps: [] })).error).toBe('name is missing. Add it and try again.');
      expect((await call('create_recipe', { name: 'Pancakes', ingredients: [], steps: [] })).error).toBe('serves is missing. Add it and try again.');
    });

    it('a token for an ingredient not in the list, quoting it', async () => {
      const { error } = await call('create_recipe', { name: 'Pancakes', serves: 2, ingredients: ['200 g flour'], steps: ['Melt {ing:butter}, add the flour.'] });
      expect(error).toBe('Step 1 mentions {ing:butter}, but that isn’t one of the recipe’s ingredients. Add it to the ingredients, or write it as plain text.');
    });
  });

  it('US3: "Make it serve 8 by default and add a tip to step 2" changes it, logged with what it was', async () => {
    const { data, error } = await call('update_recipe', { id: ratatouille.id, scale_to: 8, step_changes: [{ step: 2, tip: 'Salt the aubergines first.' }] });
    expect(error).toBeNull();
    expect(data?.serves).toBe(8);
    expect(data?.steps[1].tip).toBe('Salt the aubergines first.');
    // Amounts follow the new default: twice the onion.
    expect(data?.steps[0].text).toBe('Fry 2 large onions (400 g) in 59 ml olive oil for 5 minutes.');
    // Logged by the database with what it was, so it can be undone (spec 026).
    expect(await lastActivity('recipes', 'update')).toMatchObject({ source: 'claude', target_id: ratatouille.id, payload: { tool: 'update_recipe', before: { serves: 4 } } });
    expect((await lastActivity('recipe_steps', 'update'))?.payload.before.tip).toBeNull();
  });

  it('serves alone corrects the number and keeps the amounts', async () => {
    const { data } = await call('update_recipe', { id: ratatouille.id, serves: 4 });
    expect(data?.steps[0].text).toBe('Fry 2 large onions (400 g) in 59 ml olive oil for 5 minutes.');
    await call('update_recipe', { id: ratatouille.id, serves: 8 });
  });

  it('rewrites a step from its text_for_editing without doubling amounts', async () => {
    const step = ratatouille.steps[0];
    expect(step.text_for_editing).toBe('Fry {ing:Large onion} in {ing:Olive oil} for 5 minutes.'.replace('Large onion', ratatouille.ingredients[4].name));
    const { data } = await call('update_recipe', { id: ratatouille.id, step_changes: [{ step: 1, text: step.text_for_editing.replace('5 minutes', '8 minutes') }] });
    expect(data?.steps[0].text).toBe('Fry 2 large onions (400 g) in 59 ml olive oil for 8 minutes.');
  });

  it('adds an option as part of the recipe, and reads the recipe with it (L11)', async () => {
    const { data, error } = await call('update_recipe', {
      id: ratatouille.id,
      variants: [
        {
          name: 'Cheesy',
          kind: 'option',
          changes: [
            { type: 'add_ingredient', ingredient: '100 g gruyère' },
            { type: 'change_step', step: 3, text: 'Top with the gruyère, then bake at 180 °C for 40 minutes.' },
          ],
        },
      ],
    });
    expect(error).toBeNull();
    expect(data?.variants).toEqual([
      {
        name: 'Cheesy',
        kind: 'option',
        changes: [
          { type: 'add_ingredient', ingredient: { name: 'Gruyère', quantity: 100, unit: 'g' } },
          { type: 'change_step', step: 3, text: 'Top with {ing:Gruyère}, then bake at {temp:180} for 40 minutes.' },
        ],
      },
    ]);
    const withIt = await call('get_recipe', { id: ratatouille.id, variants: ['cheesy'] });
    expect(withIt.data?.steps[2].text).toBe('Top with 100 g gruyère, then bake at 180 °C (350 °F) for 40 minutes.');
    expect(await lastActivity('recipe_variants', 'insert')).toMatchObject({ source: 'claude', payload: { tool: 'update_recipe', recipe_id: ratatouille.id } });
  });

  it('changes a variant by sending get_recipe’s list back, keeping its id', async () => {
    const before = await gabriel.from('recipe_variants').select('id').eq('recipe_id', ratatouille.id).single();
    const read = await call('get_recipe', { id: ratatouille.id });
    const variants = read.data?.variants as Result[];
    const cheesy = variants[0] as Result;
    cheesy.changes[0].ingredient.quantity = 150;
    const { error } = await call('update_recipe', { id: ratatouille.id, variants });
    expect(error).toBeNull();
    const after = await gabriel.from('recipe_variants').select('id, changes').eq('recipe_id', ratatouille.id).single();
    expect(after.data?.id).toBe(before.data?.id);
    expect(JSON.stringify(after.data?.changes)).toContain('"quantity":150');
  });

  it('a variant naming a step the recipe doesn’t have says which', async () => {
    const { error } = await call('update_recipe', { id: ratatouille.id, variants: [{ name: 'Odd', kind: 'option', changes: [{ type: 'remove_step', step: 9 }] }] });
    expect(error).toBe('Variant "Odd", change #1 names step 9, but the recipe has 3 steps.');
  });

  it('saves a recipe with a version in one call', async () => {
    const { data, error } = await call('create_recipe', {
      name: 'Leek quiche',
      serves: 6,
      ingredients: ['200 g lardons', '3 leeks', '200 ml double cream'],
      steps: ['Fry the lardons.', 'Add the leeks and the cream.'],
      variants: [{ name: 'Vegetarian', kind: 'version', changes: [{ type: 'swap_ingredient', ingredient: 'lardons', with: ['250 g mushrooms'] }] }],
    });
    expect(error).toBeNull();
    const veg = await call('get_recipe', { id: data?.id, variants: ['Vegetarian'] });
    expect(veg.data?.steps[0].text).toBe('Fry 14 mushrooms (250 g).');
  });

  describe('update_recipe refuses what it can’t do as asked', () => {
    it('steps and step_changes together, or scale_to with serves', async () => {
      expect((await call('update_recipe', { id: ratatouille.id, steps: ['x'], step_changes: [{ step: 1, tip: 'y' }] })).error).toBe(
        'Send either steps (the whole list) or step_changes (some steps), not both.',
      );
      expect((await call('update_recipe', { id: ratatouille.id, scale_to: 6, serves: 6 })).error).toBe('Send scale_to on its own, without serves or ingredients: it sets both.');
      expect((await call('update_recipe', { id: ratatouille.id })).error).toBe('Nothing to change: send the fields that change.');
    });
  });

  it('a step sent back in a whole list keeps its photo', async () => {
    const { data: rec } = await gabriel.from('recipes').select('family_id').eq('id', ratatouille.id).single();
    const read = (await call('get_recipe', { id: ratatouille.id })).data as Result;
    const photo = `${rec?.family_id}/${ratatouille.id}/${randomUUID()}.jpg`;
    const set = await gabriel.from('recipe_steps').update({ photo_path: photo }).eq('id', read.steps[0].id);
    expect(set.error).toBeNull();
    const steps = read.steps.map((st: Result) => ({ id: st.id, text: st.text_for_editing, ...(st.timer_minutes ? { timer_minutes: st.timer_minutes } : {}), ...(st.tip ? { tip: st.tip } : {}) }));
    const { error } = await call('update_recipe', { id: ratatouille.id, steps });
    expect(error).toBeNull();
    const { data } = await gabriel.from('recipe_steps').select('photo_path').eq('id', read.steps[0].id).single();
    expect(data?.photo_path).toBe(photo);
  });

  it('removing an ingredient takes it out of the steps too', async () => {
    const read = (await call('get_recipe', { id: ratatouille.id })).data as Result;
    const kept = read.ingredients.filter((i: Result) => i.name !== 'Olive oil').map((i: Result) => ({ id: i.id, name: i.name, ...(i.amount ? {} : {}) }));
    const rows = await gabriel.from('recipe_ingredients').select('id, name, quantity, unit, size_word, prep_note').eq('recipe_id', ratatouille.id).order('position');
    const list = (rows.data ?? [])
      .filter((r) => kept.some((k: Result) => k.id === r.id))
      .map((r) => ({ id: r.id, name: r.name, ...(r.quantity != null ? { quantity: r.quantity } : {}), ...(r.unit ? { unit: r.unit } : {}), ...(r.size_word ? { size: r.size_word } : {}), ...(r.prep_note ? { prep_note: r.prep_note } : {}) }));
    const { data, error } = await call('update_recipe', { id: ratatouille.id, ingredients: list });
    expect(error).toBeNull();
    expect(data?.ingredients.map((i: Result) => i.name)).not.toContain('Olive oil');
    expect(data?.steps[0].text).not.toContain('olive oil');
  });

  it('SC-002: never changes or deletes another family’s recipe', async () => {
    const notFound = 'There’s no recipe with that id in this family. Use search_recipes to find it.';
    expect((await call('update_recipe', { id: others, serves: 9 })).error).toBe(notFound);
    expect((await call('delete_recipe', { id: others })).error).toBe(notFound);
    expect((await call('update_recipe', { id: others, variants: [] })).error).toBe(notFound);
    const { data } = await admin.from('recipes').select('serves, deleted_at').eq('id', others).single();
    expect(data).toEqual({ serves: 2, deleted_at: null });
  });

  it('deletes the app’s way: Recently deleted for 30 days, logged (L40)', async () => {
    const { data, error } = await call('delete_recipe', { id: ratatouille.id });
    expect(error).toBeNull();
    expect(data?.deleted).toBe(true);
    const { data: row } = await gabriel.from('recipes').select('deleted_at, deleted_by').eq('id', ratatouille.id).single();
    expect(row?.deleted_at).not.toBeNull();
    expect(row?.deleted_by).toBe(userIds[0]);
    expect((await call('search_recipes', { query: 'ratatouille' })).data?.count).toBe(0);
    expect(await lastActivity('recipes', 'update')).toMatchObject({ source: 'claude', target_id: ratatouille.id, payload: { tool: 'delete_recipe', before: { deleted_at: null } } });
    // The member can still restore it.
    const restored = await gabriel.from('recipes').update({ deleted_at: null }).eq('id', ratatouille.id).select('id');
    expect(restored.data).toHaveLength(1);
  });
});
