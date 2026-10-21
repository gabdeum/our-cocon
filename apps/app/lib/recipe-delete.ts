import { PHOTO_BUCKET } from './recipe-photo';
import type { Client } from './supabase';

/**
 * Spec 018: deleting a recipe moves it to Recently deleted for 30 days (FR-004); the database stamps
 * who and when. After that the nightly job removes it for good (scripts/purge-deleted.ts).
 */
export const KEEP_DAYS = 30;
const DAY = 24 * 60 * 60 * 1000;

/** Starts with `recipes`, so a live change to any recipe refetches it (lib/sync.tsx). */
export const deletedRecipesKey = (familyId: string) => ['recipes', familyId, 'deleted'] as const;

export interface DeletedRecipe {
  id: string;
  name: string;
  deleted_at: string;
  deleted_by: string | null;
}

/** Whole days since it was deleted: 0 on the day itself. */
export function daysSinceDelete(deletedAt: string, now: Date = new Date()): number {
  return Math.max(0, Math.min(KEEP_DAYS, Math.floor((now.getTime() - Date.parse(deletedAt)) / DAY)));
}

/** Days until the nightly job removes it, counting today: 30 right after deleting, 1 on the last day. */
export function daysLeft(deletedAt: string, now: Date = new Date()): number {
  return Math.max(0, Math.min(KEEP_DAYS, Math.ceil((Date.parse(deletedAt) + KEEP_DAYS * DAY - now.getTime()) / DAY)));
}

/** Throws when nothing was deleted (already gone, or another family's). */
export async function deleteRecipe(client: Pick<Client, 'from'>, id: string): Promise<void> {
  const { data, error } = await client
    .from('recipes')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .is('deleted_at', null)
    .select('id');
  if (error) throw error;
  if (data.length === 0) throw new Error('Recipe not found');
}

/** Puts it back as it was; its ingredients, steps, variants and photos never left. */
export async function restoreRecipe(client: Pick<Client, 'from'>, id: string): Promise<void> {
  const { data, error } = await client.from('recipes').update({ deleted_at: null }).eq('id', id).not('deleted_at', 'is', null).select('id');
  if (error) throw error;
  if (data.length === 0) throw new Error('Recipe not found');
}

/** The family's recipes deleted in the last 30 days, newest first (FR-003). */
export async function loadDeleted(client: Pick<Client, 'from'>, now: Date = new Date()): Promise<DeletedRecipe[]> {
  const since = new Date(now.getTime() - KEEP_DAYS * DAY).toISOString();
  const { data, error } = await client
    .from('recipes')
    .select('id, name, deleted_at, deleted_by')
    .not('deleted_at', 'is', null)
    .gt('deleted_at', since)
    .order('deleted_at', { ascending: false });
  if (error) throw error;
  return data.flatMap((r) => (r.deleted_at ? [{ ...r, deleted_at: r.deleted_at }] : []));
}

/**
 * "Delete now", for a deleted recipe only: the recipe first (RLS only allows it once deleted), then
 * its photo folder (its photo, step photos and any left behind). In that order a restore at the same
 * moment can never leave a recipe without its photos; if removing them fails, they stay unused.
 */
export async function deleteNow(client: Pick<Client, 'from' | 'storage'>, familyId: string, id: string): Promise<void> {
  const { data, error } = await client.from('recipes').delete().eq('id', id).not('deleted_at', 'is', null).select('id');
  if (error) throw error;
  if (data.length === 0) throw new Error('Recipe not found');
  const folder = `${familyId}/${id}`;
  const bucket = client.storage.from(PHOTO_BUCKET);
  try {
    const listed = await bucket.list(folder, { limit: 1000 });
    const files = (listed.data ?? []).filter((f) => f.id !== null).map((f) => `${folder}/${f.name}`);
    if (files.length > 0) await bucket.remove(files);
  } catch {
    // Left in storage with nothing pointing to it (032-later L28).
  }
}
