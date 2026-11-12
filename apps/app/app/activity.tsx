import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { ActivityScreen } from '../components/activity/ActivityScreen';
import { activityFiltersKey, activityKey, loadActivity, loadActivityFilters, nextCursor, PAGE_SIZE, undoActivity, type ActivityCursor, type ActivityFilter } from '../lib/activity';
import { useOnline } from '../lib/online';
import { useSession } from '../lib/session';
import { refetchLive } from '../lib/sync';

/** /activity (spec 026 FR-002): every change, from Home's "See all activity" (`?show=ai` for AI only). */
export default function ActivityRoute() {
  const { state, client, tracker } = useSession();
  const online = useOnline();
  const queryClient = useQueryClient();
  const { show } = useLocalSearchParams<{ show?: string }>();
  const [filter, setFilter] = useState<ActivityFilter>({ ai: show === 'ai' });
  const familyId = state.status === 'ready' ? state.family.id : null;
  const list = useInfiniteQuery({
    queryKey: activityKey(familyId ?? '', filter),
    queryFn: ({ pageParam }) => loadActivity(client, PAGE_SIZE, filter, pageParam),
    initialPageParam: undefined as ActivityCursor | undefined,
    getNextPageParam: nextCursor,
    enabled: familyId !== null,
  });
  const filters = useQuery({ queryKey: activityFiltersKey(familyId ?? ''), queryFn: () => loadActivityFilters(client), enabled: familyId !== null });
  if (state.status !== 'ready') return null;
  return (
    <ActivityScreen
      entries={list.data?.pages.flat()}
      members={state.members}
      actors={filters.data?.actors ?? []}
      sources={filters.data?.sources ?? []}
      filter={filter}
      onFilter={setFilter}
      failed={list.isError}
      onRetry={() => void list.refetch()}
      hasMore={list.hasNextPage}
      loadingMore={list.isFetchingNextPage}
      onShowMore={async () => {
        const result = await list.fetchNextPage();
        if (result.isFetchNextPageError) return false;
        tracker.track('activity_show_more', { page: result.data?.pages.length ?? 2 });
        return true;
      }}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      tracker={tracker}
      readOnly={!online}
      onUndo={async (entry, skipChanged) => {
        const outcome = await undoActivity(client, entry.key, skipChanged);
        if (outcome.status === 'done' || outcome.status === 'expired') await refetchLive(queryClient);
        return outcome;
      }}
    />
  );
}
