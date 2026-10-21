import { strings } from '../strings/en';
import { appUrl } from './links';
import { shareMessage, systemShare, type ShareDeps, type ShareOutcome } from './system-share';
import type { Client } from './supabase';

/** A recipe's view-only link (spec 019 FR-001): `/r/<token>`. */
export function shareLinkUrl(token: string) {
  return appUrl(`/r/${token}`);
}

export interface ShareLink {
  token: string;
  include_variants: boolean;
  include_tips: boolean;
  created_at: string;
}

/**
 * The recipe's active link, made now if it has none (the sheet makes it on open). `created`
 * says this call made it, for `share_link_created`; two people opening the sheet get one link.
 */
export async function openShareLink(client: Pick<Client, 'rpc'>, recipeId: string): Promise<ShareLink & { created: boolean }> {
  const { data, error } = await client.rpc('share_recipe', { p_recipe_id: recipeId });
  if (error) throw error;
  const row = data[0];
  if (!row) throw new Error('No share link');
  return row;
}

/** Stops the link for everyone at once (US3). The database stamps when and who. */
export async function stopShareLink(client: Pick<Client, 'from'>, recipeId: string, token: string): Promise<void> {
  const { error } = await client.from('share_links').update({ stopped_at: new Date().toISOString() }).eq('recipe_id', recipeId).eq('token', token).is('stopped_at', null);
  if (error) throw error;
}

/** "Include variants" and "Include chef's tips": they apply to the live link at once. */
export async function setShareOptions(
  client: Pick<Client, 'from'>,
  token: string,
  options: Partial<Pick<ShareLink, 'include_variants' | 'include_tips'>>,
): Promise<void> {
  const { error } = await client.from('share_links').update(options).eq('token', token).is('stopped_at', null);
  if (error) throw error;
}

const DAY = 24 * 60 * 60 * 1000;

/** `share_link_stopped`'s whole days the link was shared. */
export function daysActive(createdAt: string, now: number = Date.now()): number {
  return Math.max(0, Math.floor((now - Date.parse(createdAt)) / DAY));
}

/** Message, Email and More: the system share sheet with "{recipe name} — {link}". */
export function shareRecipeLink(name: string, token: string, deps: ShareDeps = systemShare): Promise<ShareOutcome> {
  return shareMessage(strings.share.shareText(name, shareLinkUrl(token)), deps);
}
