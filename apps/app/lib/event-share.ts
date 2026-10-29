import { CalendarDate } from '@cocon/schemas/calendar';
import { strings } from '../strings/en';
import { appUrl } from './links';
import { shareMessage, systemShare, type ShareDeps, type ShareOutcome } from './system-share';
import type { Client } from './supabase';

/** One event date's view-only link (spec 042 FR-005): `/e/<token>`. */
export function eventShareUrl(token: string) {
  return appUrl(`/e/${token}`);
}

export interface EventShareLink {
  token: string;
  created_at: string;
}

/**
 * The event date's active link, made now if it has none (the sheet makes it on open). `created`
 * says this call made it, for `event_shared`. The database refuses a private or surprise event.
 */
export async function openEventShareLink(client: Pick<Client, 'rpc'>, eventId: string, date: string): Promise<EventShareLink & { created: boolean }> {
  const { data, error } = await client.rpc('share_event', { p_event_id: eventId, p_date: CalendarDate.parse(date) });
  if (error) throw error;
  const row = data[0];
  if (!row) throw new Error('No share link');
  return row;
}

/** Stops the link for everyone at once. The database stamps when and who. */
export async function stopEventShareLink(client: Pick<Client, 'from'>, token: string): Promise<void> {
  const { error } = await client.from('event_share_links').update({ stopped_at: new Date().toISOString() }).eq('token', token).is('stopped_at', null);
  if (error) throw error;
}

/** Message, Email and More: the system share sheet with "{title} — {link}". */
export function shareEventLink(title: string, token: string, deps: ShareDeps = systemShare): Promise<ShareOutcome> {
  return shareMessage(strings.share.shareText(title, eventShareUrl(token)), deps);
}
