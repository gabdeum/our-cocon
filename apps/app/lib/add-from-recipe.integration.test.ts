// @vitest-environment node
// Spec 022 against local Supabase: US2 (cream already on the list reads as one row with the recipe's),
// FR-003 (items carry the recipe), FR-004 (Undo removes exactly what was added and reverts the
// merge) and SC-001 (adding the same recipe twice never makes duplicate rows). Skipped with a
// notice when Supabase isn't running locally (`pnpm dev` starts it; CI starts it first).
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@cocon/schemas';
import { clientOptions as options, localSupabase, signInPerson, type Client } from '../test/local-supabase';
import { quicheDetail } from '../test/quiche-detail';
import { addFromRecipe, recipeGroceryLines, undoAddFromRecipe } from './add-from-recipe';
import { addItem, combinedText, combineRows, loadGroceryList } from './groceries';
import { defaultPanelChoices } from './recipe-choices';

const local = localSupabase();
if (!local && process.env.CI) throw new Error('Local Supabase must be running in CI for the add-from-recipe integration test');
if (!local) console.warn('add-from-recipe.integration.test.ts skipped: local Supabase is not running (pnpm dev starts it).');

describe.skipIf(!local)('adding a recipe to groceries against local Supabase', () => {
  const { url, anonKey, serviceKey } = local ?? { url: '', anonKey: '', serviceKey: '' };
  const admin = createClient<Database>(url, serviceKey, options);
  const run = randomUUID().slice(0, 8);
  const userIds: string[] = [];
  const { lines } = recipeGroceryLines(quicheDetail, { servings: 6, version: null, options: [], ...defaultPanelChoices, scaledBy: null });
  const picked = lines.filter((l) => !['Butter', 'Eggs', 'Nutmeg'].includes(l.name));
  let alex: Client;
  let alexId: string;
  let familyId: string;
  let recipeId: string;

  beforeAll(async () => {
    alex = await signInPerson(admin, url, anonKey, `add-from-recipe-${run}@example.com`, userIds);
    alexId = (await alex.auth.getUser()).data.user?.id ?? '';
    const fam = await alex.rpc('create_family', { family_name: 'Add from recipe test', display_name: 'Alex' });
    if (fam.error) throw fam.error;
    familyId = fam.data;
    const recipe = await alex.from('recipes').insert({ family_id: familyId, name: 'Leek & bacon quiche', serves: 6 }).select('id').single();
    if (recipe.error) throw recipe.error;
    recipeId = recipe.data.id;
  }, 30_000);

  afterAll(async () => {
    for (const id of userIds) await admin.auth.admin.deleteUser(id);
  });

  it('US2, FR-003, FR-004: the cream reads as one row of 400 ml, the rest is for the recipe, and Undo puts it back', async () => {
    expect(await addItem(alex, familyId, alexId, [], '100 ml heavy cream')).toMatchObject({ status: 'added' });
    const added = await addFromRecipe(alex, familyId, recipeId, picked);
    if (!added) throw new Error('the add failed');
    let list = await loadGroceryList(alex);
    // My cream keeps its own item (and "Added by Alex"); the list shows it with the quiche's as one row.
    const creamRow = combineRows(list).find((r) => r.items[0]?.catalog_key === 'heavy_cream');
    expect(creamRow?.items.map((i) => [i.quantity, i.recipe_id])).toEqual([
      [100, null],
      [300, recipeId],
    ]);
    expect(combinedText('Heavy cream', creamRow?.items ?? [], null)).toBe('400 ml');
    expect(list.filter((i) => i.recipe_id === recipeId).every((i) => i.recipes?.name === 'Leek & bacon quiche')).toBe(true);
    expect(added.addedIds).toHaveLength(5);

    expect(await undoAddFromRecipe(alex, added)).toBe(true);
    list = await loadGroceryList(alex);
    expect(list.map((i) => [i.name, i.quantity, i.unit])).toEqual([['Heavy cream', 100, 'ml']]);
  });

  it('SC-001: adding the same recipe twice updates its rows instead of duplicating them', async () => {
    const first = await addFromRecipe(alex, familyId, recipeId, lines);
    const second = await addFromRecipe(alex, familyId, recipeId, lines);
    expect(first && second).toBeTruthy();
    const mine = (await loadGroceryList(alex)).filter((i) => i.recipe_id === recipeId);
    const names = mine.map((i) => i.catalog_key ?? i.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
    expect(mine).toHaveLength(8);
    expect(mine.find((i) => i.name === 'Bacon lardons')?.quantity).toBe(400);
    expect(mine.find((i) => i.name === 'Nutmeg')).toMatchObject({ quantity: 2, unit: 'pinch' });
    expect(second?.addedIds).toEqual([]);
  });
});
