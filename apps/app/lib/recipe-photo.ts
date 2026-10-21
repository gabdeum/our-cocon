import { useQuery } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { randomUUID } from 'expo-crypto';
import type { CropRect } from '@cocon/ui';
import type { RecipeDetail } from './recipe';
import type { Client } from './supabase';

/** Spec 014 FR-004. Private: photos are shown through short-lived signed links. */
export const PHOTO_BUCKET = 'recipe-photos';
/** The longest side kept after cropping. */
export const MAX_PHOTO_PX = 2000;
const SIGNED_SECONDS = 60 * 60;

type Storage = Pick<Client, 'storage'>;

/** `<family>/<recipe>/<file>.jpg`: storage RLS lets only the family in the first folder touch it. */
export const newPhotoPath = (familyId: string, recipeId: string, file: string = randomUUID()) => `${familyId}/${recipeId}/${file}.jpg`;

export interface PickedPhoto {
  uri: string;
  width: number;
  height: number;
}

/** The photo library (iOS) or a file picker (web). Null when nothing was picked. */
export async function pickPhoto(): Promise<PickedPhoto | 'denied' | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return 'denied';
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
  const asset = result.canceled ? undefined : result.assets[0];
  return asset ? { uri: asset.uri, width: asset.width, height: asset.height } : null;
}

/** The new size after cropping: at most MAX_PHOTO_PX on the long side (the crop is 13:8, so the width). */
export function photoSize(rect: CropRect): { width: number } {
  return { width: Math.min(MAX_PHOTO_PX, rect.width) };
}

/** Crops to what the frame showed, resizes and saves a JPEG, ready to upload and to preview. */
export async function preparePhoto(uri: string, rect: CropRect): Promise<{ uri: string; bytes: Uint8Array }> {
  const context = ImageManipulator.manipulate(uri).crop(rect).resize(photoSize(rect));
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ compress: 0.85, format: SaveFormat.JPEG, base64: true });
  if (!saved.base64) throw new Error('No image data');
  return { uri: saved.uri, bytes: base64Bytes(saved.base64) };
}

/** The JPEG's bytes. `atob` exists on the web and in Hermes. */
export function base64Bytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** True once the photo is stored. A failure is shown with "Retry"; the rest of the form still saves. */
export async function uploadPhoto(client: Storage, path: string, bytes: Uint8Array): Promise<boolean> {
  try {
    const { error } = await client.storage.from(PHOTO_BUCKET).upload(path, bytes, { contentType: 'image/jpeg', upsert: false });
    return !error;
  } catch {
    return false;
  }
}

/** Best effort: a photo nobody uses any more (replaced, removed, or the form was cancelled). */
export async function removePhotos(client: Storage, paths: readonly (string | null | undefined)[]): Promise<void> {
  const unused = paths.filter((p): p is string => Boolean(p));
  if (unused.length === 0) return;
  try {
    await client.storage.from(PHOTO_BUCKET).remove(unused);
  } catch {
    // Left in storage; nothing for the cook to do (032-later: clean up unused photos).
  }
}

/** Every photo a recipe page can show: the header, its steps and the steps its variants add. */
export function recipePhotoPaths(recipe: Pick<RecipeDetail, 'photo_path' | 'steps' | 'variants'> | null | undefined): (string | null | undefined)[] {
  if (!recipe) return [];
  const added = recipe.variants.flatMap((v) => v.changes.flatMap((c) => (c.type === 'add_step' ? [c.step.photo_path] : [])));
  return [recipe.photo_path, ...recipe.steps.map((s) => s.photo_path), ...added];
}

export const photoUrlsKey = (familyId: string, paths: readonly string[]) => ['recipe-photos', familyId, ...paths] as const;

/**
 * Signed links for recipe and step photos (032-later L10), by path: one request for the lot, and
 * refreshed before they expire. Used by the recipe list, the recipe page and its steps.
 */
export function useRecipePhotoUrls(client: Storage, familyId: string | null, paths: readonly (string | null | undefined)[]): PhotoUrls {
  const wanted = [...new Set(paths.filter((p): p is string => Boolean(p)))].sort();
  const query = useQuery({
    queryKey: photoUrlsKey(familyId ?? '', wanted),
    queryFn: () => signedPhotoUrls(client, wanted),
    enabled: familyId !== null && wanted.length > 0,
    staleTime: (SIGNED_SECONDS - 15 * 60) * 1000,
    gcTime: SIGNED_SECONDS * 1000,
  });
  return query.data ?? noUrls;
}

/** Signed link by photo path. A plain object, so the saved cache (JSON) keeps it. */
export type PhotoUrls = Readonly<Record<string, string>>;
const noUrls: PhotoUrls = {};

export async function signedPhotoUrls(client: Storage, paths: readonly string[]): Promise<PhotoUrls> {
  const { data, error } = await client.storage.from(PHOTO_BUCKET).createSignedUrls([...paths], SIGNED_SECONDS);
  if (error) throw error;
  return Object.fromEntries(data.flatMap((d) => (d.path && d.signedUrl && !d.error ? [[d.path, d.signedUrl] as const] : [])));
}
