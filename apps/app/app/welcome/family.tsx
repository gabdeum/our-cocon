import { router } from 'expo-router';
import { PushedScreen } from '@cocon/ui';
import { FamilySetup } from '../../components/account/FamilySetup';
import { useSession } from '../../lib/session';

/** /welcome/family: name the family after a first sign-in (spec 003 User Story 1). */
export default function FamilyRoute() {
  const { state, api, tracker, refresh } = useSession();
  if (state.status !== 'noFamily') return null;
  return (
    <PushedScreen>
      <FamilySetup
        api={api}
        tracker={tracker}
        suggestedName={state.suggestedName}
        onCreated={async () => {
          await refresh();
          router.replace('/');
        }}
      />
    </PushedScreen>
  );
}
