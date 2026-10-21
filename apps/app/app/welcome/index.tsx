import { useLocalSearchParams } from 'expo-router';
import { PushedScreen } from '@cocon/ui';
import { SignIn } from '../../components/account/SignIn';
import { safeNext } from '../../lib/links';
import { useSession } from '../../lib/session';

/**
 * /welcome: sign in or sign up (spec 003; design/ui/OC-Welcome.md). `?next=` comes back to a page
 * after signing in: "Save to my Our Cocon" on a shared recipe (spec 019).
 */
export default function WelcomeRoute() {
  const { client } = useSession();
  const { next } = useLocalSearchParams<{ next?: string }>();
  const back = safeNext(next);
  return (
    <PushedScreen>
      <SignIn auth={client.auth} next={back === '/' ? undefined : back} />
    </PushedScreen>
  );
}
