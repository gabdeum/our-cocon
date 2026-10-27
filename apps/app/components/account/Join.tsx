import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Button, Callout, Dialog, Text, TextField } from '@cocon/ui';
import { DisplayName, InviteToken, type InviteStatus, type Tracker } from '@cocon/schemas';
import { strings } from '../../strings/en';
import type { FamilyApi } from '../../lib/family';
import type { Client } from '../../lib/supabase';
import { SignIn } from './SignIn';
import { WelcomeHeader } from './WelcomeHeader';

const t = strings.join;

/** Who opened the link. */
export type JoinViewer =
  | { kind: 'signedOut' }
  | { kind: 'signedIn'; name: string; ownFamily: { name: string; memberCount: number } | null };

export interface JoinProps {
  token: string;
  viewer: JoinViewer;
  api: Pick<FamilyApi, 'inviteStatus' | 'acceptInvite'>;
  auth: Pick<Client['auth'], 'signInWithOtp' | 'signInWithOAuth'>;
  tracker: Tracker;
  /** Joined (or already in this family): reload the session and go Home. */
  onJoined: () => void | Promise<void>;
  onOpenApp: () => void;
}

/** /join/[token] (spec 003 User Story 2; OC-Welcome.md › Join). */
export function Join({ token, viewer, api, auth, tracker, onJoined, onOpenApp }: JoinProps) {
  const malformed = !InviteToken.safeParse(token).success;
  const [fetched, setInvite] = useState<InviteStatus | null>(null);
  // A token that isn't the right shape reads like any other old link.
  const invite: InviteStatus | null = malformed ? { status: 'expired' } : fetched;
  const [blocked, setBlocked] = useState(false);
  const [name, setName] = useState(viewer.kind === 'signedIn' ? viewer.name : '');
  const [warning, setWarning] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const expiredSeen = useRef(false);

  useEffect(() => {
    if (malformed) return;
    void api.inviteStatus(token).then((r) => setInvite(r.ok ? r.data : { status: 'expired' }));
  }, [api, token, malformed]);

  const expired = invite?.status === 'expired';
  useEffect(() => {
    if (expired && !expiredSeen.current) {
      expiredSeen.current = true;
      tracker.track('invite_expired_seen', {});
    }
  }, [expired, tracker]);

  if (!invite) return null;

  if (invite.status === 'expired') {
    return (
      <View className="gap-18">
        <WelcomeHeader title={strings.app.name} />
        <Callout variant="warn" text={t.expired} />
        <Button label={t.openApp} block onPress={onOpenApp} />
      </View>
    );
  }

  const family = invite.family_name;
  if (viewer.kind === 'signedOut') {
    return <SignIn auth={auth} next={`/join/${token}`} title={t.title(family)} lead={t.lead(invite.inviter_name)} />;
  }

  const own = viewer.ownFamily;
  const hasMembers = blocked || (own !== null && own.memberCount > 1);

  // A link for a member without the app (spec 033 FR-006): they join as that member, name included.
  const asMember = invite.member_name;

  async function accept(replaceOwnFamily: boolean) {
    const me = DisplayName.safeParse(asMember ?? name);
    if (!me.success) return setWarning(strings.welcome.yourNameMissing);
    if (own && !replaceOwnFamily) return setConfirming(true);
    setConfirming(false);
    setBusy(true);
    const result = await api.acceptInvite(token, me.data, replaceOwnFamily);
    if (result.ok) {
      tracker.track('invite_accepted', { days_since_sent: result.data.days_since_sent });
      if (result.data.days_since_added !== undefined) tracker.track('managed_member_linked', { days_since_added: result.data.days_since_added });
      return onJoined();
    }
    setBusy(false);
    if (result.error === 'already_in_this_family') return onJoined();
    if (result.error === 'invite_expired') return setInvite({ status: 'expired' });
    if (result.error === 'own_family_has_members') return setBlocked(true);
    setError(strings.welcome.saveFailed);
  }

  return (
    <View className="gap-18">
      <WelcomeHeader title={t.title(family)} lead={t.lead(invite.inviter_name)} />
      {hasMembers ? (
        <>
          <Callout variant="warn" text={t.hasMembers} />
          <Button label={t.openApp} block onPress={onOpenApp} />
        </>
      ) : (
        <>
          {error ? <Callout variant="warn" text={error} /> : null}
          {asMember ? (
            <Text size={16} weight="700">
              {t.asMemberLead(asMember)}
            </Text>
          ) : (
            <TextField
              label={strings.welcome.yourName}
              hint={strings.welcome.yourNameHint}
              warning={warning}
              value={name}
              maxLength={40}
              autoComplete="given-name"
              onChangeText={(v) => {
                setName(v);
                setWarning(undefined);
              }}
            />
          )}
          <Button label={asMember ? t.joinAs(asMember) : t.join(family)} block busy={busy} busyLabel={t.joining} onPress={() => void accept(false)} />
        </>
      )}
      {own ? (
        <Dialog
          visible={confirming}
          icon="warning"
          title={t.replaceTitle(own.name, family)}
          body={t.replaceBody(own.name)}
          confirmLabel={t.join(family)}
          onConfirm={() => void accept(true)}
          cancelLabel={t.keepMine}
          onCancel={() => setConfirming(false)}
        />
      ) : null}
    </View>
  );
}
