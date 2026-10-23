import { useCallback } from 'react';
import { Linking, Platform } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { PushedScreen } from '@cocon/ui';
import { OAuthConsent } from '../../components/account/OAuthConsent';
import { useSession } from '../../lib/session';

/** /oauth/consent: Supabase's OAuth server sends a member here when an AI assistant connects (spec 023). */
export default function OAuthConsentRoute() {
  const { authorization_id } = useLocalSearchParams<{ authorization_id?: string }>();
  const { state, client } = useSession();
  // Back to the assistant in this tab (the web), or in the browser it came from (the iPhone).
  const onRedirect = useCallback((url: string) => {
    if (Platform.OS === 'web') window.location.assign(url);
    else void Linking.openURL(url);
  }, []);
  const verify = useCallback(
    async (uri: string) => {
      const { data } = await client.rpc('assistant_for_redirect', { uri });
      return data ?? null;
    },
    [client],
  );
  if (state.status === 'loading') return null;
  return (
    <PushedScreen>
      <OAuthConsent authorizationId={authorization_id ?? ''} signedIn={state.status !== 'signedOut'} auth={client.auth} verify={verify} onRedirect={onRedirect} />
    </PushedScreen>
  );
}
