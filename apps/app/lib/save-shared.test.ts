import { describe, expect, it, vi } from 'vitest';
import { quiche } from '@cocon/schemas/quiche.fixture';
import type { SharedRecipe } from '@cocon/schemas';
import { saveSharedRecipe, sharedCopy, sharedPhotoPaths } from './save-shared';

vi.mock('expo-image-picker', () => ({}));
vi.mock('expo-image-manipulator', () => ({ ImageManipulator: {}, SaveFormat: { JPEG: 'jpeg' } }));
vi.mock('expo-crypto', () => ({ randomUUID: () => '00000000-0000-4000-8000-00000000ffff' }));

// Spec 019 FR-004: "Save to my Our Cocon" copies the shared recipe with ids of its own.
const fam = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const photoA = `${fam}/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/cccccccc-cccc-4ccc-8ccc-cccccccccccc.jpg`;
const photoB = `${fam}/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/dddddddd-dddd-4ddd-8ddd-dddddddddddd.jpg`;

const shared: SharedRecipe = {
  name: 'Leek & bacon quiche',
  description: 'Silky custard.',
  serves: 6,
  total_minutes: 70,
  prep_minutes: null,
  cuisine: 'french',
  best_months: [10, 11],
  photo_path: photoA,
  shared_by: 'Gabriel',
  ingredients: quiche.ingredients,
  steps: quiche.steps.map((s, i) => (i === 0 ? { ...s, photo_path: photoB } : s)),
  variants: quiche.variants,
  facts: {},
};

function counter() {
  let n = 0;
  return () => `00000000-0000-4000-9000-${String((n += 1)).padStart(12, '0')}`;
}

const allIds = (value: unknown): string[] => JSON.stringify(value).match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g) ?? [];

describe('sharedCopy', () => {
  it('gives every row a new id and keeps what points at them (variants, step tokens)', () => {
    const copy = sharedCopy(shared, 'new-recipe', counter(), {});
    const old = new Set([...quiche.ingredients, ...quiche.steps, ...quiche.variants].map((r) => r.id));
    expect(copy.ingredients.some((i) => old.has(i.id))).toBe(false);
    expect(copy.steps.some((s) => old.has(s.id))).toBe(false);
    expect(copy.variants.some((v) => old.has(v.id))).toBe(false);
    // Nothing in the copy points at the shared recipe's rows any more.
    expect(allIds([copy.ingredients, copy.steps, copy.variants]).filter((x) => old.has(x))).toEqual([]);
    // Every ingredient a step mentions is one of the copy's.
    const mine = new Set(copy.ingredients.map((i) => i.id));
    for (const s of copy.steps) for (const [, ref] of s.body.matchAll(/\{ing:([0-9a-f-]{36})\}/g)) expect(mine.has(ref ?? '')).toBe(true);
  });

  it('keeps the recipe, and credits who shared it in Source', () => {
    const copy = sharedCopy(shared, 'new-recipe', counter(), {});
    expect(copy.input).toMatchObject({ name: 'Leek & bacon quiche', serves: 6, total_minutes: 70, cuisine: 'french', best_months: [10, 11], source_text: 'Shared by Gabriel' });
    expect(copy.ingredients.map((i) => i.name)).toEqual(quiche.ingredients.map((i) => i.name));
    expect(copy.variants.map((v) => v.name)).toEqual(quiche.variants.map((v) => v.name));
  });

  it('uses the copied photos, and leaves out one that was not copied', () => {
    const copy = sharedCopy(shared, 'new-recipe', counter(), { [photoA]: 'mine/new.jpg' });
    expect(copy.input.photo_path).toBe('mine/new.jpg');
    expect(copy.steps[0]?.photo_path).toBeNull();
  });

  it('credits "Shared from Our Cocon" when whoever shared it has left', () => {
    expect(sharedCopy({ ...shared, shared_by: null }, 'x', counter(), {}).input.source_text).toBe('Shared from Our Cocon');
  });
});

describe('saveSharedRecipe', () => {
  it('copies the photos into the family folder, then saves through the recipe form\'s save', async () => {
    const upload = vi.fn().mockResolvedValue({ error: null });
    const insert = vi.fn().mockResolvedValue({ error: null });
    const rpc = vi.fn().mockResolvedValue({ error: null });
    const client = { from: () => ({ insert }), rpc, storage: { from: () => ({ upload }) } };
    const download = vi.fn(async (url: string) => (url.includes('A') ? new Uint8Array([0xff, 0xd8, 0xff, 0xe0]) : null));
    const mineFam = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
    const id = await saveSharedRecipe(client as never, mineFam, shared, { [photoA]: 'https://api/A', [photoB]: 'https://api/B' }, { download, newId: counter() });
    expect(id).toBe('00000000-0000-4000-9000-000000000001');
    expect(download).toHaveBeenCalledTimes(2);
    expect(sharedPhotoPaths(shared).sort()).toEqual([photoA, photoB].sort());
    // Only the photo it could read, under the new recipe's folder in the viewer's family.
    expect(upload).toHaveBeenCalledOnce();
    const uploaded = String(upload.mock.calls[0]?.[0]);
    expect(uploaded).toMatch(new RegExp(`^${mineFam}/${id}/`));
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ id, family_id: mineFam, name: 'Leek & bacon quiche', photo_path: uploaded }));
    expect(rpc.mock.calls.map((c) => c[0])).toEqual(['save_recipe_ingredients', 'save_recipe_steps', 'save_recipe_variants']);
  });

  it('says it failed when the recipe could not be saved', async () => {
    const client = { from: () => ({ insert: vi.fn().mockResolvedValue({ error: { message: 'no' } }) }), rpc: vi.fn(), storage: { from: () => ({ upload: vi.fn() }) } };
    expect(await saveSharedRecipe(client as never, 'f', { ...shared, photo_path: null, steps: quiche.steps }, {}, { download: vi.fn(), newId: counter() })).toBeNull();
  });

  it('copies only JPEG photos', async () => {
    const upload = vi.fn().mockResolvedValue({ error: null });
    const client = { from: () => ({ insert: vi.fn().mockResolvedValue({ error: null }) }), rpc: vi.fn().mockResolvedValue({ error: null }), storage: { from: () => ({ upload }) } };
    const html = new TextEncoder().encode('<html>');
    await saveSharedRecipe(client as never, 'f', shared, { [photoA]: 'https://api/A' }, { download: vi.fn().mockResolvedValue(html), newId: counter() });
    expect(upload).not.toHaveBeenCalled();
  });

  it('refuses a copy that breaks the recipe rules, before uploading anything', async () => {
    const upload = vi.fn();
    const insert = vi.fn();
    const client = { from: () => ({ insert }), rpc: vi.fn(), storage: { from: () => ({ upload }) } };
    const tooLong = { ...shared, ingredients: [{ ...quiche.ingredients[0], id: 'c0c01000-0000-4000-8000-000000000001', name: 'x'.repeat(81) }] };
    expect(await saveSharedRecipe(client as never, 'f', tooLong as SharedRecipe, { [photoA]: 'https://api/A' }, { download: vi.fn(), newId: counter() })).toBeNull();
    expect(upload).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });
});
