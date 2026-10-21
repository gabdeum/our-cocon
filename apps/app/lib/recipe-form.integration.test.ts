// @vitest-environment node
// Spec 014 against local Supabase. US1: Alex saves a recipe with only a name; it gets the defaults
// and opens for Mia (same family). An edit saves every detail. FR-004: a photo goes under the
// family's folder, Mia gets a signed link, and Sam (another family) can neither read, list nor
// overwrite it, nor see or edit the recipe. Skipped locally when Supabase isn't running.
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
    expect(await saveRecipe(alex, { id: recipeId, familyId, isNew: true }, read.input)).toBe(true);
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
    expect(await saveRecipe(mia, { id: recipeId, familyId, isNew: false }, read.input)).toBe(true);
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
    expect(await saveRecipe(alex, { id: recipeId, familyId, isNew: false }, read.input)).toBe(true);

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
});
