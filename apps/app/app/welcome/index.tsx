import { PushedScreen } from '@cocon/ui';
import { SignIn } from '../../components/account/SignIn';
import { useSession } from '../../lib/session';

/** /welcome: sign in or sign up (spec 003; design/ui/OC-Welcome.md). */
export default function WelcomeRoute() {
  const { client } = useSession();
  return (
    <PushedScreen>
      <SignIn auth={client.auth} />
    </PushedScreen>
  );
}
