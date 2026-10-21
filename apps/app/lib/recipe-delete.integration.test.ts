// @vitest-environment node
// Spec 018 against local Supabase. US1: Mia deletes Alex's quiche and it leaves the family's list.
// US2 and SC-001: restored, it is exactly as it was (rows, variants, photo). Sam, in another family,
// can't touch it. "Delete now" removes the recipe and its photos for good. Skipped locally when
// Supabase isn't running.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@cocon/schemas';
import { clientOptions, localSupabase, signInPerson, type Client } from '../test/local-supabase';

vi.mock('expo-image-picker', () => ({}));
vi.mock('expo-image-manipulator', () => ({ ImageManipulator: {}, SaveFormat: { JPEG: 'jpeg' } }));
vi.mock('expo-crypto', () => ({ randomUUID }));

const { deleteNow, deleteRecipe, loadDeleted, restoreRecipe } = await import('./recipe-delete');
const { loadRecipe } = await import('./recipe');
const { loadRecipeList } = await import('./recipes');
const { PHOTO_BUCKET } = await import('./recipe-photo');

const local = localSupabase();
if (!local && process.env.CI) throw new Error('Local Supabase must be running in CI for the recipe delete integration test');
if (!local) console.warn('recipe-delete.integration.test.ts skipped: local Supabase is not running (pnpm dev starts it).');

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 0xff, 0xd9]);

describe.skipIf(!local)('deleting and restoring a recipe against local Supabase', () => {
  const { url, anonKey, serviceKey } = local ?? { url: '', anonKey: '', serviceKey: '' };
  const admin = createClient<Database>(url, serviceKey, clientOptions);
  const run = randomUUID().slice(0, 8);
  const userIds: string[] = [];
  let alex: Client;
  let mia: Client;
  let sam: Client;
  let familyId = '';
  const recipeId = randomUUID();
  const leeks = randomUUID();
  const bake = randomUUID();

  const person = (name: string) => signInPerson(admin, url, anonKey, `delete-${name}-${run}@example.com`, userIds);
  // What a restore must bring back as it was; only the update stamps may move.
  const snapshot = async (client: Client) => {
    const recipe = await loadRecipe(client, recipeId);
    if (!recipe) throw new Error('no recipe');
    const { deleted_at: _deletedAt, deleted_by: _deletedBy, ...rest } = recipe;
    return rest;
  };

  beforeAll(async () => {
    alex = await person('alex');
    [mia, sam] = await Promise.all([person('mia'), person('sam')]);
    const fam = await alex.rpc('create_family', { family_name: 'Delete test', display_name: 'Alex' });
    if (fam.error) throw fam.error;
    familyId = fam.data;
    const invite = await alex.rpc('create_invite');
    if (invite.error) throw invite.error;
    const joined = await mia.rpc('accept_invite', { token: invite.data, display_name: 'Mia' });
    if (joined.error) throw joined.error;
    const other = await sam.rpc('create_family', { family_name: 'Other family', display_name: 'Sam' });
    if (other.error) throw other.error;

    const photo = `${familyId}/${recipeId}/${randomUUID()}.jpg`;
    const stepPhoto = `${familyId}/${recipeId}/${randomUUID()}.jpg`;
    for (const path of [photo, stepPhoto]) {
      const up = await alex.storage.from(PHOTO_BUCKET).upload(path, jpeg, { contentType: 'image/jpeg' });
      if (up.error) throw up.error;
    }
    const r = await alex.from('recipes').insert({ id: recipeId, family_id: familyId, name: 'Leek quiche', serves: 6, total_minutes: 70, cuisine: 'french', photo_path: photo });
    if (r.error) throw r.error;
    const ing = await alex.from('recipe_ingredients').insert({ family_id: familyId, recipe_id: recipeId, position: 0, id: leeks, name: 'Leeks', quantity: 2, unit: 'piece' });
    if (ing.error) throw ing.error;
    const steps = await alex
      .from('recipe_steps')
      .insert({ family_id: familyId, recipe_id: recipeId, position: 0, id: bake, name: 'Bake', body: `Add {ing:${leeks}}.`, timer_seconds: 2100, photo_path: stepPhoto });
    if (steps.error) throw steps.error;
    const variants = await alex.from('recipe_variants').insert([
      { family_id: familyId, recipe_id: recipeId, position: 0, name: 'Vegetarian', kind: 'version', changes: [{ type: 'remove_ingredient', ingredient_id: leeks }] },
      { family_id: familyId, recipe_id: recipeId, position: 1, name: 'Extra step', kind: 'option', changes: [{ type: 'add_step', step_id: bake, place: 'after', step: { body: 'Rest it.' } }] },
    ]);
    if (variants.error) throw variants.error;
  }, 30_000);

  afterAll(async () => {
    await admin.storage.from(PHOTO_BUCKET).remove([`${familyId}/${recipeId}`]);
    for (const id of userIds) await admin.auth.admin.deleteUser(id);
  });

  it('US1, US2, SC-001: deleted by Mia it leaves the list; restored it is exactly as it was', async () => {
    const before = await snapshot(alex);

    await deleteRecipe(mia, recipeId);
    expect((await loadRecipeList(alex)).map((r) => r.id)).not.toContain(recipeId);
    const [deleted] = await loadDeleted(alex);
    const miaId = (await mia.auth.getUser()).data.user?.id;
    expect(deleted).toMatchObject({ id: recipeId, name: 'Leek quiche', deleted_by: miaId });

    // Sam, in another family, can neither restore nor remove it.
    await expect(restoreRecipe(sam, recipeId)).rejects.toThrow();
    await expect(loadDeleted(sam)).resolves.toEqual([]);

    await restoreRecipe(alex, recipeId);
    expect((await loadRecipeList(mia)).map((r) => r.id)).toContain(recipeId);
    expect(await loadDeleted(alex)).toEqual([]);
    expect(await snapshot(mia)).toEqual(before);
    // The photos stayed in storage, so they still open.
    const signed = await alex.storage.from(PHOTO_BUCKET).createSignedUrls([before.photo_path ?? '', before.steps[0]?.photo_path ?? ''], 60);
    expect(signed.data?.every((s) => s.signedUrl && !s.error)).toBe(true);
  });

  it('"Delete now" only works on a deleted recipe, and takes its photos with it', async () => {
    await expect(deleteNow(mia, familyId, recipeId)).rejects.toThrow();
    expect(await loadRecipe(mia, recipeId)).not.toBeNull();
    expect((await admin.storage.from(PHOTO_BUCKET).list(`${familyId}/${recipeId}`)).data).toHaveLength(2);

    await deleteRecipe(mia, recipeId);
    await deleteNow(mia, familyId, recipeId);
    expect(await loadRecipe(alex, recipeId)).toBeNull();
    const left = await admin.storage.from(PHOTO_BUCKET).list(`${familyId}/${recipeId}`);
    expect(left.data ?? []).toEqual([]);
  });
});
