import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Button, Callout, Text } from '@cocon/ui';
import type { Tracker } from '@cocon/schemas';
import { strings } from '../../strings/en';
import { completeSignIn, type CallbackParams } from '../../lib/auth';
import type { Client } from '../../lib/supabase';
import { WelcomeHeader } from './WelcomeHeader';

const t = strings.welcome;

export interface AuthCallbackProps {
  auth: Pick<Client['auth'], 'exchangeCodeForSession'>;
  tracker: Tracker;
  params: CallbackParams;
  onSignedIn: (next: string) => void;
  onBackToSignIn: () => void;
}

/** Where the magic link and Google come back to (spec 003; OC-Welcome.md › Link errors). */
export function AuthCallback({ auth, tracker, params, onSignedIn, onBackToSignIn }: AuthCallbackProps) {
  const [failure, setFailure] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    // A code works once, so StrictMode's second run must not use it again.
    if (started.current) return;
    started.current = true;
    void completeSignIn(auth, params).then((result) => {
      if (!result.ok) return setFailure(result.reason === 'other_browser' ? t.linkOtherBrowser : t.linkExpired);
      tracker.track(result.event, { method: result.method });
      onSignedIn(result.next);
    });
  }, [auth, tracker, params, onSignedIn]);

  if (!failure) {
    return (
      <View role="status" aria-live="polite">
        <Text size={16} weight="700" color="ink-muted">
          {t.signingIn}
        </Text>
      </View>
    );
  }
  return (
    <View className="gap-18">
      <WelcomeHeader title={strings.app.name} />
      <Callout variant="warn" text={failure} />
      <Button label={t.backToSignIn} block onPress={onBackToSignIn} />
    </View>
  );
}
