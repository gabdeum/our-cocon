import { router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RecentlyDeleted } from '../../components/settings/RecentlyDeleted';
import { deleteNow, deletedRecipesKey, loadDeleted, restoreRecipe } from '../../lib/recipe-delete';
import { useOnline } from '../../lib/online';
import { useSession } from '../../lib/session';

/** /settings/deleted (spec 018): Recently deleted, pushed from Settings › More. */
export default function RecentlyDeletedRoute() {
  const { state, client, tracker } = useSession();
  const online = useOnline();
  const queryClient = useQueryClient();
  const familyId = state.status === 'ready' ? state.family.id : null;
  const list = useQuery({
    queryKey: deletedRecipesKey(familyId ?? ''),
    queryFn: () => loadDeleted(client),
    enabled: familyId !== null,
  });
  // Every recipe query starts with ['recipes', family], so the list, Settings' count and this refetch.
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['recipes', familyId] });
  if (state.status !== 'ready') return null;
  return (
    <RecentlyDeleted
      recipes={list.data}
      members={state.members}
      tracker={tracker}
      failed={list.isError}
      onRetry={() => void list.refetch()}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/settings'))}
      onRestore={async (recipe) => {
        await restoreRecipe(client, recipe.id);
        await refresh();
      }}
      onDeleteNow={async (recipe) => {
        await deleteNow(client, state.family.id, recipe.id);
        await refresh();
      }}
      readOnly={!online}
    />
  );
}
