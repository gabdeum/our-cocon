// @vitest-environment node
// Spec 019 against local Supabase and its share endpoint (supabase/functions/shared-recipe).
// US1: Alex shares the quiche and anyone, signed out, reads it, photo included (032-later L26).
// SC-001: no family data; the family and recipe ids appear only inside photo paths (which a
// signed link carries anyway, and which give no access on their own). US3: stopped, the link reads "not shared", and
// sharing again makes a new link. L38: deleted, the link stops; restored, it works again. FR-004:
// Sam saves it into his own family. Skipped locally when Supabase isn't running.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@cocon/schemas';
import { clientOptions, localSupabase, signInPerson, type Client } from '../test/local-supabase';

vi.mock('expo-image-picker', () => ({}));
vi.mock('expo-image-manipulator', () => ({ ImageManipulator: {}, SaveFormat: { JPEG: 'jpeg' } }));
vi.mock('expo-crypto', () => ({ randomUUID }));
vi.mock('expo-clipboard', () => ({ setStringAsync: vi.fn() }));
vi.mock('expo-linking', () => ({ createURL: (p: string) => `ourcocon://${p}` }));
vi.mock('react-native', () => ({ Platform: { OS: 'ios' }, Share: { share: vi.fn() } }));

const { openShareLink, stopShareLink, setShareOptions } = await import('./share');
const { loadSharedRecipe } = await import('./shared-recipe');
const { saveSharedRecipe } = await import('./save-shared');
const { PHOTO_BUCKET } = await import('./recipe-photo');

const local = localSupabase();
if (!local && process.env.CI) throw new Error('Local Supabase must be running in CI for the share integration test');
if (!local) console.warn('share.integration.test.ts skipped: local Supabase is not running (pnpm dev starts it).');

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 0xff, 0xd9]);

// The first call wakes the Edge Function, which can take a few seconds under load.
describe.skipIf(!local)('sharing a recipe against local Supabase', { timeout: 20_000 }, () => {
  const { url, anonKey, serviceKey } = local ?? { url: '', anonKey: '', serviceKey: '' };
  const admin = createClient<Database>(url, serviceKey, clientOptions);
  const endpoint = { supabaseUrl: url, anonKey };
  const run = randomUUID().slice(0, 8);
  const userIds: string[] = [];
  let alex: Client;
  let sam: Client;
  let familyId = '';
  let samFamily = '';
  const recipeId = randomUUID();
  const leeks = randomUUID();
  let photoPath = '';
  const copies: string[] = [];

  const person = (name: string) => signInPerson(admin, url, anonKey, `share-${name}-${run}@example.com`, userIds);

  beforeAll(async () => {
    [alex, sam] = await Promise.all([person('alex'), person('sam')]);
    const fam = await alex.rpc('create_family', { family_name: 'Share test', display_name: 'Alex' });
    if (fam.error) throw fam.error;
    familyId = fam.data;
    const other = await sam.rpc('create_family', { family_name: 'Other family', display_name: 'Sam' });
    if (other.error) throw other.error;
    samFamily = other.data;
    photoPath = `${familyId}/${recipeId}/${randomUUID()}.jpg`;
    const up = await alex.storage.from(PHOTO_BUCKET).upload(photoPath, jpeg, { contentType: 'image/jpeg' });
    if (up.error) throw up.error;
    const rec = await alex.from('recipes').insert({ id: recipeId, family_id: familyId, name: 'Leek quiche', serves: 6, photo_path: photoPath });
    if (rec.error) throw rec.error;
    const ing = await alex.rpc('save_recipe_ingredients', {
      p_recipe_id: recipeId,
      p_ingredients: [{ id: leeks, name: 'Leeks', catalog_key: 'leek', quantity: 2, unit: 'piece' }],
    });
    if (ing.error) throw ing.error;
    const steps = await alex.rpc('save_recipe_steps', {
      p_recipe_id: recipeId,
      p_steps: [{ id: randomUUID(), name: 'Bake', body: `Slice {ing:${leeks}} and bake.`, timer_seconds: 720, tip: 'Watch the crust.' }],
    });
    if (steps.error) throw steps.error;
  }, 30_000);

  afterAll(async () => {
    await admin.storage.from(PHOTO_BUCKET).remove([photoPath]);
    for (const id of copies) {
      const { data } = await admin.storage.from(PHOTO_BUCKET).list(`${samFamily}/${id}`);
      await admin.storage.from(PHOTO_BUCKET).remove((data ?? []).map((f) => `${samFamily}/${id}/${f.name}`));
    }
    for (const id of userIds) await admin.auth.admin.deleteUser(id);
  });

  it('US1, L26, SC-001: anyone with the link reads the recipe and its photo, and nothing else', async () => {
    const first = await openShareLink(alex, recipeId);
    expect(first.created).toBe(true);
    expect((await openShareLink(alex, recipeId)).token).toBe(first.token);

    const shared = await loadSharedRecipe(first.token, endpoint);
    if (shared.kind !== 'shared') throw new Error('not shared');
    expect(shared.recipe).toMatchObject({ name: 'Leek quiche', serves: 6, shared_by: 'Alex' });
    expect(shared.recipe.steps[0]?.tip).toBe('Watch the crust.');
    const photo = shared.photoUrls[photoPath];
    expect(photo?.startsWith(`${url}/storage/v1/object/sign/`)).toBe(true);
    expect((await fetch(photo ?? '')).status).toBe(200);

    const raw = await (await fetch(`${url}/functions/v1/shared-recipe?token=${first.token}`, { headers: { apikey: anonKey } })).text();
    // Supabase's signed photo links carry the photo's path (`<family>/<recipe>/<file>`); the ids
    // appear there and nowhere else, and give no access on their own (RLS).
    const outsidePhotos = raw.split(photoPath).join('');
    expect(outsidePhotos).not.toContain(familyId);
    expect(outsidePhotos).not.toContain(recipeId);
    expect(raw).not.toContain('family_id');
    expect(raw).not.toContain('created_by');
  });

  it('edge case: switching tips off hides them at once', async () => {
    const { token } = await openShareLink(alex, recipeId);
    await setShareOptions(alex, token, { include_tips: false });
    const shared = await loadSharedRecipe(token, endpoint);
    expect(shared.kind === 'shared' && shared.recipe.steps[0]?.tip).toBeNull();
    await setShareOptions(alex, token, { include_tips: true });
  });

  it('another family can read the link, but not stop it', async () => {
    const { token } = await openShareLink(alex, recipeId);
    await stopShareLink(sam, recipeId, token);
    expect((await loadSharedRecipe(token, endpoint)).kind).toBe('shared');
  });

  it('FR-004: Sam saves it into his own family, photo included, credited to Alex', async () => {
    const { token } = await openShareLink(alex, recipeId);
    const shared = await loadSharedRecipe(token, endpoint);
    if (shared.kind !== 'shared') throw new Error('not shared');
    const id = await saveSharedRecipe(sam, samFamily, shared.recipe, shared.photoUrls);
    expect(id).not.toBeNull();
    copies.push(id ?? '');
    const { data } = await sam.from('recipes').select('family_id, name, source_text, photo_path, recipe_ingredients(id), recipe_steps(body)').eq('id', id ?? '').single();
    expect(data).toMatchObject({ family_id: samFamily, name: 'Leek quiche', source_text: 'Shared by Alex' });
    expect(data?.photo_path?.startsWith(`${samFamily}/${id}/`)).toBe(true);
    const newLeeks = data?.recipe_ingredients[0]?.id;
    expect(newLeeks).not.toBe(leeks);
    expect(data?.recipe_steps[0]?.body).toBe(`Slice {ing:${newLeeks}} and bake.`);
    // Alex's own recipe is untouched.
    expect((await alex.from('recipes').select('id').eq('id', recipeId)).data).toHaveLength(1);
  });

  it('L38: a deleted recipe\'s link stops, and works again once restored', async () => {
    const { token } = await openShareLink(alex, recipeId);
    await alex.from('recipes').update({ deleted_at: new Date().toISOString() }).eq('id', recipeId);
    expect((await loadSharedRecipe(token, endpoint)).kind).toBe('not_shared');
    await alex.from('recipes').update({ deleted_at: null }).eq('id', recipeId);
    expect((await loadSharedRecipe(token, endpoint)).kind).toBe('shared');
  });

  it('US3: stopped, the link reads "not shared" at once; sharing again makes a new link', async () => {
    const { token } = await openShareLink(alex, recipeId);
    await stopShareLink(alex, recipeId, token);
    expect((await loadSharedRecipe(token, endpoint)).kind).toBe('not_shared');
    const again = await openShareLink(alex, recipeId);
    expect(again.created).toBe(true);
    expect(again.token).not.toBe(token);
  });

  it('a guessed or malformed token reads "not shared"', async () => {
    expect((await loadSharedRecipe('x'.repeat(43), endpoint)).kind).toBe('not_shared');
    expect((await loadSharedRecipe('../etc', endpoint)).kind).toBe('not_shared');
  });
});
