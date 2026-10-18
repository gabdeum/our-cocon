import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ChangeEvent, familyChannel } from '@cocon/schemas';
import type { Client } from './supabase';
import type { Member } from './session';

type Listener = (change: ChangeEvent) => void;
export type SyncClient = Pick<Client, 'channel' | 'removeChannel' | 'realtime'>;

const SyncContext = createContext<Set<Listener> | null>(null);

/**
 * Live changes for the signed-in family (spec 004 US1). Listens on the family's private channel;
 * each change refetches that table's queries (keys start with the table name, lib/query.ts), so
 * every open screen updates without a refresh. After a reconnect everything is refetched, since
 * changes made meanwhile were not received.
 */
export function SyncProvider({ client, familyId, children }: { client: SyncClient; familyId: string | null; children: ReactNode }) {
  const queryClient = useQueryClient();
  const [listeners] = useState(() => new Set<Listener>());

  useEffect(() => {
    if (!familyId) return;
    let joinedBefore = false;
    let stopped = false;
    const channel = client.channel(familyChannel(familyId), { config: { private: true } });
    channel.on('broadcast', { event: 'change' }, ({ payload }) => {
      const change = ChangeEvent.safeParse(payload);
      if (!change.success) return;
      void queryClient.invalidateQueries({ queryKey: [change.data.table] });
      for (const listener of listeners) listener(change.data);
    });
    // Private channels check the member's token (realtime.messages policy).
    void client.realtime.setAuth().then(() => {
      if (stopped) return;
      channel.subscribe((status) => {
        if (status !== 'SUBSCRIBED') return;
        if (joinedBefore) void queryClient.invalidateQueries();
        joinedBefore = true;
      });
    });
    return () => {
      stopped = true;
      void client.removeChannel(channel);
    };
  }, [client, familyId, queryClient, listeners]);

  return <SyncContext.Provider value={listeners}>{children}</SyncContext.Provider>;
}

/** Calls `listener` for every live change in the family, while mounted. */
export function useChanges(listener: Listener): void {
  const listeners = useContext(SyncContext);
  if (!listeners) throw new Error('useChanges needs a SyncProvider');
  useEffect(() => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, [listeners, listener]);
}

/**
 * Who else just changed this recipe, for "Alex just changed this recipe" with Reload (spec 004
 * edge case: the last save wins, and the other person is told). My own saves are ignored.
 * Recipe screens (008, 014) show it with RecipeChangedBanner.
 */
export function useRecipeChangedBy(recipeId: string | null, me: string, members: readonly Member[]): { by: Member | null; dismiss: () => void } {
  const [byId, setById] = useState<string | null>(null);
  useChanges(
    useCallback(
      (change: ChangeEvent) => {
        if (change.table === 'recipes' && change.op !== 'insert' && change.id === recipeId && change.by && change.by !== me) setById(change.by);
      },
      [recipeId, me],
    ),
  );
  const dismiss = useCallback(() => setById(null), []);
  return { by: members.find((m) => m.user_id === byId) ?? null, dismiss };
}
