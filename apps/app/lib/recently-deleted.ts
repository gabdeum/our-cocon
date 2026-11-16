import { useQuery } from '@tanstack/react-query';
import { viewFor } from '@cocon/calendar';
import { loadDeletedEvents, loadDeletedReminders } from '@cocon/data';
import { KEEP_DAYS, deletedRecipesKey, loadDeleted } from './recipe-delete';
import type { Client } from './supabase';

const DAY = 24 * 60 * 60 * 1000;

/** One row of Recently deleted (spec 018; events since 042, reminders since 057). */
export interface DeletedItem {
  kind: 'recipe' | 'event' | 'reminder';
  id: string;
  /** The recipe's name, or the event's or reminder's title. */
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

/** Starts with `reminders`, so a live change to any reminder refetches it (lib/sync.tsx). */
export const deletedRemindersKey = (familyId: string) => ['reminders', familyId, 'deleted'] as const;

/** The reminders deleted in the last 30 days (spec 057, 032-later L147). */
export async function loadDeletedReminderItems(client: Pick<Client, 'from'>, now: Date = new Date()): Promise<DeletedItem[]> {
  const reminders = await loadDeletedReminders(client, new Date(now.getTime() - KEEP_DAYS * DAY).toISOString());
  return reminders.map((x) => ({ kind: 'reminder' as const, id: x.id, name: x.title, deleted_at: x.deleted_at, deleted_by: x.deleted_by }));
}

/** Recipes, events and reminders, newest first. */
export function mergeDeleted(recipes: readonly Omit<DeletedItem, 'kind'>[], ...others: readonly (readonly DeletedItem[])[]): DeletedItem[] {
  return [...recipes.map((r) => ({ ...r, kind: 'recipe' as const })), ...others.flat()].sort((a, b) => Date.parse(b.deleted_at) - Date.parse(a.deleted_at));
}

/** Recently deleted's list, shared by the screen and Settings' count so they agree. */
export function useDeletedItems(client: Pick<Client, 'from'>, familyId: string | null, myMemberId: string | null) {
  const recipes = useQuery({ queryKey: deletedRecipesKey(familyId ?? ''), queryFn: () => loadDeleted(client), enabled: familyId !== null });
  const events = useQuery({
    queryKey: [...deletedEventsKey(familyId ?? ''), myMemberId],
    queryFn: () => loadDeletedEventItems(client, myMemberId ?? ''),
    enabled: familyId !== null && myMemberId !== null,
  });
  const reminders = useQuery({ queryKey: deletedRemindersKey(familyId ?? ''), queryFn: () => loadDeletedReminderItems(client), enabled: familyId !== null });
  const items = recipes.data && events.data && reminders.data ? mergeDeleted(recipes.data, events.data, reminders.data) : undefined;
  return {
    items,
    failed: recipes.isError || events.isError || reminders.isError,
    refetch: () => Promise.all([recipes.refetch(), events.refetch(), reminders.refetch()]),
  };
}
