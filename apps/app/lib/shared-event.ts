import { DEFAULT_SLOT_TIMES, occurrenceOn } from '@cocon/calendar';
import { SharedEventResponse, ShareToken } from '@cocon/schemas';
import { strings } from '../strings/en';
import { whenLines } from './event-detail';
import type { SharedEndpoint } from './shared-recipe';

const e = strings.calendar.event;

/** What the shared event page shows (spec 042 FR-005): no notes, checklist or ids reach it. */
export interface SharedEventView {
  title: string;
  when: { title: string; sub: string };
  place: string | null;
  /** "With James, Eva and others"; null when nobody is named. */
  with: string | null;
}

export type SharedEventLoad = { kind: 'shared'; event: SharedEventView } | { kind: 'not_shared' };

/** The page's query key. Not under `events`, so family changes never touch it. */
export const sharedEventKey = (token: string) => ['shared-event', token] as const;

/**
 * The shared date as the page says it: the event's day with that date's change, worked out by
 * @cocon/calendar as the family's calendar does. Null when the date can't be placed.
 */
export function sharedEventView(r: SharedEventResponse): SharedEventView | null {
  const event = {
    id: 'shared',
    ...r.event,
    start_time: r.event.start_time ?? null,
    end_time: r.event.end_time ?? null,
    recurrence: r.event.recurrence ?? null,
    location: r.event.location ?? null,
    members: [],
    visibility: 'family' as const,
    creator_member_id: '',
  };
  let o;
  try {
    o = occurrenceOn(event, r.occurrence_date, r.exception ? [r.exception] : []);
  } catch {
    return null;
  }
  if (!o) return null;
  const names = r.who.map((w) => (w === 'everyone' ? e.withEveryone : w === 'others' ? e.withOthers : w));
  return { title: o.title, when: whenLines(o, r.slot_times ?? DEFAULT_SLOT_TIMES), place: o.location ?? null, with: names.length ? e.with(names) : null };
}

/**
 * A shared event date from the share endpoint, signed out. "Not shared" for a bad, stopped, ended
 * or deleted link (all the same to the viewer); throws when the endpoint can't be reached, so the
 * page can offer to try again.
 */
export async function loadSharedEvent(token: string, { supabaseUrl, anonKey, fetch: get = fetch }: SharedEndpoint): Promise<SharedEventLoad> {
  if (!ShareToken.safeParse(token).success) return { kind: 'not_shared' };
  const base = supabaseUrl.replace(/\/+$/, '');
  const res = await get(`${base}/functions/v1/shared-event?token=${encodeURIComponent(token)}`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
  });
  if (res.status === 404) return { kind: 'not_shared' };
  if (!res.ok) throw new Error(`Share endpoint answered ${res.status}`);
  const parsed = SharedEventResponse.safeParse(await res.json());
  if (!parsed.success) throw new Error('Unexpected shared event');
  // A date the event no longer has (its repeat changed since) reads like a stopped link.
  const view = sharedEventView(parsed.data);
  return view ? { kind: 'shared', event: view } : { kind: 'not_shared' };
}
