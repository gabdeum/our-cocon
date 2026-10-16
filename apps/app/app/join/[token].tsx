import { router, useLocalSearchParams } from 'expo-router';
import { PushedScreen } from '@cocon/ui';
import { Join, type JoinViewer } from '../../components/account/Join';
import { useSession } from '../../lib/session';

/** /join/[token]: an invite link (spec 003 User Story 2). */
export default function JoinRoute() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { state, client, api, tracker, refresh } = useSession();
  if (state.status === 'loading') return null;
  const viewer: JoinViewer =
    state.status === 'signedOut'
      ? { kind: 'signedOut' }
      : state.status === 'noFamily'
        ? { kind: 'signedIn', name: state.suggestedName, ownFamily: null }
        : { kind: 'signedIn', name: state.me.display_name, ownFamily: { name: state.family.name, memberCount: state.members.length } };
  return (
    <PushedScreen>
      <Join
        token={token}
        viewer={viewer}
        api={api}
        auth={client.auth}
        tracker={tracker}
        onJoined={async () => {
          await refresh();
          router.replace('/');
        }}
        onOpenApp={() => router.replace('/')}
      />
    </PushedScreen>
  );
}
