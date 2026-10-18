import { useState } from 'react';
import { View } from 'react-native';
import { BottomSheet, Button, Dialog, Link, ListGroup, ListRow, SheetFooter, StatusBanner, Text, TextField } from '@cocon/ui';
import { DisplayName, type Tracker } from '@cocon/schemas';
import { strings } from '../../strings/en';
import type { FamilyApi } from '../../lib/family';
import type { Family, Member } from '../../lib/session';
import { shareInvite, type ShareDeps } from '../../lib/invite';

const f = strings.settings.family;
const a = strings.settings.account;

export interface FamilySettingsProps {
  me: Member;
  family: Family;
  members: Member[];
  api: Omit<FamilyApi, 'createFamily' | 'inviteStatus' | 'acceptInvite'>;
  tracker: Tracker;
  /** Reload the family after a change. */
  onChanged: () => void | Promise<void>;
  onSignOut: () => void | Promise<void>;
  shareDeps?: ShareDeps;
  /** Offline (spec 004): everything stays readable, changes are disabled. Sign out still works. */
  readOnly?: boolean;
}

type Confirm = { kind: 'remove' | 'owner'; member: Member } | { kind: 'deleteFamily' } | { kind: 'deleteAccount' } | null;

function Heading({ children }: { children: string }) {
  return (
    <Text size={18} weight="900" role="heading" aria-level={2}>
      {children}
    </Text>
  );
}

function initial(name: string) {
  return (Array.from(name.trim())[0] ?? '?').toUpperCase();
}

/** Settings › Family and Account (spec 003; design/ui/OC-Settings.md). */
export function FamilySettings({ me, family, members, api, tracker, onChanged, onSignOut, shareDeps, readOnly = false }: FamilySettingsProps) {
  const isOwner = me.role === 'owner';
  const [banner, setBanner] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [selected, setSelected] = useState<Member | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [nameWarning, setNameWarning] = useState<string | undefined>();
  const [savingName, setSavingName] = useState(false);

  const roleLabel = (m: Member) => (m.role === 'owner' ? f.owner : f.editor);

  async function invite() {
    setBanner(null);
    setInviting(true);
    const token = await api.createInvite();
    if (!token.ok) {
      setInviting(false);
      return setBanner(token.error === 'rate_limited' ? f.inviteRateLimited : f.inviteFailed);
    }
    const outcome = await shareInvite(token.data, family.name, shareDeps);
    setInviting(false);
    if (outcome === 'dismissed') return;
    tracker.track('invite_sent', {});
    if (outcome === 'copied') setBanner(f.inviteCopied);
  }

  async function run(action: () => Promise<{ ok: boolean }>, after?: () => void) {
    setConfirm(null);
    setSelected(null);
    const result = await action();
    if (!result.ok) return setBanner(f.actionFailed);
    after?.();
    await onChanged();
  }

  function confirmed() {
    if (!confirm) return;
    switch (confirm.kind) {
      case 'remove':
        return void run(() => api.removeMember(confirm.member.user_id), () => tracker.track('member_removed', {}));
      case 'owner':
        return void run(() => api.makeOwner(confirm.member.user_id));
      case 'deleteFamily':
        return void (async () => {
          setConfirm(null);
          const result = await api.deleteFamily();
          if (!result.ok) return setBanner(a.failed);
          tracker.track('family_deleted', { member_count: result.data });
          await onChanged();
        })();
      case 'deleteAccount':
        return void (async () => {
          setConfirm(null);
          const result = await api.deleteMyAccount();
          if (!result.ok) return setBanner(a.failed);
          await onSignOut();
        })();
    }
  }

  async function saveName() {
    const name = DisplayName.safeParse(editingName ?? '');
    if (!name.success) return setNameWarning(strings.welcome.yourNameMissing);
    setSavingName(true);
    const result = await api.setDisplayName(name.data);
    setSavingName(false);
    if (!result.ok) return setNameWarning(a.failed);
    setEditingName(null);
    await onChanged();
  }

  const dialog = (() => {
    switch (confirm?.kind) {
      case 'remove':
        return {
          icon: 'trash' as const,
          title: f.removeTitle(confirm.member.display_name),
          body: f.removeBody,
          confirmLabel: f.removeConfirm,
          cancelLabel: f.removeCancel(confirm.member.display_name),
        };
      case 'owner':
        return { icon: 'warning' as const, title: f.ownerTitle(confirm.member.display_name), body: f.ownerBody, confirmLabel: f.ownerConfirm, cancelLabel: f.ownerCancel };
      case 'deleteFamily':
        return { icon: 'trash' as const, title: a.deleteFamilyTitle(family.name), body: a.deleteFamilyBody(members.length), confirmLabel: a.deleteFamilyConfirm, cancelLabel: a.keep };
      case 'deleteAccount':
        return { icon: 'trash' as const, title: a.deleteAccountTitle, body: a.deleteAccountBody(family.name), confirmLabel: a.deleteAccountConfirm, cancelLabel: a.keep };
      default:
        return null;
    }
  })();

  return (
    <>
      <View className="gap-8">
        <Heading>{f.heading}</Heading>
        <ListGroup>
          {members.map((m, i) => {
            // Only the owner manages members, and never their own row (edge case: hand over first).
            const manageable = !readOnly && isOwner && m.user_id !== me.user_id;
            return (
              <ListRow
                key={m.user_id}
                title={m.display_name}
                leading={{ kind: 'avatar', initial: initial(m.display_name), tone: m.avatar_tone }}
                trailing={{ kind: 'status', text: roleLabel(m) }}
                accessibilityLabel={f.memberLabel(m.display_name, roleLabel(m))}
                onPress={manageable ? () => setSelected(m) : undefined}
                last={i === members.length - 1}
              />
            );
          })}
        </ListGroup>
        <Button label={f.invite} variant="dashed" icon="plus" block busy={inviting} busyLabel={f.inviting} disabled={readOnly} onPress={() => void invite()} />
        {banner ? <StatusBanner message={banner} /> : null}
      </View>

      <View className="gap-8">
        <Heading>{a.heading}</Heading>
        <ListGroup>
          <ListRow
            title={a.yourName}
            trailing={{ kind: 'value', text: me.display_name }}
            onPress={
              readOnly
                ? undefined
                : () => {
                    setNameWarning(undefined);
                    setEditingName(me.display_name);
                  }
            }
            last
          />
        </ListGroup>
        <Link label={a.signOut} onPress={() => void onSignOut()} />
        <Link
          label={isOwner ? a.deleteFamily : a.deleteAccount}
          tone="danger"
          disabled={readOnly}
          onPress={() => setConfirm({ kind: isOwner ? 'deleteFamily' : 'deleteAccount' })}
        />
      </View>

      <BottomSheet visible={selected !== null} onClose={() => setSelected(null)} title={selected?.display_name ?? ''} closeLabel={f.close}>
        {selected ? (
          <View className="gap-10">
            <Button label={f.makeOwner} variant="outline" block onPress={() => setConfirm({ kind: 'owner', member: selected })} />
            <Link label={f.remove} tone="danger" onPress={() => setConfirm({ kind: 'remove', member: selected })} />
          </View>
        ) : null}
      </BottomSheet>

      <BottomSheet
        visible={editingName !== null}
        onClose={() => setEditingName(null)}
        title={a.yourName}
        closeLabel={a.nameCancel}
        dirty={editingName !== null && editingName !== me.display_name}
        footer={
          <SheetFooter
            cancel={{ label: a.nameCancel, onPress: () => setEditingName(null) }}
            primary={{ label: a.nameSave, busy: savingName, busyLabel: a.nameSaving, onPress: () => void saveName() }}
          />
        }
      >
        <TextField
          label={a.yourName}
          hint={strings.welcome.yourNameHint}
          warning={nameWarning}
          value={editingName ?? ''}
          maxLength={40}
          onChangeText={(v) => {
            setEditingName(v);
            setNameWarning(undefined);
          }}
        />
      </BottomSheet>

      {dialog ? (
        <Dialog visible {...dialog} onConfirm={confirmed} onCancel={() => setConfirm(null)} />
      ) : null}
    </>
  );
}
