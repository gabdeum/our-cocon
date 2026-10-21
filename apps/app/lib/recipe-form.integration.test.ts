// @vitest-environment node
// Spec 014 against local Supabase. US1: Alex saves a recipe with only a name; it gets the defaults
// and opens for Mia (same family). An edit saves every detail. FR-004: a photo goes under the
// family's folder, Mia gets a signed link, and Sam (another family) can neither read, list nor
// overwrite it, nor see or edit the recipe. Spec 015 saves the ingredients, spec 016 the steps (the
// recipe page shows what the form previewed). Skipped locally when Supabase isn't running.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@cocon/schemas';
import { clientOptions, localSupabase, signInPerson, type Client } from '../test/local-supabase';

// The native pickers aren't used here, only storage.
vi.mock('expo-image-picker', () => ({}));
vi.mock('expo-image-manipulator', () => ({ ImageManipulator: {}, SaveFormat: { JPEG: 'jpeg' } }));
vi.mock('expo-crypto', () => ({ randomUUID }));

const { formFromRecipe, loadRecipeForm, readDetails, saveRecipe } = await import('./recipe-form');
const { newPhotoPath, PHOTO_BUCKET, removePhotos, signedPhotoUrls, uploadPhoto } = await import('./recipe-photo');
const { applyMatch, draftsFromRows, emptyDraft, matchIngredients, readIngredients, saveIngredients } = await import('./recipe-ingredients');
const { loadRecipe } = await import('./recipe');
const { draftsFromSteps, emptyStep, readSteps } = await import('./recipe-steps');
const { defaultFormat, recipeView, stepParts } = await import('./recipe-view');
const { quantityOf } = await import('./recipe-ingredients');
const { ingredientToken, renderStep } = await import('@cocon/quantity');

const local = localSupabase();
if (!local && process.env.CI) throw new Error('Local Supabase must be running in CI for the recipe form integration test');
if (!local) console.warn('recipe-form.integration.test.ts skipped: local Supabase is not running (pnpm dev starts it).');

// The smallest JPEG header is enough: storage checks the declared type, not the pixels.
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 0xff, 0xd9]);

describe.skipIf(!local)('the recipe form against local Supabase', () => {
  const { url, anonKey, serviceKey } = local ?? { url: '', anonKey: '', serviceKey: '' };
  const admin = createClient<Database>(url, serviceKey, clientOptions);
  const run = randomUUID().slice(0, 8);
  const userIds: string[] = [];
  const photoPaths: string[] = [];
  let alex: Client;
  let mia: Client;
  let sam: Client;
  let familyId = '';
  let samFamily = '';
  const recipeId = randomUUID();

  const person = (name: string) => signInPerson(admin, url, anonKey, `form-${name}-${run}@example.com`, userIds);

  beforeAll(async () => {
    [alex, mia, sam] = await Promise.all([person('alex'), person('mia'), person('sam')]);
    const fam = await alex.rpc('create_family', { family_name: 'Form test', display_name: 'Alex' });
    if (fam.error) throw fam.error;
    familyId = fam.data;
    const invite = await alex.rpc('create_invite');
    if (invite.error) throw invite.error;
    const joined = await mia.rpc('accept_invite', { token: invite.data, display_name: 'Mia' });
    if (joined.error) throw joined.error;
    const other = await sam.rpc('create_family', { family_name: 'Other family', display_name: 'Sam' });
    if (other.error) throw other.error;
    samFamily = other.data;
  });

  afterAll(async () => {
    if (photoPaths.length) await admin.storage.from(PHOTO_BUCKET).remove(photoPaths);
    for (const id of userIds) await admin.auth.admin.deleteUser(id);
  });

  it('US1: saves a recipe with only a name, and Mia opens it', async () => {
    const read = readDetails({ ...formFromRecipe(null), name: 'Grandma’s soup' });
    if (!('input' in read)) throw new Error('expected input');
    expect(await saveRecipe(alex, { id: recipeId, familyId, isNew: true }, read.input)).toEqual({ ok: true, created: true, detailsSaved: true });
    const saved = await loadRecipeForm(mia, recipeId);
    expect(saved).toMatchObject({ id: recipeId, name: 'Grandma’s soup', serves: 4, total_minutes: null, cuisine: null, best_months: [], photo_path: null });
  });

  it('edits every detail', async () => {
    const read = readDetails({
      ...formFromRecipe(await loadRecipeForm(alex, recipeId)),
      description: 'Warm and green.',
      serves: '6',
      totalTime: '1 h 10',
      prepTime: '25 min',
      cuisine: 'french',
      source: 'Grandma',
      bestMonths: [11, 12, 1],
    });
    if (!('input' in read)) throw new Error('expected input');
    expect(await saveRecipe(mia, { id: recipeId, familyId, isNew: false }, read.input)).toEqual({ ok: true, created: false, detailsSaved: true });
    expect(await loadRecipeForm(alex, recipeId)).toMatchObject({
      description: 'Warm and green.',
      serves: 6,
      total_minutes: 70,
      prep_minutes: 25,
      cuisine: 'french',
      source_text: 'Grandma',
      best_months: [1, 11, 12],
    });
  });

  it('keeps the recipe from another family', async () => {
    expect(await loadRecipeForm(sam, recipeId)).toBeNull();
    const read = readDetails({ ...formFromRecipe(null), name: 'Mine now' });
    if (!('input' in read)) throw new Error('expected input');
    // RLS hides the row, so the update changes nothing.
    await saveRecipe(sam, { id: recipeId, familyId: samFamily, isNew: false }, read.input);
    expect((await loadRecipeForm(alex, recipeId))?.name).toBe('Grandma’s soup');
  });

  it('FR-004: stores a photo in the family folder, for the family only', async () => {
    const path = newPhotoPath(familyId, recipeId);
    photoPaths.push(path);
    expect(await uploadPhoto(alex, path, jpeg)).toBe(true);
    const read = readDetails({ ...formFromRecipe(await loadRecipeForm(alex, recipeId)), photoPath: path });
    if (!('input' in read)) throw new Error('expected input');
    expect(await saveRecipe(alex, { id: recipeId, familyId, isNew: false }, read.input)).toEqual({ ok: true, created: false, detailsSaved: true });

    const urls = await signedPhotoUrls(mia, [path]);
    expect(urls[path]).toMatch(/^http.*token=/);
    const fetched = await fetch(urls[path] ?? '');
    expect(fetched.ok).toBe(true);

    // Sam gets no link, sees nothing in the folder, and can't write over it or into it.
    const samUrls = await signedPhotoUrls(sam, [path]).catch(() => ({}));
    expect(samUrls).toEqual({});
    const listed = await sam.storage.from(PHOTO_BUCKET).list(`${familyId}/${recipeId}`);
    expect(listed.data ?? []).toEqual([]);
    expect(await uploadPhoto(sam, newPhotoPath(familyId, recipeId), jpeg)).toBe(false);
    const overwrite = await sam.storage.from(PHOTO_BUCKET).update(path, jpeg, { contentType: 'image/jpeg' });
    expect(overwrite.error).not.toBeNull();
    // Nor remove it: the file is still there for Mia.
    await removePhotos(sam, [path]);
    expect((await signedPhotoUrls(mia, [path]))[path]).toBeTruthy();
  });

  it('FR-004: refuses files that are not images, and the family removes its own', async () => {
    const path = newPhotoPath(familyId, recipeId);
    photoPaths.push(path);
    const text = await alex.storage.from(PHOTO_BUCKET).upload(path, new TextEncoder().encode('hello'), { contentType: 'text/plain' });
    expect(text.error).not.toBeNull();

    const kept = newPhotoPath(familyId, recipeId);
    photoPaths.push(kept);
    expect(await uploadPhoto(alex, kept, jpeg)).toBe(true);
    await removePhotos(mia, [kept]);
    expect(await signedPhotoUrls(alex, [kept]).catch(() => ({}))).toEqual({});
  });
  // Spec 015: the ingredient list, saved through save_recipe_ingredients.
  const leekId = randomUUID();
  const butterId = randomUUID();
  const ingredientsOf = async (who: Client) => (await loadRecipeForm(who, recipeId))?.ingredients ?? [];

  it('015 US2: saves ingredients, and the steps show "2 leeks (300 g)"', async () => {
    const leeks = { ...emptyDraft(leekId), name: 'Leeks', quantity: '2', unit: 'piece' as const, weight: '150' };
    const butter = { ...emptyDraft(butterId), name: 'Butter', quantity: '30', unit: 'g' as const };
    const salt = { ...emptyDraft(randomUUID()), name: 'Salt and pepper to taste' };
    const read = readIngredients([leeks, butter, salt]);
    if (!('rows' in read)) throw new Error('expected rows');
    expect(await saveIngredients(alex, { recipeId, familyId }, read.rows, [])).toBe(true);
    const step = await alex.from('recipe_steps').insert({ recipe_id: recipeId, family_id: familyId, position: 0, body: `Soften ${ingredientToken(leekId)} in ${ingredientToken(butterId)}.` });
    if (step.error) throw step.error;

    const recipe = await loadRecipe(mia, recipeId);
    const ingredients = (recipe?.ingredients ?? []).map((i) => ({ ...i, facts: i.catalog_key ? recipe?.facts[i.catalog_key] : null }));
    const body = recipe?.steps[0]?.body ?? '';
    const text = renderStep(body, ingredients, { system: 'metric', scale: true })
      .map((seg) => (seg.type === 'missing' ? '?' : seg.text))
      .join('');
    expect(text).toBe('Soften 2 leeks (300 g) in 30 g butter.');
    expect(recipe?.ingredients.map((i) => i.name)).toEqual(['Leeks', 'Butter', 'Salt and pepper to taste']);
  });

  it('015 FR-002: reorders, and removing an ingredient takes it out of its step', async () => {
    const loaded = await loadRecipeForm(alex, recipeId);
    const drafts = draftsFromRows(loaded?.ingredients ?? [], loaded?.facts ?? {});
    const [leeks, butter, salt] = drafts;
    if (!leeks || !butter || !salt) throw new Error('three rows');
    const read = readIngredients([salt, leeks]);
    if (!('rows' in read)) throw new Error('expected rows');
    expect(await saveIngredients(mia, { recipeId, familyId }, read.rows, [])).toBe(true);
    expect((await ingredientsOf(alex)).sort((a, b) => a.position - b.position).map((i) => i.name)).toEqual(['Salt and pepper to taste', 'Leeks']);
    expect((await loadRecipeForm(alex, recipeId))?.steps?.[0]?.body).toBe(`Soften ${ingredientToken(leekId)} in.`);
  });

  it('015: a new ingredient joins the family list with its aisle, and is known next time', async () => {
    const name = `Grandma spice ${run}`;
    const draft = applyMatch({ ...emptyDraft(randomUUID()), name }, null);
    const withAisle = { ...draft, newAisle: 'spices_baking' as const };
    const read = readIngredients([withAisle]);
    if (!('rows' in read)) throw new Error('expected rows');
    expect(await saveIngredients(alex, { recipeId, familyId }, read.rows, [withAisle])).toBe(true);
    const found = await matchIngredients(mia, [name]);
    expect(found?.[0]).toMatchObject({ catalog_key: null, aisle: 'spices_baking' });
    // Sam's family doesn't know it.
    expect((await matchIngredients(sam, [name]))?.[0]).toBeNull();
  });

  it("015: another family can't save into this recipe's ingredients", async () => {
    const before = await ingredientsOf(alex);
    const read = readIngredients([{ ...emptyDraft(randomUUID()), name: 'Mine now' }]);
    if (!('rows' in read)) throw new Error('expected rows');
    expect(await saveIngredients(sam, { recipeId, familyId: samFamily }, read.rows, [])).toBe(false);
    const taken = before[0];
    if (!taken) throw new Error('a row');
    const steal = readIngredients(draftsFromRows([taken], {}));
    if (!('rows' in steal)) throw new Error('expected rows');
    const own = randomUUID();
    const mine = await sam.from('recipes').insert({ id: own, family_id: samFamily, name: 'Sam soup' });
    if (mine.error) throw mine.error;
    expect(await saveIngredients(sam, { recipeId: own, familyId: samFamily }, steal.rows, [])).toBe(false);
    expect(await ingredientsOf(alex)).toEqual(before);
  });

  // Spec 016: the steps, saved through save_recipe_steps.
  it('016: saves steps with their add-ons, and the recipe page reads them as the Preview did (SC-001)', async () => {
    const leeks = { ...emptyDraft(leekId), name: 'Leeks', quantity: '2', unit: 'piece' as const, weight: '150' };
    const butter = { ...emptyDraft(butterId), name: 'Butter', quantity: '20', unit: 'g' as const };
    const rows = readIngredients([butter, leeks]);
    if (!('rows' in rows)) throw new Error('expected rows');
    const melt = {
      ...emptyStep(randomUUID()),
      name: 'Cook the filling',
      body: `Melt ${ingredientToken(butterId)}, add ${ingredientToken(leekId)} and bake at 180 °C.`,
      timerOn: true,
      minutes: '8',
      tempOn: true,
      tempValue: '71',
      tempText: 'center reaches',
      tipOn: true,
      tip: 'Low heat.',
    };
    const read = readSteps([melt, { ...emptyStep(randomUUID()), body: 'Rest.' }]);
    if (!('rows' in read)) throw new Error('expected steps');
    const loaded = await loadRecipeForm(alex, recipeId);
    const input = readDetails(formFromRecipe(loaded));
    if (!('input' in input)) throw new Error('expected details');
    expect(await saveRecipe(alex, { id: recipeId, familyId, isNew: false }, input.input, { rows: rows.rows, drafts: [] }, read.rows)).toEqual({ ok: true, created: false, detailsSaved: true });

    const formPreview = stepParts(read.rows[0]?.body ?? '', [butter, leeks].map(quantityOf), defaultFormat, new Map());
    const recipe = await loadRecipe(mia, recipeId);
    if (!recipe) throw new Error('recipe');
    const view = recipeView(recipe, recipe.serves, { version: null, options: [] });
    expect(view.steps[0]?.parts).toEqual(formPreview);
    expect(view.steps[0]?.parts.map((p) => (typeof p === 'string' ? p : 'amount' in p ? p.amount : p.missing)).join('')).toBe(
      'Melt 20 g butter, add 2 leeks (300 g) and bake at 180 °C (350 °F).',
    );
    expect(view.steps[0]).toMatchObject({ tip: 'Low heat.', tempCheck: 'center reaches 71 °C (160 °F)', timer: { seconds: 480, label: 'Cook the filling' } });
    expect(view.steps.map((st) => st.number)).toEqual([1, 2]);

    // Opened again, nothing has changed.
    const again = draftsFromSteps((await loadRecipeForm(alex, recipeId))?.steps ?? []);
    expect(again.map((d) => [d.name, d.minutes, d.tempValue, d.tip])).toEqual([
      ['Cook the filling', '8 min', '71', 'Low heat.'],
      ['', '', '', ''],
    ]);
  });

  it("016: another family can't save into this recipe's steps", async () => {
    const before = (await loadRecipeForm(alex, recipeId))?.steps;
    const read = readSteps([{ ...emptyStep(randomUUID()), body: 'Mine now.' }]);
    if (!('rows' in read)) throw new Error('expected steps');
    const loaded = await loadRecipeForm(alex, recipeId);
    const input = readDetails(formFromRecipe(loaded));
    if (!('input' in input)) throw new Error('expected details');
    expect((await saveRecipe(sam, { id: recipeId, familyId: samFamily, isNew: false }, input.input, undefined, read.rows)).ok).toBe(false);
    expect((await loadRecipeForm(alex, recipeId))?.steps).toEqual(before);
  });
});
