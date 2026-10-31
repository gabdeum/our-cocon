import { useCallback, useMemo } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { PushedScreen } from '@cocon/ui';
import { AuthCallback } from '../../components/account/AuthCallback';
import type { CallbackParams } from '../../lib/auth';
import { useSession } from '../../lib/session';

function one(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

/**
 * /auth/callback: Google on the web and email links sent before spec 045 come back here with a
 * code. /auth/confirm (the same page) takes the email link's one-time token, in any browser or in
 * the iPhone app. A token is taken here too, for a web tab still running an older version.
 */
export default function CallbackRoute() {
  const { client, tracker } = useSession();
  const raw = useLocalSearchParams();
  const code = one(raw.code);
  const tokenHash = one(raw.token_hash);
  const type = one(raw.type);
  const errorCode = one(raw.error_code);
  const error = one(raw.error);
  const next = one(raw.next);
  const params = useMemo<CallbackParams>(
    () => ({ code, token_hash: tokenHash, type, error_code: errorCode, error, next }),
    [code, tokenHash, type, errorCode, error, next],
  );
  const onSignedIn = useCallback((to: string) => router.replace(to as never), []);
  return (
    <PushedScreen>
      <AuthCallback auth={client.auth} tracker={tracker} params={params} onSignedIn={onSignedIn} onBackToSignIn={() => router.replace('/welcome')} />
    </PushedScreen>
  );
}
