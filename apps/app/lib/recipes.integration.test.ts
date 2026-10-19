// @vitest-environment node
// Spec 006 US2 against local Supabase: a recipe Alex saves through ChatGPT comes back first in
// Mia's list, credited to ChatGPT, with its ingredient names (for search) and variant count.
// Another family's recipes and deleted ones never appear. Spec 007: the same list, filtered. Skipped locally when Supabase isn't running.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@cocon/schemas';
import { clientOptions, localSupabase, signInPerson, type Client } from '../test/local-supabase';
import { emptyFilters } from '@cocon/schemas';
import { loadRecipeList, searchRecipes, visibleRecipes } from './recipes';

const local = localSupabase();
if (!local && process.env.CI) throw new Error('Local Supabase must be running in CI for the recipes integration test');
if (!local) console.warn('recipes.integration.test.ts skipped: local Supabase is not running (pnpm dev starts it).');

describe.skipIf(!local)('the recipe list against local Supabase', () => {
  const { url, anonKey, serviceKey } = local ?? { url: '', anonKey: '', serviceKey: '' };
  const admin = createClient<Database>(url, serviceKey, clientOptions);
  const run = randomUUID().slice(0, 8);
  const userIds: string[] = [];
  let mia: Client;
  let sam: Client;
  let familyId: string;
  let alexId: string;

  const person = (name: string) => signInPerson(admin, url, anonKey, `list-${name}-${run}@example.com`, userIds);

  beforeAll(async () => {
    const alex = await person('alex');
    [mia, sam] = await Promise.all([person('mia'), person('sam')]);
    alexId = userIds[0] as string;
    const fam = await alex.rpc('create_family', { family_name: 'List test', display_name: 'Alex' });
    if (fam.error) throw fam.error;
    familyId = fam.data;
    const invite = await alex.rpc('create_invite');
    if (invite.error) throw invite.error;
    const joined = await mia.rpc('accept_invite', { token: invite.data, display_name: 'Mia' });
    if (joined.error) throw joined.error;
    const other = await sam.rpc('create_family', { family_name: 'Other family', display_name: 'Sam' });
    if (other.error) throw other.error;

    // Mia's older recipe, made in the app, and one she deleted.
    const older = await mia.from('recipes').insert({ name: 'Apple tart', family_id: familyId, serves: 8 });
    if (older.error) throw older.error;
    const gone = await mia.from('recipes').insert({ name: 'Old soup', family_id: familyId }).select('id').single();
    if (gone.error) throw gone.error;
    const deleted = await mia.from('recipes').update({ deleted_at: new Date().toISOString() }).eq('id', gone.data.id);
    if (deleted.error) throw deleted.error;
    // Sam's recipe, in another family.
    const samRecipe = await sam.from('recipes').insert({ name: 'Leek soup', family_id: other.data });
    if (samRecipe.error) throw samRecipe.error;
  }, 30_000);

  afterAll(async () => {
    for (const id of userIds) await admin.auth.admin.deleteUser(id);
  });

  it('shows what Alex saved through ChatGPT at the top, and nothing from another family', async () => {
    // As the MCP server would write it for Alex (spec 023): the source names the assistant.
    const id = randomUUID();
    const quiche = await admin.from('recipes').insert({
      id,
      family_id: familyId,
      name: 'Leek quiche',
      serves: 6,
      total_minutes: 70,
      cuisine: 'french',
      best_months: [10],
      created_by: alexId,
      updated_by: alexId,
      source: 'chatgpt',
    });
    expect(quiche.error).toBeNull();
    const parts = await Promise.all([
      admin.from('recipe_ingredients').insert([
        { family_id: familyId, recipe_id: id, position: 0, name: 'Leeks', created_by: alexId, source: 'chatgpt' },
        { family_id: familyId, recipe_id: id, position: 1, name: 'Gruyère', created_by: alexId, source: 'chatgpt' },
      ]),
      admin.from('recipe_variants').insert({ family_id: familyId, recipe_id: id, position: 0, name: 'Vegetarian', kind: 'version', created_by: alexId, source: 'chatgpt' }),
    ]);
    for (const part of parts) expect(part.error).toBeNull();

    const list = await loadRecipeList(mia);
    expect(list.map((r) => r.name)).toEqual(['Leek quiche', 'Apple tart']);
    expect(list[0]).toMatchObject({ created_by: alexId, source: 'chatgpt', cuisine: 'french', total_minutes: 70, variantCount: 1 });
    expect(list[0]?.ingredientNames.sort()).toEqual(['Gruyère', 'Leeks']);
    expect(list[1]).toMatchObject({ source: 'app', variantCount: 0, ingredientNames: [] });

    expect(searchRecipes(list, 'gruyere').map((r) => r.name)).toEqual(['Leek quiche']);
    // Sam's leek soup is not Mia's to see.
    expect(searchRecipes(list, 'soup')).toEqual([]);
    // And the other way: Sam sees only his own family's recipe, with none of Alex's ingredients.
    const samList = await loadRecipeList(sam);
    expect(samList.map((r) => r.name)).toEqual(['Leek soup']);
    expect(samList.flatMap((r) => r.ingredientNames)).toEqual([]);
  });

  it('filters the loaded list: in season in October, then quick and by Alex (spec 007)', async () => {
    const summer = await admin.from('recipes').insert({
      family_id: familyId,
      name: 'Summer salad',
      serves: 2,
      total_minutes: 15,
      best_months: [7],
      created_by: alexId,
      updated_by: alexId,
    });
    expect(summer.error).toBeNull();
    const list = await loadRecipeList(mia);
    const october = { ...emptyFilters, months: [10] };
    // The quiche is best in October and the tart has no months (good all year); the salad is July.
    expect(visibleRecipes(list, '', october).map((r) => r.name)).toEqual(['Leek quiche', 'Apple tart']);
    expect(visibleRecipes(list, '', { ...emptyFilters, time: 'under_30', addedBy: [alexId] }).map((r) => r.name)).toEqual(['Summer salad']);
    expect(visibleRecipes(list, 'leek', { ...october, cuisines: ['french'] }).map((r) => r.name)).toEqual(['Leek quiche']);
  });
});
