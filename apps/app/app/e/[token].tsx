import { useLocalSearchParams } from 'expo-router';
import Head from 'expo-router/head';
import { useQuery } from '@tanstack/react-query';
import { SharedEvent } from '../../components/shared/SharedEvent';
import { loadSharedEvent, sharedEventKey } from '../../lib/shared-event';
import { config } from '../../lib/tracker';

/** /e/[token] (spec 042 FR-005): one shared event date, view only, for anyone with the link. Sends no analytics. */
export default function SharedEventRoute() {
  const { token = '' } = useLocalSearchParams<{ token: string }>();
  const shared = useQuery({
    queryKey: sharedEventKey(token),
    queryFn: () => loadSharedEvent(token, { supabaseUrl: config.supabaseUrl, anonKey: config.supabaseAnonKey }),
    staleTime: 0,
    retry: 1,
  });
  const load = shared.data ?? (shared.isError ? 'failed' : undefined);
  const title = shared.data?.kind === 'shared' ? shared.data.event.title : null;
  return (
    <>
      <Head>
        <meta name="robots" content="noindex" />
        {title ? <title>{`${title} · Our Cocon`}</title> : null}
      </Head>
      <SharedEvent load={load} onRetry={() => void shared.refetch()} />
    </>
  );
}
