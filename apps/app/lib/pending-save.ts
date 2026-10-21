import AsyncStorage from '@react-native-async-storage/async-storage';
import { ShareToken } from '@cocon/schemas';

/**
 * "Save to my Our Cocon" while signed out or without a family (spec 019 FR-004): the link waits
 * on this device through sign-in and family setup, then the shared page saves it. It waits an hour
 * at most, and signing out clears it, so it never lands in the next person's family.
 */
const KEY = 'cocon.pendingSave';
export const PENDING_SAVE_MS = 60 * 60 * 1000;

export type PendingStorage = Pick<typeof AsyncStorage, 'getItem' | 'setItem' | 'removeItem'>;

export async function rememberPendingSave(token: string, storage: PendingStorage = AsyncStorage, now = Date.now()): Promise<void> {
  await storage.setItem(KEY, JSON.stringify({ token, at: now })).catch(() => undefined);
}

/** The waiting link's token, or null when there's none or it waited too long. */
export async function pendingSave(storage: PendingStorage = AsyncStorage, now = Date.now()): Promise<string | null> {
  const raw = await storage.getItem(KEY).catch(() => null);
  try {
    const { token, at } = JSON.parse(raw ?? 'null') as { token?: unknown; at?: unknown };
    if (typeof at !== 'number' || now - at > PENDING_SAVE_MS || at > now) return null;
    return ShareToken.safeParse(token).success ? (token as string) : null;
  } catch {
    return null;
  }
}

export async function clearPendingSave(storage: PendingStorage = AsyncStorage): Promise<void> {
  await storage.removeItem(KEY).catch(() => undefined);
}
