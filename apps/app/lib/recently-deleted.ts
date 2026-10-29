import { useQuery } from '@tanstack/react-query';
import { viewFor } from '@cocon/calendar';
import { loadDeletedEvents } from '@cocon/data';
import { KEEP_DAYS, deletedRecipesKey, loadDeleted } from './recipe-delete';
import type { Client } from './supabase';

const DAY = 24 * 60 * 60 * 1000;

/** One row of Recently deleted (spec 018; events since 042): a recipe or an event. */
export interface DeletedItem {
  kind: 'recipe' | 'event';
  id: string;
  /** The recipe's name or the event's title. */
  name: string;
  deleted_at: string;
  deleted_by: string | null;
}

/** Starts with `events`, so a live change to any event refetches it (lib/sync.tsx). */
export const deletedEventsKey = (familyId: string) => ['events', familyId, 'deleted'] as const;

/** The events deleted in the last 30 days that this member sees in full (not "Busy"). */
export async function loadDeletedEventItems(client: Pick<Client, 'from'>, myMemberId: string, now: Date = new Date()): Promise<DeletedItem[]> {
  const events = await loadDeletedEvents(client, new Date(now.getTime() - KEEP_DAYS * DAY).toISOString());
  return events.flatMap((e) =>
    e.deleted_at && viewFor(e, myMemberId).view === 'full' ? [{ kind: 'event' as const, id: e.id, name: e.title, deleted_at: e.deleted_at, deleted_by: e.deleted_by ?? null }] : [],
  );
}

/** Recipes and events, newest first. */
export function mergeDeleted(recipes: readonly Omit<DeletedItem, 'kind'>[], events: readonly DeletedItem[]): DeletedItem[] {
  return [...recipes.map((r) => ({ ...r, kind: 'recipe' as const })), ...events].sort((a, b) => Date.parse(b.deleted_at) - Date.parse(a.deleted_at));
}

/** Recently deleted's list, shared by the screen and Settings' count so they agree. */
export function useDeletedItems(client: Pick<Client, 'from'>, familyId: string | null, myMemberId: string | null) {
  const recipes = useQuery({ queryKey: deletedRecipesKey(familyId ?? ''), queryFn: () => loadDeleted(client), enabled: familyId !== null });
  const events = useQuery({
    queryKey: [...deletedEventsKey(familyId ?? ''), myMemberId],
    queryFn: () => loadDeletedEventItems(client, myMemberId ?? ''),
    enabled: familyId !== null && myMemberId !== null,
  });
  const items = recipes.data && events.data ? mergeDeleted(recipes.data, events.data) : undefined;
  return {
    items,
    failed: recipes.isError || events.isError,
    refetch: () => Promise.all([recipes.refetch(), events.refetch()]),
  };
}
