import { calendarWordsEn, formatTime } from '@cocon/calendar';
import type { ShareDuration } from '@cocon/schemas';
import { strings } from '../strings/en';
import { appUrl } from './links';
import { shareMessage, systemShare, type ShareDeps, type ShareOutcome } from './system-share';
import type { Client } from './supabase';

/** The grocery list's link (spec 072 FR-001): `/g/<token>`. */
export function groceryShareUrl(token: string) {
  return appUrl(`/g/${token}`);
}

export interface GroceryShareLink {
  token: string;
  duration: ShareDuration;
  expires_at: string | null;
  can_edit: boolean;
  created_at: string;
}

/** The share sheet's query key. Under the table's name, like every family query. */
export const groceryShareKey = (familyId: string) => ['grocery_share_links', familyId] as const;

/**
 * FR-002: when a link made now ends, on this device's clock: in an hour, at 23:59 tonight, at 23:59
 * on Sunday (tonight on a Sunday), or never.
 */
export function expiresAtFor(duration: ShareDuration, now: Date = new Date()): Date | null {
  if (duration === 'none') return null;
  if (duration === '1h') return new Date(now.getTime() + 60 * 60 * 1000);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  if (duration === 'week') end.setDate(end.getDate() + ((7 - now.getDay()) % 7));
  return end;
}

/** When a link ends, as the sheet and page say it: "today at 23:59", "Sunday at 23:59". Null for never. */
export function endsText(
  expiresAt: string | null,
  words: { endsToday: (time: string) => string; endsOn: (day: string, time: string) => string },
  use24h: boolean,
  now: Date = new Date(),
): string | null {
  if (!expiresAt) return null;
  const end = new Date(expiresAt);
  const time = formatTime(`${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`, use24h);
  const sameDay = end.getFullYear() === now.getFullYear() && end.getMonth() === now.getMonth() && end.getDate() === now.getDate();
  return sameDay ? words.endsToday(time) : words.endsOn(calendarWordsEn.weekdays[end.getDay()] ?? '', time);
}

const columns = 'token, duration, expires_at, can_edit, created_at';

/** The family's live link, or null: none, stopped, or its time is up (a new one replaces it). */
export async function loadGroceryShare(client: Pick<Client, 'from'>, now: Date = new Date()): Promise<GroceryShareLink | null> {
  const { data, error } = await client.from('grocery_share_links').select(columns).is('stopped_at', null).maybeSingle();
  if (error) throw error;
  if (!data || (data.expires_at && Date.parse(data.expires_at) <= now.getTime())) return null;
  return data as GroceryShareLink;
}

/**
 * "Create link": the family's live link, or a new one with this time and switch. `created` says this
 * call made it, for `grocery_share_created`; two members creating at once get one link.
 */
export async function createGroceryShare(
  client: Pick<Client, 'rpc'>,
  duration: ShareDuration,
  canEdit: boolean,
  now: Date = new Date(),
): Promise<GroceryShareLink & { created: boolean }> {
  const { data, error } = await client.rpc('share_groceries', {
    p_duration: duration,
    // A null end is "Until I stop" (the types don't know an argument can be null).
    p_expires_at: expiresAtFor(duration, now)?.toISOString() as string,
    p_can_edit: canEdit,
  });
  if (error) throw error;
  const row = data[0];
  if (!row) throw new Error('No share link');
  return row as GroceryShareLink & { created: boolean };
}

/** A pill or the switch on a live link: applies at once. A new time counts from now. */
export async function setGroceryShareOptions(
  client: Pick<Client, 'from'>,
  token: string,
  options: { duration?: ShareDuration; can_edit?: boolean },
  now: Date = new Date(),
): Promise<Pick<GroceryShareLink, 'expires_at'> | null> {
  const change = options.duration ? { ...options, expires_at: expiresAtFor(options.duration, now)?.toISOString() ?? null } : options;
  const { error } = await client.from('grocery_share_links').update(change).eq('token', token).is('stopped_at', null);
  if (error) throw error;
  return 'expires_at' in change ? { expires_at: change.expires_at ?? null } : null;
}

/** Stops the link for everyone at once (US4). The database stamps when and who. */
export async function stopGroceryShare(client: Pick<Client, 'from'>, token: string): Promise<void> {
  const { error } = await client.from('grocery_share_links').update({ stopped_at: new Date().toISOString() }).eq('token', token).is('stopped_at', null);
  if (error) throw error;
}

const HOUR = 60 * 60 * 1000;

/** `grocery_share_stopped`'s whole hours the link was shared. */
export function hoursActive(createdAt: string, now: number = Date.now()): number {
  return Math.max(0, Math.floor((now - Date.parse(createdAt)) / HOUR));
}

/** Message, Email and More: the system share sheet with "Our grocery list — {link}". */
export function shareGroceryLink(token: string, deps: ShareDeps = systemShare): Promise<ShareOutcome> {
  return shareMessage(strings.groceryShare.shareText(groceryShareUrl(token)), deps);
}
