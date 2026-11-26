import { useEffect, useMemo, useRef } from 'react';
import { useLocalSearchParams } from 'expo-router';
import Head from 'expo-router/head';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SharedGroceries } from '../../components/shared/SharedGroceries';
import { device24h } from '../../lib/calendar-prefs';
import {
  loadSharedGroceries,
  PING_MS,
  POLL_MS,
  sharedAdd,
  sharedGroceriesKey,
  sharedGroceriesTopic,
  writeSharedGroceries,
  type SharedGroceriesLoad,
  type SharedWrite,
} from '../../lib/shared-groceries';
import { supabase } from '../../lib/supabase';
import { anonymousTracker, config } from '../../lib/tracker';

/** /g/[token] (spec 072): the family's grocery list, live, for anyone with the link. */
export default function SharedGroceriesRoute() {
  const { token = '' } = useLocalSearchParams<{ token: string }>();
  const queryClient = useQueryClient();
  const endpoint = useMemo(() => ({ supabaseUrl: config.supabaseUrl, anonKey: config.supabaseAnonKey }), []);
  const key = sharedGroceriesKey(token);
  const shared = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => loadSharedGroceries(token, endpoint, signal),
    staleTime: 0,
    retry: 1,
    refetchInterval: (query) => (query.state.data?.kind === 'not_shared' ? false : POLL_MS),
  });

  // FR-006: the database pings the link's public topic on every change; the page refetches. A
  // public channel: a guest has no session, and the topic is as secret as the link.
  // Pings within a second make one refetch: a recipe's 20 items, or anyone else on the topic.
  const pending = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    const channel = supabase
      .channel(sharedGroceriesTopic(token))
      .on('broadcast', { event: 'change' }, () => {
        if (pending.current) return;
        pending.current = setTimeout(() => {
          pending.current = undefined;
          void queryClient.invalidateQueries({ queryKey: key });
        }, PING_MS);
      })
      .subscribe();
    return () => {
      clearTimeout(pending.current);
      pending.current = undefined;
      void supabase.removeChannel(channel);
    };
    // `key` is derived from `token`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient, token]);

  /** A write, shown at once where it can be, then the list as the database has it. */
  const write = async (change: SharedWrite) => {
    if (change.op !== 'add') {
      queryClient.setQueryData<SharedGroceriesLoad>(key, (current) => {
        if (current?.kind !== 'shared') return current;
        const ids = new Set(change.ids);
        const items =
          change.op === 'check'
            ? current.list.items.map((i) => (ids.has(i.id) ? { ...i, checked: change.checked } : i))
            : change.op === 'clear'
              ? current.list.items.filter((i) => !ids.has(i.id))
              : current.list.items;
        return { kind: 'shared', list: { ...current.list, items } };
      });
    }
    const result = await writeSharedGroceries(token, change, endpoint);
    await queryClient.invalidateQueries({ queryKey: key });
    return result;
  };

  const load = shared.data ?? (shared.isError ? 'failed' : undefined);
  return (
    <>
      <Head>
        <meta name="robots" content="noindex" />
      </Head>
      <SharedGroceries
        load={load}
        tracker={anonymousTracker}
        use24h={device24h()}
        onRetry={() => void shared.refetch()}
        onAdd={async (text) => {
          const add = sharedAdd(text);
          return add ? write(add) : 'empty';
        }}
        onToggle={(ids, checked) => write({ op: 'check', ids, checked })}
        onClear={(ids) => write({ op: 'clear', ids })}
        onRestore={(ids) => write({ op: 'restore', ids })}
      />
    </>
  );
}
