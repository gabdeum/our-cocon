import { TabHeader, TabScreen } from '@cocon/ui';
import { FamilySettings } from '../../components/settings/FamilySettings';
import { DebugFooter } from '../../components/DebugFooter';
import { config } from '../../lib/tracker';
import { useSession } from '../../lib/session';
import { strings } from '../../strings/en';

/** /settings. Spec 003 builds Family and Account; 021, 025, 027, 018 and 029 add the rest. */
export default function SettingsTab() {
  const { state, api, tracker, refresh, signOut } = useSession();
  return (
    <TabScreen>
      <TabHeader title={strings.settings.title} />
      {state.status === 'ready' ? (
        <FamilySettings me={state.me} family={state.family} members={state.members} api={api} tracker={tracker} onChanged={refresh} onSignOut={signOut} />
      ) : null}
      <DebugFooter config={config} />
    </TabScreen>
  );
}
