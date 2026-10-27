import type { CalendarEvent, Occurrence } from './types';
import { en } from './words.en';

/** Fields anyone in the family may see: who, which day, what time, how it repeats. */
const PUBLIC_KEYS = [
  'id',
  'starts_on',
  'ends_on',
  'time_type',
  'slots',
  'start_time',
  'end_time',
  'recurrence',
  'members',
  'visibility',
  'creator_member_id',
  'occurrence_date',
  'is_exception',
] as const;

type PublicFields = Pick<CalendarEvent, Extract<(typeof PUBLIC_KEYS)[number], keyof CalendarEvent>> & Partial<Pick<Occurrence, 'occurrence_date' | 'is_exception'>>;

/** A private event seen by someone else, or a surprise seen by someone it's hidden from. */
export type HiddenView = PublicFields & {
  view: 'busy' | 'cover';
  title: string;
  location: string | null;
  notes: string | null;
  is_surprise: false;
};

/** Everything, plus `is_surprise` for the "Surprise" tag shown to the people who are in on it. */
export type FullView<T extends CalendarEvent> = T & { view: 'full'; is_surprise: boolean };

export type Viewed<T extends CalendarEvent> = FullView<T> | HiddenView;

function publicFields(event: CalendarEvent): PublicFields {
  const source = event as unknown as Record<string, unknown>;
  return Object.fromEntries(PUBLIC_KEYS.filter((key) => key in source).map((key) => [key, source[key]])) as PublicFields;
}

/**
 * FR-009: the only place that decides what a member sees of an event (the database enforces the
 * same rule, spec 035). Private: others get "Busy" with the members, day and time, and nothing
 * else. Surprise: the people it's hidden from get the cover title, the time, the place and the
 * cover note. Hidden views are built from an allowlist, so no other field (checklist, category,
 * who takes them, anything a caller adds) can reach them. A surprise without its cover data is
 * shown to others as "Busy", and so is a hidden event when the viewer or creator is unknown.
 */
export function viewFor<T extends CalendarEvent>(event: T, viewerMemberId: string): Viewed<T> {
  if (event.visibility !== 'family' && (!viewerMemberId || !event.creator_member_id)) return busy(event);
  if (event.creator_member_id === viewerMemberId || event.visibility === 'family') return { ...event, view: 'full', is_surprise: event.visibility === 'surprise' };
  const cover = event.visibility === 'surprise' ? event.surprise : null;
  if (cover && !cover.hidden_from.includes(viewerMemberId)) return { ...event, view: 'full', is_surprise: true };
  // The cover reads as a family event: "surprise" would give the secret away.
  if (cover) return { ...publicFields(event), visibility: 'family', view: 'cover', title: cover.cover_title, location: event.location ?? null, notes: cover.cover_note ?? null, is_surprise: false };
  return busy(event);
}

function busy(event: CalendarEvent): HiddenView {
  return { ...publicFields(event), view: 'busy', title: en.busy, location: null, notes: null, is_surprise: false };
}
