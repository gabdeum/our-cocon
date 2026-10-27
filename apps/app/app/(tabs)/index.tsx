import { router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { TabHeader, TabScreen } from '@cocon/ui';
import { ActivitySection } from '../../components/activity/ActivitySection';
import { DebugFooter } from '../../components/DebugFooter';
import { OfflineBanner } from '../../components/sync/OfflineBanner';
import { activityKey, HOME_ENTRIES, loadActivity, undoActivity } from '../../lib/activity';
import { useOnline } from '../../lib/online';
import { useSession } from '../../lib/session';
import { config } from '../../lib/tracker';
import { strings } from '../../strings/en';

/** Home (OC-Home). Spec 026 adds its activity card; spec 028 builds the rest around it. */
export default function HomeTab() {
  const { state, client, tracker } = useSession();
  const online = useOnline();
  const queryClient = useQueryClient();
  const familyId = state.status === 'ready' ? state.family.id : null;
  const activity = useQuery({
    queryKey: [...activityKey(familyId ?? ''), 'home'],
    queryFn: () => loadActivity(client, HOME_ENTRIES),
    enabled: familyId !== null,
  });
  return (
    <TabScreen>
      <TabHeader title={strings.tabBar.home} />
      <OfflineBanner screen="home" tracker={tracker} />
      {state.status === 'ready' ? (
        <ActivitySection
          entries={activity.data ?? []}
          members={state.members}
          tracker={tracker}
          readOnly={!online}
          onUndo={async (entry, skipChanged) => {
            const outcome = await undoActivity(client, entry.key, skipChanged);
            // What it put back is in other tables too (recipes, the grocery list).
            if (outcome.status === 'done' || outcome.status === 'expired') await queryClient.invalidateQueries();
            return outcome;
          }}
          onSeeAll={() => router.push('/activity')}
        />
      ) : null}
      <DebugFooter config={config} />
    </TabScreen>
  );
}
