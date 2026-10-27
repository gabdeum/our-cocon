import { useState } from 'react';
import { router } from 'expo-router';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { ActivityScreen } from '../components/activity/ActivityScreen';
import { activityFiltersKey, activityKey, loadActivity, loadActivityFilters, PAGE_SIZE, undoActivity, type ActivityFilter } from '../lib/activity';
import { useOnline } from '../lib/online';
import { useSession } from '../lib/session';

/** /activity (spec 026 FR-002): every AI change, from Home's "See all". */
export default function ActivityRoute() {
  const { state, client, tracker } = useSession();
  const online = useOnline();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<ActivityFilter>({});
  const familyId = state.status === 'ready' ? state.family.id : null;
  const list = useInfiniteQuery({
    queryKey: activityKey(familyId ?? '', filter),
    queryFn: ({ pageParam }) => loadActivity(client, PAGE_SIZE, filter, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => (last.length === PAGE_SIZE ? last[last.length - 1]?.created_at : undefined),
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
      onShowMore={() => void list.fetchNextPage()}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      tracker={tracker}
      readOnly={!online}
      onUndo={async (entry, skipChanged) => {
        const outcome = await undoActivity(client, entry.key, skipChanged);
        if (outcome.status === 'done' || outcome.status === 'expired') await queryClient.invalidateQueries();
        return outcome;
      }}
    />
  );
}
