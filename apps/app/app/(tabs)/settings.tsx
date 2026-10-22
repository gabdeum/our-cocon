import { router, type Href } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ListRow, TabHeader, TabScreen } from '@cocon/ui';
import { FamilySettings } from '../../components/settings/FamilySettings';
import { GrocerySettings } from '../../components/settings/GrocerySettings';
import { DebugFooter } from '../../components/DebugFooter';
import { OfflineBanner } from '../../components/sync/OfflineBanner';
import { useOnline } from '../../lib/online';
import { useFamilySettings } from '../../lib/family-settings';
import { deletedRecipesKey, loadDeleted } from '../../lib/recipe-delete';
import { config } from '../../lib/tracker';
import { useSession } from '../../lib/session';
import { strings } from '../../strings/en';

/** /settings. Spec 003 builds Family and Account, 018 the Recently deleted row, 021 Groceries; 025, 027 and 029 add the rest. */
export default function SettingsTab() {
  const { state, api, client, tracker, refresh, signOut } = useSession();
  const online = useOnline();
  const familyId = state.status === 'ready' ? state.family.id : null;
  // The same query as Recently deleted, so the count and the list agree.
  const deleted = useQuery({ queryKey: deletedRecipesKey(familyId ?? ''), queryFn: () => loadDeleted(client), enabled: familyId !== null });
  const more = strings.settings.more;
  const familySettings = useFamilySettings();
  return (
    <TabScreen>
      <TabHeader title={strings.settings.title} />
      <OfflineBanner screen="settings" tracker={tracker} />
      {state.status === 'ready' ? <GrocerySettings settings={familySettings.settings} onChange={familySettings.change} readOnly={!online} /> : null}
      {state.status === 'ready' ? (
        <FamilySettings
          me={state.me}
          family={state.family}
          members={state.members}
          api={api}
          tracker={tracker}
          onChanged={refresh}
          onSignOut={signOut}
          readOnly={!online}
          more={
            <ListRow
              title={more.recentlyDeleted}
              trailing={{ kind: 'chevron', text: deleted.data ? more.recipes(deleted.data.length) : undefined }}
              onPress={() => router.push('/settings/deleted' as Href)}
              last
            />
          }
        />
      ) : null}
      <DebugFooter config={config} />
    </TabScreen>
  );
}
