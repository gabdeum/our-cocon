import { randomUUID } from 'expo-crypto';
import { cuisineOf, IngredientInput, RecipeInput, StepInput, VariantInput, type SharedRecipe, type VariantChange } from '@cocon/schemas';
import { strings } from '../strings/en';
import type { IngredientSaveRow } from './recipe-ingredients';
import type { StepSaveRow } from './recipe-steps';
import type { VariantSaveRow } from './recipe-variants';
import { saveRecipe } from './recipe-form';
import { newPhotoPath, uploadPhoto } from './recipe-photo';
import type { Client } from './supabase';

/** What the copy saves (FR-004): the shared recipe with ids of its own, for the viewer's family. */
export interface SharedCopy {
  id: string;
  input: RecipeInput;
  ingredients: IngredientSaveRow[];
  steps: StepSaveRow[];
  variants: VariantSaveRow[];
}

/**
 * The shared recipe as a new recipe (spec 019 FR-004). Every ingredient, step and variant gets a
 * new id, and what points at them (variants' changes, `{ing:<id>}` in step text) follows. Photos
 * become the new paths in `photos` (old path → new path); one not copied is left out. The Source
 * field credits who shared it.
 */
export function sharedCopy(recipe: SharedRecipe, id: string, newId: () => string, photos: Readonly<Record<string, string>>): SharedCopy {
  const ids = new Map<string, string>();
  const to = (old: string) => {
    let next = ids.get(old);
    if (!next) {
      next = newId();
      ids.set(old, next);
    }
    return next;
  };
  // Every id first, so a step can mention an ingredient a variant adds.
  for (const i of recipe.ingredients) to(i.id);
  for (const s of recipe.steps) to(s.id);
  for (const v of recipe.variants)
    for (const c of v.changes) {
      if (c.type === 'swap_ingredient') c.with.forEach((w) => to(w.id));
      if (c.type === 'add_ingredient') to(c.ingredient.id);
    }
  const id_ = (old: string) => ids.get(old) ?? old;
  const body = (text: string) => text.replace(/\{ing:([0-9a-f-]{36})\}/g, (token, old: string) => (ids.has(old) ? `{ing:${id_(old)}}` : token));
  const photo = (path: string | null | undefined) => (path ? (photos[path] ?? null) : null);

  const change = (c: VariantChange): VariantChange => {
    switch (c.type) {
      case 'swap_ingredient':
        return { ...c, ingredient_id: id_(c.ingredient_id), with: c.with.map((w) => ({ ...w, id: id_(w.id) })) };
      case 'add_ingredient':
        return { ...c, ingredient: { ...c.ingredient, id: id_(c.ingredient.id) } };
      case 'remove_ingredient':
        return { ...c, ingredient_id: id_(c.ingredient_id) };
      case 'add_step':
        return { ...c, step_id: id_(c.step_id), step: { ...c.step, body: body(c.step.body), photo_path: photo(c.step.photo_path) } };
      case 'change_step':
        return { ...c, step_id: id_(c.step_id), ...(c.body !== undefined ? { body: body(c.body) } : {}) };
      case 'remove_step':
        return { ...c, step_id: id_(c.step_id) };
    }
  };

  return {
    id,
    input: {
      name: recipe.name,
      description: recipe.description,
      serves: recipe.serves,
      total_minutes: recipe.total_minutes,
      prep_minutes: recipe.prep_minutes,
      cuisine: cuisineOf(recipe.cuisine),
      source_text: recipe.shared_by ? strings.sharedView.source(recipe.shared_by) : strings.sharedView.sharedByNobody,
      best_months: recipe.best_months,
      photo_path: photo(recipe.photo_path),
    },
    ingredients: recipe.ingredients.map((i) => ({ ...i, id: id_(i.id) })),
    steps: recipe.steps.map((s) => ({ ...s, id: id_(s.id), body: body(s.body), photo_path: photo(s.photo_path) })),
    variants: recipe.variants.map((v) => ({ id: newId(), name: v.name, kind: v.kind, changes: v.changes.map(change) })),
  };
}

/**
 * The copy checked like any other recipe (packages/schemas): it's another family's text, so it
 * passes the same rules before it's saved into this one.
 */
export function validCopy(copy: SharedCopy): boolean {
  return (
    RecipeInput.safeParse(copy.input).success &&
    copy.ingredients.every((row, position) => IngredientInput.safeParse({ ...withoutId(row), position }).success) &&
    copy.steps.every((row, position) => StepInput.safeParse({ ...withoutId(row), position }).success) &&
    copy.variants.every((v, position) => VariantInput.safeParse({ position, name: v.name, kind: v.kind, changes: v.changes }).success)
  );
}

function withoutId<T extends { id: string }>({ id: _id, ...row }: T): Omit<T, 'id'> {
  return row;
}

/** A JPEG's first bytes. Only JPEGs are copied: the app stores photos as JPEG (spec 014). */
export const isJpeg = (bytes: Uint8Array) => bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;

/** Every photo a shared recipe shows: the header, its steps and the steps its variants add. */
export function sharedPhotoPaths(recipe: SharedRecipe): string[] {
  const added = recipe.variants.flatMap((v) => v.changes.flatMap((c) => (c.type === 'add_step' && c.step.photo_path ? [c.step.photo_path] : [])));
  return [...new Set([recipe.photo_path, ...recipe.steps.map((s) => s.photo_path), ...added].filter((p): p is string => Boolean(p)))];
}

export interface SaveSharedDeps {
  /** The photo's bytes, from its signed link; null when it can't be read. */
  download: (url: string) => Promise<Uint8Array | null>;
  newId: () => string;
}

const defaultDeps: SaveSharedDeps = {
  download: async (url) => {
    try {
      const res = await fetch(url);
      return res.ok ? new Uint8Array(await res.arrayBuffer()) : null;
    } catch {
      return null;
    }
  },
  newId: randomUUID,
};

/**
 * "Save to my Our Cocon" (FR-004): copies the photos into the family's folder (best effort: one
 * that fails is left out), then saves through the recipe form's own save, so the same checks
 * apply. Returns the new recipe's id, or null when it couldn't be saved.
 */
export async function saveSharedRecipe(
  client: Pick<Client, 'from' | 'rpc' | 'storage'>,
  familyId: string,
  recipe: SharedRecipe,
  photoUrls: Readonly<Record<string, string>>,
  deps: SaveSharedDeps = defaultDeps,
): Promise<string | null> {
  const id = deps.newId();
  // Nothing is uploaded for a recipe that wouldn't save.
  if (!validCopy(sharedCopy(recipe, id, deps.newId, {}))) return null;
  const photos: Record<string, string> = {};
  await Promise.all(
    sharedPhotoPaths(recipe).map(async (old) => {
      const url = photoUrls[old];
      const bytes = url ? await deps.download(url) : null;
      if (!bytes || !isJpeg(bytes)) return;
      const path = newPhotoPath(familyId, id, deps.newId());
      if (await uploadPhoto(client, path, bytes)) photos[old] = path;
    }),
  );
  const copy = sharedCopy(recipe, id, deps.newId, photos);
  if (!validCopy(copy)) return null;
  const saved = await saveRecipe(client, { id, familyId, isNew: true }, copy.input, { rows: copy.ingredients, drafts: [] }, copy.steps, copy.variants);
  return saved.created ? id : null;
}
