// @vitest-environment node
// Specs 008 and 009 against local Supabase: the recipe page's data. Mia opens Alex's quiche and gets its
// rows in order, its variants (a bad change dropped, the rest kept) and the catalog facts of every
// ingredient, variant ones included. Sam, in another family, gets nothing. Skipped locally when
// Supabase isn't running.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@cocon/schemas';
import { clientOptions, localSupabase, signInPerson, type Client } from '../test/local-supabase';
import { loadRecipe } from './recipe';
import { recipeView } from './recipe-view';

const local = localSupabase();
if (!local && process.env.CI) throw new Error('Local Supabase must be running in CI for the recipe integration test');
if (!local) console.warn('recipe.integration.test.ts skipped: local Supabase is not running (pnpm dev starts it).');

describe.skipIf(!local)('the recipe page against local Supabase', () => {
  const { url, anonKey, serviceKey } = local ?? { url: '', anonKey: '', serviceKey: '' };
  const admin = createClient<Database>(url, serviceKey, clientOptions);
  const run = randomUUID().slice(0, 8);
  const userIds: string[] = [];
  let mia: Client;
  let sam: Client;
  const recipeId = randomUUID();
  const lardons = randomUUID();
  const leeks = randomUUID();
  const preheat = randomUUID();
  const veg = randomUUID();
  const extra = randomUUID();

  const person = (name: string) => signInPerson(admin, url, anonKey, `page-${name}-${run}@example.com`, userIds);

  beforeAll(async () => {
    const alex = await person('alex');
    [mia, sam] = await Promise.all([person('mia'), person('sam')]);
    const fam = await alex.rpc('create_family', { family_name: 'Page test', display_name: 'Alex' });
    if (fam.error) throw fam.error;
    const invite = await alex.rpc('create_invite');
    if (invite.error) throw invite.error;
    const joined = await mia.rpc('accept_invite', { token: invite.data, display_name: 'Mia' });
    if (joined.error) throw joined.error;
    const other = await sam.rpc('create_family', { family_name: 'Other family', display_name: 'Sam' });
    if (other.error) throw other.error;

    const family_id = fam.data;
    const r = await alex.from('recipes').insert({ id: recipeId, family_id, name: 'Leek quiche', serves: 6, total_minutes: 70, cuisine: 'french' });
    if (r.error) throw r.error;
    // Inserted out of order: the page sorts by position.
    const ing = await alex.from('recipe_ingredients').insert([
      { family_id, recipe_id: recipeId, position: 1, id: lardons, name: 'Bacon lardons', catalog_key: null, quantity: 200, unit: 'g', weight_per_piece_g: null },
      { family_id, recipe_id: recipeId, position: 0, id: leeks, name: 'Leeks', catalog_key: 'leek', quantity: 2, unit: 'piece', weight_per_piece_g: 150 },
    ]);
    if (ing.error) throw ing.error;
    const steps = await alex.from('recipe_steps').insert([
      {
        family_id,
        recipe_id: recipeId,
        position: 1,
        id: randomUUID(),
        name: 'Bake',
        body: `Add {ing:${leeks}} finely sliced, then {ing:${lardons}}. Bake for 35 minutes.`,
        timer_seconds: 2100,
        timer_label: 'Bake',
        temp_check_c: 71,
        temp_check_text: 'the center should reach {temp} and barely wobble.',
        tip: 'If the top browns too fast, cover it loosely with foil.',
      },
      { family_id, recipe_id: recipeId, position: 0, id: preheat, name: 'Preheat', body: 'Preheat the oven to {temp:180}.' },
    ]);
    if (steps.error) throw steps.error;
    const variants = await alex.from('recipe_variants').insert([
      {
        family_id,
        recipe_id: recipeId,
        position: 0,
        id: veg,
        name: 'Vegetarian',
        kind: 'version',
        changes: [
          { type: 'swap_ingredient', ingredient_id: lardons, with: [{ id: randomUUID(), name: 'Leeks', catalog_key: 'leek', quantity: 1, unit: 'piece' }] },
          { type: 'not_a_change', anything: true },
        ],
      },
      {
        family_id,
        recipe_id: recipeId,
        position: 1,
        id: extra,
        name: 'Extra step',
        kind: 'option',
        changes: [{ type: 'add_step', step_id: preheat, place: 'after', step: { body: 'Chill the pan.' } }],
      },
    ]);
    if (variants.error) throw variants.error;
  }, 30_000);

  afterAll(async () => {
    for (const id of userIds) await admin.auth.admin.deleteUser(id);
  });

  it('gives Mia the recipe with ordered rows, valid variant changes and catalog facts', async () => {
    const recipe = await loadRecipe(mia, recipeId);
    expect(recipe).not.toBeNull();
    if (!recipe) return;
    expect(recipe.ingredients.map((i) => i.name)).toEqual(['Leeks', 'Bacon lardons']);
    expect(recipe.steps.map((s) => s.name)).toEqual(['Preheat', 'Bake']);
    expect(recipe.variants.map((v) => [v.name, v.kind, v.changes.length])).toEqual([
      ['Vegetarian', 'version', 1],
      ['Extra step', 'option', 1],
    ]);
    expect(recipe.facts.leek).toMatchObject({ size_medium_g: 150, default_size: 'medium' });
    expect(recipe.deleted_at).toBeNull();

    const view = recipeView(recipe, 6, { version: veg, options: [extra] });
    expect(view.ingredients.map((i) => i.name)).toEqual(['Leeks', 'Leeks']);
    expect(view.stepCount).toBe(3);
  });

  it('spec 009 US1/US2: fills the steps from the saved rows, for 9 servings in imperial', async () => {
    const recipe = await loadRecipe(mia, recipeId);
    if (!recipe) throw new Error('no recipe');
    const imperial = { system: 'imperial', scale: true } as const;
    const [preheatStep, bake] = recipeView(recipe, 9, { version: null, options: [] }, imperial).steps;
    expect(preheatStep?.parts).toEqual(['Preheat the oven to 350 °F (180 °C).']);
    expect(bake?.parts).toEqual(['Add ', { amount: '3 leeks (15.9 oz)' }, ' finely sliced, then ', { amount: '10.6 oz bacon lardons' }, '. Bake for 35 minutes.']);
    expect(bake).toMatchObject({ number: 2, timer: { clock: '35:00' }, tempCheck: 'the center should reach 160 °F (71 °C) and barely wobble.' });
    // Vegetarian swaps the lardons for one leek: the step's token follows it.
    const veg9 = recipeView(recipe, 9, { version: veg, options: [] }, imperial).steps[1];
    expect(veg9?.parts).toContainEqual({ amount: '1½ leeks (7.9 oz)' });
  });

  it('gives Sam, in another family, nothing (RLS)', async () => {
    expect(await loadRecipe(sam, recipeId)).toBeNull();
  });

  it('still loads a recipe deleted while open, with who deleted it', async () => {
    const del = await mia.from('recipes').update({ deleted_at: new Date().toISOString() }).eq('id', recipeId);
    expect(del.error).toBeNull();
    const recipe = await loadRecipe(mia, recipeId);
    expect(recipe?.deleted_at).not.toBeNull();
    const me = await mia.auth.getUser();
    expect(recipe?.deleted_by).toBe(me.data.user?.id);
  });
});
