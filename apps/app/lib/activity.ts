import { ActivityEntry, KnownAssistant, UndoResult, type ActivityKind, type UndoConflict } from '@cocon/schemas';
import { strings } from '../strings/en';
import { minutesSince } from './assistants';
import { assistantName } from './recipe-format';
import type { Member } from './session';
import type { Client } from './supabase';

/**
 * Spec 026: what AI assistants changed for the family, one entry per tool call (FR-001), and Undo.
 * The database groups, words-free, and undoes (migration ai_activity_undo); this file says it.
 */

/** Starts with `activity`, so a new entry or an undo anywhere in the family refetches it (lib/sync.tsx). */
export const activityKey = (familyId: string, filter: ActivityFilter = {}) => ['activity', familyId, filter.actor ?? null, filter.source ?? null] as const;
export const activityFiltersKey = (familyId: string) => ['activity', familyId, 'filters'] as const;

/** Home shows the latest 2 (FR-002); the list loads 50 at a time. */
export const HOME_ENTRIES = 2;
export const PAGE_SIZE = 50;

export interface ActivityFilter {
  actor?: string | null;
  source?: string | null;
}

export async function loadActivity(client: Pick<Client, 'rpc'>, limit: number, filter: ActivityFilter = {}, before?: string): Promise<ActivityEntry[]> {
  const { data, error } = await client.rpc('activity_entries', {
    p_limit: limit,
    ...(before ? { p_before: before } : {}),
    ...(filter.actor ? { p_actor: filter.actor } : {}),
    ...(filter.source ? { p_source: filter.source } : {}),
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
    sources: [...new Set(data.map((r) => (KnownAssistant.safeParse(r.source).success ? r.source : 'other')))],
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

type Members = readonly Pick<Member, 'user_id' | 'display_name'>[];
const nameOf = (id: string | null, members: Members) => members.find((m) => m.user_id === id)?.display_name ?? strings.recipe.formerMember;

/** "6 items added to Groceries", "New: Pumpkin soup", "New event: Pediatrician". */
export function entryTitle(entry: Pick<ActivityEntry, 'kind' | 'count' | 'names' | 'recipe_name' | 'event_name'>): string {
  const t = strings.activity.title;
  const recipe = entry.recipe_name ?? '';
  const first = entry.names[0] ?? '';
  const kind: ActivityKind = entry.kind;
  switch (kind) {
    case 'recipe_created':
    case 'recipe_edited':
    case 'recipe_deleted':
      return entry.recipe_name ? t[kind](recipe) : t.other(entry.count);
    case 'groceries_added':
    case 'groceries_ticked':
    case 'groceries_unticked':
    case 'groceries_removed':
      return t[kind](entry.count, first);
    case 'groceries_cleared':
      return t.groceries_cleared(entry.count);
    case 'event_created':
    case 'event_edited':
    case 'event_deleted':
      return entry.event_name ? t[kind](entry.event_name) : t.other(entry.count);
    case 'other':
      return t.other(entry.count);
  }
}

export interface EntryView {
  title: string;
  sub: string;
  action: 'undo' | 'restore' | null;
}

/** An entry as ActivityCard shows it (OC-Home › Activity card, States). */
export function describeEntry(entry: ActivityEntry, members: Members, now: Date): EntryView {
  const title = entryTitle(entry);
  if (entry.undone_by || entry.undo_action) {
    const by = nameOf(entry.undone_by, members);
    return { title, sub: entry.undo_action === 'restore' ? strings.activity.restoredBy(by) : strings.activity.undoneBy(by), action: null };
  }
  const assistant = assistantName(entry.source) ?? strings.assistants.other;
  const ago = strings.time.ago(minutesSince(new Date(entry.created_at), now));
  return {
    title,
    sub: strings.activity.sub(strings.activity.by[entry.kind], nameOf(entry.actor_id, members), assistant, ago),
    action: entry.can_restore ? 'restore' : entry.can_undo ? 'undo' : null,
  };
}

/** "Mia ticked 2 of these items. They'll stay as they are." */
export function conflictText(conflicts: readonly UndoConflict[], members: Members): string {
  const c = strings.activity.conflict;
  const lines = conflicts.map((x) => (x.kind === 'gone' ? c.gone(x.count) : c[x.kind](nameOf(x.by, members), x.count)));
  return [...lines, strings.activity.conflictStays].join(' ');
}
