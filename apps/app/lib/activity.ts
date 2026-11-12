import { calendarWordsEn, timeLabel, weekday } from '@cocon/calendar';
import { ActivityEntry, KnownAssistant, memberInitials, UndoResult, type ActivityKind, type UndoConflict } from '@cocon/schemas';
import type { AvatarColor } from '@cocon/ui';
import { strings } from '../strings/en';
import { minutesSince } from './assistants';
import { assistantName } from './recipe-format';
import type { Member } from './session';
import type { Client } from './supabase';

/**
 * Spec 026: what the family and their AI assistants changed, one entry per tool call (FR-001) or app
 * action (spec 028 FR-009), and Undo for an AI change. The database groups, words-free, and undoes
 * (migrations ai_activity_undo, activity_for_everyone); this file says it.
 */

/** Starts with `activity`, so a new entry or an undo anywhere in the family refetches it (lib/sync.tsx). */
export const activityKey = (familyId: string, filter: ActivityFilter = {}) => ['activity', familyId, filter.ai ?? false, filter.actor ?? null, filter.source ?? null] as const;
export const activityFiltersKey = (familyId: string) => ['activity', familyId, 'filters'] as const;

/** Home shows the latest four (spec 028 FR-006); the list loads 20 at a time (spec 053 FR-018). */
export const HOME_ENTRIES = 4;
export const PAGE_SIZE = 20;

/** Where the next page starts: the last entry shown. Entries can share a time, so its key breaks the tie (spec 053 FR-019). */
export interface ActivityCursor {
  at: string;
  key: string;
}

export const nextCursor = (page: readonly ActivityEntry[]): ActivityCursor | undefined => {
  const last = page.at(-1);
  return page.length === PAGE_SIZE && last ? { at: last.created_at, key: last.key } : undefined;
};

export interface ActivityFilter {
  /** "AI only" (spec 028 FR-006); everyone's changes otherwise. */
  ai?: boolean;
  actor?: string | null;
  /** One assistant: only with `ai`. */
  source?: string | null;
}

export async function loadActivity(client: Pick<Client, 'rpc'>, limit: number, filter: ActivityFilter = {}, before?: ActivityCursor): Promise<ActivityEntry[]> {
  const { data, error } = await client.rpc('activity_entries', {
    p_limit: limit,
    ...(before ? { p_before: before.at, p_before_key: before.key } : {}),
    ...(filter.actor ? { p_actor: filter.actor } : {}),
    ...(filter.ai ? { p_source: filter.source ?? 'ai' } : {}),
  });
  if (error) throw error;
  return ActivityEntry.array().parse(data);
}

/** Who and which assistants have entries, for the list's filter pills. */
export async function loadActivityFilters(client: Pick<Client, 'rpc'>): Promise<{ actors: string[]; sources: string[] }> {
  const { data, error } = await client.rpc('activity_filters');
  if (error) throw error;
  return {
    actors: [...new Set(data.flatMap((r) => (r.actor_id ? [r.actor_id] : [])))],
    // Assistants the app can't name share one "Other" pill (OC-Activity).
    sources: [...new Set(data.flatMap((r) => (r.source === 'app' ? [] : [KnownAssistant.safeParse(r.source).success ? r.source : 'other'])))],
  };
}

export type UndoOutcome = { status: 'done'; result: UndoResult } | { status: 'conflicts'; conflicts: UndoConflict[] } | { status: 'nothing' } | { status: 'expired' } | { status: 'failed' };

/**
 * Undo (or Restore) an entry. Without `skipChanged`, anything someone changed since stops it and
 * comes back as conflicts, for "Mia ticked 2 of these items. Undo the rest?".
 */
export async function undoActivity(client: Pick<Client, 'rpc'>, key: string, skipChanged = false): Promise<UndoOutcome> {
  try {
    const { data, error } = await client.rpc('undo_ai_change', { p_key: key, p_skip_changed: skipChanged });
    if (error) return ['expired', 'already_undone', 'not_found'].includes(error.message) ? { status: 'expired' } : { status: 'failed' };
    const result = UndoResult.parse(data);
    if (result.applied) return { status: 'done', result };
    return result.left ? { status: 'conflicts', conflicts: result.conflicts } : { status: 'nothing' };
  } catch {
    return { status: 'failed' };
  }
}

type Members = readonly Pick<Member, 'id' | 'user_id' | 'display_name' | 'color' | 'joined_at'>[];
const nameOf = (id: string | null, members: Members) => members.find((m) => m.user_id === id)?.display_name ?? strings.recipe.formerMember;

/** "Eva added Pumpkin soup", "Gabriel ticked 4 items", "Eva added a private event". */
export function entryTitle(entry: Pick<ActivityEntry, 'kind' | 'count' | 'names' | 'recipe_name' | 'event_name' | 'event_secret'>, who: string): string {
  const t = strings.activity.title;
  const a = strings.activity;
  const recipe = entry.recipe_name ?? a.aRecipe;
  const event = entry.event_name ?? (entry.event_secret ? a.privateEvent : a.anEvent);
  const first = entry.names[0] ?? '';
  const kind: ActivityKind = entry.kind;
  switch (kind) {
    case 'recipe_created':
    case 'recipe_edited':
    case 'recipe_deleted':
    case 'recipe_restored':
      return t[kind](who, recipe);
    case 'groceries_added':
    case 'groceries_ticked':
    case 'groceries_unticked':
    case 'groceries_removed':
      return t[kind](who, entry.count, first);
    case 'groceries_cleared':
      return t.groceries_cleared(who, entry.count);
    case 'event_created':
    case 'event_edited':
    case 'event_deleted':
    case 'event_date_deleted':
      return t[kind](who, event);
    case 'other':
      return t.other(who, entry.count);
  }
}

const moduleOf = (kind: ActivityKind): keyof typeof strings.activity.module | null =>
  kind.startsWith('recipe_') ? 'recipes' : kind.startsWith('groceries_') ? 'groceries' : kind.startsWith('event_') ? 'calendar' : null;

/** "Wed, 10:00": when the entry's event is, as the reader may see it. */
function eventWhen(when: NonNullable<ActivityEntry['event_when']>, use24h: boolean): string {
  return `${calendarWordsEn.weekdaysShort[weekday(when.starts_on)] ?? ''}, ${timeLabel(when, { use24h })}`;
}

export interface EntryView {
  title: string;
  sub: string;
  /** The person's initial in their color, or "AI" in it when their assistant made the change. */
  badge: { kind: 'person'; initial: string; color: AvatarColor } | { kind: 'ai'; label: string; color: AvatarColor };
  action: 'undo' | 'restore' | null;
}

/** An entry as ActivityRow shows it (OC-Home › Latest activity, States). */
export function describeEntry(entry: ActivityEntry, members: Members, now: Date, use24h = true): EntryView {
  const a = strings.activity;
  const member = members.find((m) => m.user_id === entry.actor_id);
  const who = nameOf(entry.actor_id, members);
  const title = entryTitle(entry, who);
  const color: AvatarColor = (member?.color as AvatarColor | undefined) ?? 'removed';
  const ai = entry.source !== 'app';
  const badge: EntryView['badge'] = ai ? { kind: 'ai', label: a.badge, color } : { kind: 'person', initial: (member && memberInitials(members).get(member.id)) ?? who.slice(0, 1), color };
  if (entry.undone_by || entry.undo_action) {
    const by = nameOf(entry.undone_by, members);
    return { title, badge, sub: entry.undo_action === 'restore' ? a.restoredBy(by) : a.undoneBy(by), action: null };
  }
  const module = moduleOf(entry.kind);
  const detail = entry.event_when ? eventWhen(entry.event_when, use24h) : entry.from_recipe_name ? a.fromRecipe(entry.from_recipe_name) : '';
  return {
    title,
    badge,
    sub: a.sub([module ? a.module[module] : '', detail, ai ? a.via(assistantName(entry.source) ?? strings.assistants.other) : '', strings.time.ago(minutesSince(new Date(entry.created_at), now))]),
    action: !ai ? null : entry.can_restore ? 'restore' : entry.can_undo ? 'undo' : null,
  };
}

/** "Mia ticked 2 of these items. They'll stay as they are." */
export function conflictText(conflicts: readonly UndoConflict[], members: Members): string {
  const c = strings.activity.conflict;
  const lines = conflicts.map((x) => (x.kind === 'gone' ? c.gone(x.count) : c[x.kind](nameOf(x.by, members), x.count)));
  return [...lines, strings.activity.conflictStays].join(' ');
}
