import { useCallback, useMemo } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { PushedScreen } from '@cocon/ui';
import { AuthCallback } from '../../components/account/AuthCallback';
import type { CallbackParams } from '../../lib/auth';
import { useSession } from '../../lib/session';

function one(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

/** /auth/callback: the magic link and Google come back here (spec 003). */
export default function CallbackRoute() {
  const { client, tracker } = useSession();
  const raw = useLocalSearchParams();
  const code = one(raw.code);
  const errorCode = one(raw.error_code);
  const error = one(raw.error);
  const next = one(raw.next);
  const params = useMemo<CallbackParams>(() => ({ code, error_code: errorCode, error, next }), [code, errorCode, error, next]);
  const onSignedIn = useCallback((to: string) => router.replace(to as never), []);
  return (
    <PushedScreen>
      <AuthCallback auth={client.auth} tracker={tracker} params={params} onSignedIn={onSignedIn} onBackToSignIn={() => router.replace('/welcome')} />
    </PushedScreen>
  );
}
