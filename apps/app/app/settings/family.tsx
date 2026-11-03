import { router, type Href } from 'expo-router';
import { FamilyPage } from '../../components/settings/FamilySettings';
import { useOnline } from '../../lib/online';
import { useSession } from '../../lib/session';

/** /settings/family (spec 029, OC-SettingsFamily): members, my color and my account, pushed from the Menu. */
export default function FamilyRoute() {
  const { state, api, tracker, refresh, signOut } = useSession();
  const online = useOnline();
  if (state.status !== 'ready') return null;
  return (
    <FamilyPage
      me={state.me}
      family={state.family}
      members={state.members}
      api={api}
      tracker={tracker}
      onChanged={refresh}
      onSignOut={signOut}
      readOnly={!online}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/menu' as Href))}
    />
  );
}
