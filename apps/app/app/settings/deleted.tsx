import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { deleteEventNow, restoreEvent } from '@cocon/data';
import { RecentlyDeleted } from '../../components/settings/RecentlyDeleted';
import { deleteNow, restoreRecipe } from '../../lib/recipe-delete';
import { useDeletedItems } from '../../lib/recently-deleted';
import { useOnline } from '../../lib/online';
import { useSession } from '../../lib/session';

/** /settings/deleted (spec 018; events since 042): Recently deleted, pushed from Settings › More. */
export default function RecentlyDeletedRoute() {
  const { state, client, tracker } = useSession();
  const online = useOnline();
  const queryClient = useQueryClient();
  const familyId = state.status === 'ready' ? state.family.id : null;
  const myMemberId = state.status === 'ready' ? (state.members.find((m) => m.user_id === state.userId)?.id ?? state.me.id) : null;
  const list = useDeletedItems(client, familyId, myMemberId);
  // Every recipe and event query starts with [table, family], so the lists, the calendar and Settings' count refetch.
  const refresh = (kind: 'recipe' | 'event') => queryClient.invalidateQueries({ queryKey: [kind === 'recipe' ? 'recipes' : 'events', familyId] });
  if (state.status !== 'ready') return null;
  return (
    <RecentlyDeleted
      items={list.items}
      members={state.members}
      tracker={tracker}
      failed={list.failed}
      onRetry={() => void list.refetch()}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/settings'))}
      onRestore={async (item) => {
        await (item.kind === 'recipe' ? restoreRecipe(client, item.id) : restoreEvent(client, item.id));
        await refresh(item.kind);
      }}
      onDeleteNow={async (item) => {
        await (item.kind === 'recipe' ? deleteNow(client, state.family.id, item.id) : deleteEventNow(client, item.id));
        await refresh(item.kind);
      }}
      readOnly={!online}
    />
  );
}
