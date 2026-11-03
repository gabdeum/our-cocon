import * as Crypto from 'expo-crypto';
import { DEFAULT_NOTIFICATION_PREFS, NotificationPrefs, PushPayload, type NotificationKind } from '@cocon/schemas';
import type { ChoiceStorage } from './recipe-choices';
import type { Client } from './supabase';

/**
 * Spec 046: notifications on this phone. The rules are here; the phone's own calls are behind
 * `NativeNotifications` (notifications-native.ios.ts, and none on the web), so they can be faked.
 */
export type PermissionStatus = 'granted' | 'denied' | 'undetermined';

/** What a notification shows, for the in-app banner while the app is open (FR-006). */
export type ShownNotification = { title: string; body: string; data: unknown };

export interface NativeNotifications {
  permission(): Promise<PermissionStatus>;
  /** The iPhone's own prompt. */
  request(): Promise<PermissionStatus>;
  /** This install's Expo push token, or null when there's none (a simulator, no network). */
  pushToken(): Promise<string | null>;
  onTokenChange(listener: () => void): () => void;
  /** A notification that arrived while the app is open: no system banner is shown (FR-006). */
  onForeground(listener: (n: ShownNotification) => void): () => void;
  /** A notification was tapped; `coldStart` when it opened the app. Each tap is reported once. */
  onOpen(listener: (data: unknown, coldStart: boolean) => void): () => void;
  /** On sign-out: the token stops working on the phone itself, even if the server never heard (security review). */
  unregister(): Promise<void>;
  openSettings(): void;
  appVersion: string;
}

export type Storage = ChoiceStorage & { removeItem: (key: string) => Promise<void> };

// FR-002: the ask, per device. ---------------------------------------------------------------------

export type AskResult = 'granted' | 'denied' | 'not_now';
export interface AskState {
  askedAt: number | null;
  askedCount: number;
  lastResult: AskResult | null;
}
export const NO_ASK: AskState = { askedAt: null, askedCount: 0, lastResult: null };
/** "Not now" may show the sheet once more, no sooner than 14 days later (edge cases). */
export const ASK_AGAIN_MS = 14 * 24 * 60 * 60 * 1000;
export const MAX_ASKS = 2;

/** Whether the sheet may show now. Never once the iPhone has an answer, granted or denied. */
export function shouldAsk(ask: AskState, status: PermissionStatus, now: number): boolean {
  if (status !== 'undetermined') return false;
  if (ask.askedCount === 0) return true;
  return ask.askedCount < MAX_ASKS && ask.lastResult === 'not_now' && ask.askedAt !== null && now - ask.askedAt >= ASK_AGAIN_MS;
}

export function recordAsk(ask: AskState, result: AskResult, now: number): AskState {
  return { askedAt: now, askedCount: ask.askedCount + 1, lastResult: result };
}

const ASK_KEY = 'cocon.notifications.ask';

export async function readAsk(storage: ChoiceStorage): Promise<AskState> {
  try {
    const raw = await storage.getItem(ASK_KEY);
    const v = raw ? (JSON.parse(raw) as Partial<AskState>) : {};
    return {
      askedAt: typeof v.askedAt === 'number' ? v.askedAt : null,
      askedCount: typeof v.askedCount === 'number' ? v.askedCount : 0,
      lastResult: v.lastResult === 'granted' || v.lastResult === 'denied' || v.lastResult === 'not_now' ? v.lastResult : null,
    };
  } catch {
    return NO_ASK;
  }
}

export async function writeAsk(storage: ChoiceStorage, ask: AskState): Promise<void> {
  try {
    await storage.setItem(ASK_KEY, JSON.stringify(ask));
  } catch {
    // Best effort: at worst the sheet shows once more.
  }
}

// FR-003: the switches, per person on this phone. ---------------------------------------------------

const prefsKey = (userId: string) => `cocon.notifications.prefs.${userId}`;

export async function readPrefs(storage: ChoiceStorage, userId: string): Promise<NotificationPrefs> {
  try {
    const raw = await storage.getItem(prefsKey(userId));
    const saved = NotificationPrefs.partial().safeParse(raw ? JSON.parse(raw) : {});
    return { ...DEFAULT_NOTIFICATION_PREFS, ...(saved.success ? saved.data : {}) };
  } catch {
    return DEFAULT_NOTIFICATION_PREFS;
  }
}

export async function writePrefs(storage: ChoiceStorage, userId: string, prefs: NotificationPrefs): Promise<void> {
  try {
    await storage.setItem(prefsKey(userId), JSON.stringify(prefs));
  } catch {
    // The phone keeps the change on screen; it's saved again with the next one.
  }
}

/** On sign-out: the next person on a shared iPad starts from the defaults. */
export async function clearPrefs(storage: Storage, userId: string): Promise<void> {
  try {
    await storage.removeItem(prefsKey(userId));
  } catch {
    // Nothing else to do.
  }
}

// FR-004: this install, registered for whoever is signed in. ---------------------------------------

const DEVICE_KEY = 'cocon.device.id';

/** A random id made once per install; kept across sign-ins so the device moves to the next person. */
export async function deviceId(storage: ChoiceStorage, make: () => string = Crypto.randomUUID): Promise<string> {
  try {
    const saved = await storage.getItem(DEVICE_KEY);
    if (saved) return saved;
  } catch {
    // Make one below.
  }
  const id = make();
  try {
    await storage.setItem(DEVICE_KEY, id);
  } catch {
    // Used for this run only; the next start makes another and registers again.
  }
  return id;
}

/**
 * Registers this phone for the signed-in member. The server refuses an id that's another
 * person's with a different token (42501): this install then makes a new id and tries again.
 */
export async function registerDevice(
  client: Pick<Client, 'rpc'>,
  native: NativeNotifications,
  storage: ChoiceStorage,
  prefs: NotificationPrefs,
  make: () => string = Crypto.randomUUID,
): Promise<boolean> {
  const token = await native.pushToken();
  if (!token) return false;
  const register = async (id: string) =>
    (await client.rpc('register_push_device', { p_device_id: id, p_platform: 'ios', p_token: token, p_prefs: prefs, p_app_version: native.appVersion })).error;
  const error = await register(await deviceId(storage, make));
  if (error?.code !== '42501') return !error;
  const fresh = make();
  try {
    await storage.setItem(DEVICE_KEY, fresh);
  } catch {
    // Used for this run only.
  }
  return !(await register(fresh));
}

export async function savePushPrefs(client: Pick<Client, 'rpc'>, id: string, prefs: NotificationPrefs): Promise<void> {
  await client.rpc('set_push_prefs', { p_device_id: id, p_prefs: prefs });
}

/** Signing out stops reminders on this phone. Best effort, and never more than 3 s. */
export async function unregisterDevice(client: Pick<Client, 'rpc'>, storage: ChoiceStorage): Promise<void> {
  let saved: string | null;
  try {
    saved = await storage.getItem(DEVICE_KEY);
  } catch {
    return;
  }
  if (!saved) return;
  await Promise.race([client.rpc('unregister_push_device', { p_device_id: saved }).then(() => undefined, () => undefined), new Promise((r) => setTimeout(r, 3000))]);
}

// FR-006: where a tap goes. ---------------------------------------------------------------------------

/** The screen a tapped notification opens, or null for anything that isn't ours. */
export function openedRoute(data: unknown): { route: string; kind: NotificationKind } | null {
  const payload = PushPayload.safeParse(data);
  return payload.success ? { route: payload.data.route, kind: payload.data.kind } : null;
}
