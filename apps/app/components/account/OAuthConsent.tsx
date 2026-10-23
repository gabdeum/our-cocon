import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button, Callout, Text } from '@cocon/ui';
import { normalizeText } from '@cocon/schemas';
import { strings } from '../../strings/en';
import type { Client } from '../../lib/supabase';
import { SignIn } from './SignIn';
import { WelcomeHeader } from './WelcomeHeader';

const t = strings.oauthConsent;
const known = strings.assistants;

type OAuthApi = Pick<Client['auth']['oauth'], 'getAuthorizationDetails' | 'approveAuthorization' | 'denyAuthorization'>;

export interface OAuthConsentProps {
  /** From the address Supabase's OAuth server sent the member to. */
  authorizationId: string;
  signedIn: boolean;
  auth: Pick<Client['auth'], 'signInWithOtp' | 'signInWithOAuth'> & { oauth: OAuthApi };
  /**
   * Which assistant a return address belongs to ('claude', 'chatgpt', 'gemini'), or null: the
   * database's rule (`assistant_for_redirect`), the same one that names its writes.
   */
  verify: (redirectUri: string) => Promise<string | null>;
  /** Back to the assistant, with its code or the refusal. */
  onRedirect: (url: string) => void;
}

type Ask = {
  /** The name to show: the proven assistant's, or the one the client gave itself. */
  name: string;
  verified: boolean;
  /** It calls itself a known assistant, but its return address isn't that assistant's. */
  impostor: boolean;
  host: string | null;
};

type State = { kind: 'loading' } | ({ kind: 'ask' } & Ask) | { kind: 'done'; message: string } | { kind: 'expired' };

/** Only the host: where the code goes is what tells a real assistant from one using its name. */
function hostOf(uri: string): string | null {
  try {
    return new URL(uri).host || null;
  } catch {
    return null;
  }
}

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);
const UNSAFE_SCHEMES = new Set(['javascript:', 'data:', 'vbscript:', 'file:', 'blob:', 'about:']);

/**
 * Where it's safe to send the member: https, http only to their own computer (local assistants),
 * or an app's own scheme. Never a scheme that runs in this page (javascript:, data:…).
 */
export function safeRedirect(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol === 'https:') return true;
    if (u.protocol === 'http:') return LOOPBACK.has(u.hostname) || LOOPBACK.has(`[${u.hostname}]`);
    return !UNSAFE_SCHEMES.has(u.protocol) && /^[a-z][a-z0-9+.-]*:$/.test(u.protocol);
  } catch {
    return false;
  }
}

export function describeClient(selfName: string | null | undefined, assistant: string | null, host: string | null): Ask {
  if (assistant && assistant in known) return { name: known[assistant as keyof typeof known], verified: true, impostor: false, host };
  const name = selfName?.trim().slice(0, 60) || t.unnamed;
  const claimed = Object.values(known).some((label) => normalizeText(name).includes(normalizeText(label)));
  return { name, verified: false, impostor: claimed && name !== t.unnamed, host };
}

/**
 * /oauth/consent (spec 023; OC-Connect.md › Approve access): an AI assistant asks to act as this
 * member. Signed out, they sign in first and come back here. Allow sends the assistant its code.
 */
export function OAuthConsent({ authorizationId, signedIn, auth, verify, onRedirect }: OAuthConsentProps) {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [busy, setBusy] = useState<'allow' | 'deny' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const next = `/oauth/consent?authorization_id=${encodeURIComponent(authorizationId)}`;
  // An id that isn't the right shape reads like any other old request.
  const malformed = !/^[A-Za-z0-9_-]{1,128}$/.test(authorizationId);

  useEffect(() => {
    if (!signedIn || malformed) return;
    let live = true;
    void (async () => {
      const { data, error: failed } = await auth.oauth.getAuthorizationDetails(authorizationId);
      if (!live) return;
      if (failed || !data) return setState({ kind: 'expired' });
      // Already allowed before: straight back to the assistant.
      if (!('authorization_id' in data)) return safeRedirect(data.redirect_url) ? onRedirect(data.redirect_url) : setState({ kind: 'expired' });
      const assistant = await verify(data.redirect_uri).catch(() => null);
      if (!live) return;
      setState({ kind: 'ask', ...describeClient(data.client.name, assistant, hostOf(data.redirect_uri)) });
    })();
    return () => {
      live = false;
    };
  }, [auth, authorizationId, signedIn, malformed, verify, onRedirect]);

  if (!signedIn) return <SignIn auth={auth} next={next} title={t.signInTitle} lead={t.signInLead} />;
  if (malformed) return <Callout variant="warn" text={t.expired} />;
  if (state.kind === 'loading') return null;
  if (state.kind === 'expired') return <Callout variant="warn" text={t.expired} />;
  if (state.kind === 'done') return <Callout variant="info" text={state.message} />;

  const { name, verified, impostor, host } = state;
  async function decide(allow: boolean) {
    setBusy(allow ? 'allow' : 'deny');
    setError(null);
    const options = { skipBrowserRedirect: true };
    const { data, error: failed } = allow ? await auth.oauth.approveAuthorization(authorizationId, options) : await auth.oauth.denyAuthorization(authorizationId, options);
    setBusy(null);
    if (failed || !data) return setError(t.failed);
    if (!safeRedirect(data.redirect_url)) return setState({ kind: 'expired' });
    setState({ kind: 'done', message: allow ? t.allowed(name) : t.denied(name) });
    onRedirect(data.redirect_url);
  }

  return (
    <View className="gap-18">
      <WelcomeHeader title={verified ? t.title(name) : t.titleUnverified(name)} lead={t.lead} />
      {impostor && host ? <Callout variant="warn" text={t.notReally(name, host)} /> : null}
      {host ? (
        <Text size={15} weight="700" color="ink-muted">
          {t.sendsBackTo(host)}
        </Text>
      ) : null}
      {error ? <Callout variant="warn" text={error} /> : null}
      <View className="gap-12">
        <Button label={t.allow} block busy={busy === 'allow'} busyLabel={t.allowing} disabled={busy !== null} onPress={() => void decide(true)} />
        <Button label={t.deny} variant="soft" block disabled={busy !== null} onPress={() => void decide(false)} />
      </View>
    </View>
  );
}
