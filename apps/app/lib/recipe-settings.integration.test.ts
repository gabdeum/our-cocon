// @vitest-environment node
// Spec 027 against local Supabase (onions show their weight under the count): US1 (Mia turns the thermometer off for the family and Alex's
// recipes lose their checks), US2 (the quiche turns its checks back on, for itself only), US3 (the
// quiche in imperial while the other recipe follows the family), and L48 (the grocery list's Need in
// the family's units). Skipped with a notice when Supabase isn't running locally.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { resolveCooking, type Database } from '@cocon/schemas';
import { clientOptions as options, localSupabase, signInPerson, type Client } from '../test/local-supabase';
import { loadFamilySettings, saveFamilySettings } from './family-settings';
import { addItem, combineRows, loadGroceryList, rowAmounts } from './groceries';
import { loadRecipe } from './recipe';
import { saveRecipeOverrides } from './recipe-settings';
import { formatOf, recipeView } from './recipe-view';
import { defaultPanelChoices } from './recipe-choices';

const local = localSupabase();
if (!local && process.env.CI) throw new Error('Local Supabase must be running in CI for the recipe settings integration test');
if (!local) console.warn('recipe-settings.integration.test.ts skipped: local Supabase is not running (pnpm dev starts it).');

describe.skipIf(!local)('cooking settings against local Supabase', () => {
  const { url, anonKey, serviceKey } = local ?? { url: '', anonKey: '', serviceKey: '' };
  const admin = createClient<Database>(url, serviceKey, options);
  const run = randomUUID().slice(0, 8);
  const userIds: string[] = [];
  let alex: Client;
  let alexId: string;
  let mia: Client;
  let sam: Client;
  let familyId: string;
  const quiche = randomUUID();
  const soup = randomUUID();

  const person = (name: string) => signInPerson(admin, url, anonKey, `cooking-${name}-${run}@example.com`, userIds);

  /** A recipe as its page shows it, with the family's settings as they are now. */
  const page = async (client: Client, id: string) => {
    const [recipe, family] = await Promise.all([loadRecipe(client, id), loadFamilySettings(client)]);
    if (!recipe) throw new Error('No such recipe');
    const cooking = resolveCooking(family, recipe.overrides);
    const choices = { servings: recipe.serves, version: null, options: [], ...defaultPanelChoices, scaledBy: null };
    return { cooking, view: recipeView(recipe, choices, choices, formatOf(choices, cooking), cooking) };
  };

  const addRecipe = async (id: string, name: string) => {
    const rec = await alex.from('recipes').insert({ id, family_id: familyId, name, serves: 4 });
    if (rec.error) throw rec.error;
    const ing = await alex.rpc('save_recipe_ingredients', { p_recipe_id: id, p_ingredients: [{ id: randomUUID(), name: 'Onion', catalog_key: 'onion', quantity: 200, unit: 'g' }] });
    if (ing.error) throw ing.error;
    const steps = await alex.rpc('save_recipe_steps', {
      p_recipe_id: id,
      p_steps: [{ id: randomUUID(), name: 'Bake', body: 'Bake until set.', temp_check_c: 71, temp_check_text: 'the center should reach {temp}' }],
    });
    if (steps.error) throw steps.error;
  };

  beforeAll(async () => {
    [alex, mia, sam] = await Promise.all([person('alex'), person('mia'), person('sam')]);
    alexId = (await alex.auth.getUser()).data.user?.id ?? '';
    const fam = await alex.rpc('create_family', { family_name: 'Cooking test', display_name: 'Alex' });
    if (fam.error) throw fam.error;
    familyId = fam.data;
    const invite = await alex.rpc('create_invite');
    if (invite.error) throw invite.error;
    const joined = await mia.rpc('accept_invite', { token: invite.data, display_name: 'Mia' });
    if (joined.error) throw joined.error;
    const other = await sam.rpc('create_family', { family_name: 'Other cooking test', display_name: 'Sam' });
    if (other.error) throw other.error;
    await addRecipe(quiche, 'Quiche');
    await addRecipe(soup, 'Onion soup');
  }, 30_000);

  afterAll(async () => {
    for (const id of userIds) await admin.auth.admin.deleteUser(id);
  });

  it('a new family keeps the screen on, with a scale and a thermometer, in metric', async () => {
    const { cooking, view } = await page(alex, quiche);
    expect(cooking).toEqual({ keepAwake: true, scale: true, thermometer: true, system: 'metric' });
    expect(view.steps[0]?.tempCheck).toMatch(/71 °C/);
  });

  it('US1: Mia turns the thermometer off, and every recipe loses its check', async () => {
    expect((await saveFamilySettings(mia, familyId, { has_thermometer: false })).error).toBeNull();
    for (const id of [quiche, soup]) expect((await page(alex, id)).view.steps[0]?.tempCheck).toBeNull();
    // Another family keeps its own.
    expect((await loadFamilySettings(sam)).has_thermometer).toBe(true);
  });

  it('US2: the quiche turns its checks back on, and only the quiche shows one', async () => {
    expect((await saveRecipeOverrides(alex, quiche, { has_thermometer: true })).error).toBeNull();
    expect((await page(mia, quiche)).view.steps[0]?.tempCheck).toMatch(/71 °C/);
    expect((await page(mia, soup)).view.steps[0]?.tempCheck).toBeNull();
    // Reset: back on the family's default.
    expect((await saveRecipeOverrides(alex, quiche, { has_thermometer: null })).error).toBeNull();
    expect((await page(mia, quiche)).view.steps[0]?.tempCheck).toBeNull();
    // Someone outside the family changes nothing.
    await saveRecipeOverrides(sam, quiche, { has_thermometer: true });
    expect((await loadRecipe(alex, quiche))?.overrides.has_thermometer).toBeNull();
  });

  it('US3: the quiche in imperial, while the soup follows the family in metric', async () => {
    expect((await saveRecipeOverrides(alex, quiche, { units: 'imperial' })).error).toBeNull();
    expect((await page(alex, quiche)).view.ingredients[0]?.sub).toMatch(/oz/);
    expect((await page(alex, soup)).view.ingredients[0]?.sub).toMatch(/ g/);
  });

  it('L48: the grocery list shows Need in the family’s units', async () => {
    expect(await addItem(alex, familyId, alexId, [], '300 ml heavy cream')).toMatchObject({ status: 'added' });
    expect((await saveFamilySettings(mia, familyId, { units: 'imperial', round_to_packs: false })).error).toBeNull();
    const [items, settings] = await Promise.all([loadGroceryList(alex), loadFamilySettings(alex)]);
    const cream = items.find((i) => i.catalog_key === 'heavy_cream');
    expect(rowAmounts(combineRows(items), {}, settings).get(cream?.id ?? '')?.detail).toMatch(/cup/);
  });
});
