import { useState } from 'react';
import { View } from 'react-native';
import { Button, Callout, Link, StatusBanner, Text, TextField } from '@cocon/ui';
import { strings } from '../../strings/en';
import { sendMagicLink, signInWithProvider, type SendLinkResult } from '../../lib/auth';
import type { Client } from '../../lib/supabase';
import { WelcomeHeader } from './WelcomeHeader';

const t = strings.welcome;

const sendError: Record<Exclude<SendLinkResult, { ok: true }>['reason'], string> = {
  invalid_email: t.invalidEmail,
  rate_limited: t.rateLimited,
  failed: t.sendFailed,
};

export interface SignInProps {
  auth: Pick<Client['auth'], 'signInWithOtp' | 'signInWithOAuth'>;
  /** Where to land after signing in (an invite page). */
  next?: string;
  title?: string;
  lead?: string;
}

/** Sign in or sign up, with Google or a magic link (spec 003 FR-001; OC-Welcome.md › Sign in). */
export function SignIn({ auth, next, title = t.title, lead = t.lead }: SignInProps) {
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resent, setResent] = useState(false);

  async function send(again = false) {
    setBusy(true);
    const result = await sendMagicLink(auth, sentTo ?? email, next);
    setBusy(false);
    if (result.ok) {
      setSentTo(result.email);
      setWarning(undefined);
      setError(null);
      setResent(again);
    } else if (result.reason === 'invalid_email') {
      setWarning(t.invalidEmail);
    } else {
      setError(sendError[result.reason]);
    }
  }

  async function google() {
    setError(null);
    const { ok } = await signInWithProvider(auth, 'google', next);
    if (!ok) setError(t.googleFailed);
  }

  if (sentTo) {
    return (
      <View className="gap-18">
        <WelcomeHeader title={t.checkTitle} lead={t.checkBody(sentTo)} />
        {error ? <Callout variant="warn" text={error} /> : null}
        <Button label={t.sendAgain} variant="outline" block busy={busy} busyLabel={t.sending} onPress={() => void send(true)} />
        {resent ? <StatusBanner message={t.sentAgain} /> : null}
        <Link
          label={t.differentEmail}
          onPress={() => {
            setSentTo(null);
            setResent(false);
            setError(null);
          }}
        />
      </View>
    );
  }

  return (
    <View className="gap-18">
      <WelcomeHeader title={title} lead={lead} />
      {error ? <Callout variant="warn" text={error} /> : null}
      <Button label={t.google} variant="outline" brand="google" block onPress={() => void google()} />
      <Text size={15} weight="700" color="ink-muted" align="center">
        {t.or}
      </Text>
      <TextField
        label={t.emailLabel}
        hint={t.emailHint}
        warning={warning}
        value={email}
        onChangeText={(v) => {
          setEmail(v);
          setWarning(undefined);
        }}
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        autoCorrect={false}
        onSubmitEditing={() => void send()}
      />
      <Button label={t.sendLink} block busy={busy} busyLabel={t.sending} onPress={() => void send()} />
    </View>
  );
}
