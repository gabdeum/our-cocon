import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { BottomSheet, Button, ColorSwatch, Dialog, Link, ListGroup, ListRow, SheetFooter, StatusBanner, Text, TextField, type SwatchOption } from '@cocon/ui';
import { DisplayName, MEMBER_COLORS, memberInitials, memberKind, nextMemberColor, type MemberColor, type Tracker } from '@cocon/schemas';
import { strings } from '../../strings/en';
import type { FamilyApi } from '../../lib/family';
import type { AccountMember, Family, Member } from '../../lib/session';
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
  /** OC-Settings › More, between Family and Account: its rows (spec 018 Recently deleted, 025 AI assistants). */
  more?: ReactNode;
}

type Confirm =
  | { kind: 'remove' | 'owner'; member: AccountMember }
  | { kind: 'removeManaged'; member: Member; upcoming: number }
  | { kind: 'deleteFamily' }
  | { kind: 'deleteAccount' }
  | null;

/** A name being typed: a new member without the app (with their color), or a rename. */
type NameSheet = { kind: 'add'; name: string; color: MemberColor; warning?: string } | { kind: 'rename'; member: Member; name: string; warning?: string };

function isAccount(m: Member): m is AccountMember {
  return m.user_id !== null;
}

function Heading({ children }: { children: string }) {
  return (
    <Text size={18} weight="900" role="heading" aria-level={2}>
      {children}
    </Text>
  );
}

/**
 * The 8 swatches for `target` (null: someone being added): taken by anyone else, the picked one,
 * or free. The Add sheet lists free ones first (OC-SettingsFamily › Add without app).
 */
function swatches(members: readonly Member[], initials: Map<string, string>, target: Member | null, picked: MemberColor, mine: boolean, freeFirst = false): SwatchOption[] {
  const options = MEMBER_COLORS.map((color): SwatchOption => {
    const name = f.colorNames[color];
    const holder = members.find((m) => m.color === color && m.id !== target?.id);
    if (color === picked) return { color, state: 'selected', initial: target ? initials.get(target.id) : undefined, accessibilityLabel: mine ? f.swatchMine(name) : f.swatchPicked(name) };
    if (holder) return { color, state: 'taken', initial: initials.get(holder.id), accessibilityLabel: f.swatchTaken(name) };
    return { color, state: 'free', accessibilityLabel: f.swatchFree(name) };
  });
  return freeFirst ? [...options.filter((o) => o.state !== 'taken'), ...options.filter((o) => o.state === 'taken')] : options;
}

/** Settings › Family and Account (specs 003 and 033; design/ui/OC-SettingsFamily.md). */
export function FamilySettings({ me, family, members, api, tracker, onChanged, onSignOut, shareDeps, readOnly = false, more }: FamilySettingsProps) {
  const isOwner = me.role === 'owner';
  const initials = memberInitials(members);
  const [banner, setBanner] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [selected, setSelected] = useState<Member | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [nameWarning, setNameWarning] = useState<string | undefined>();
  const [savingName, setSavingName] = useState(false);
  const [nameSheet, setNameSheet] = useState<NameSheet | null>(null);
  const [savingSheet, setSavingSheet] = useState(false);
  const [recoloring, setRecoloring] = useState<Member | null>(null);

  const managed = (m: Member) => memberKind(m) === 'managed';
  const roleLabel = (m: Member) => (managed(m) ? f.noAccount : m.role === 'owner' ? f.owner : f.editor);
  const subLine = (m: Member) => {
    if (!managed(m)) return f.hasApp;
    const by = members.find((x) => x.id === m.managed_by);
    return by ? f.addedBy(by.display_name) : f.addedByFormer;
  };

  async function invite(forMember?: Member) {
    setBanner(null);
    setSelected(null);
    setInviting(true);
    const token = await api.createInvite(forMember?.id);
    if (!token.ok) {
      setInviting(false);
      return setBanner(token.error === 'rate_limited' ? f.inviteRateLimited : f.inviteFailed);
    }
    const outcome = await shareInvite(token.data, family.name, shareDeps, forMember?.display_name);
    setInviting(false);
    if (outcome === 'dismissed') return;
    tracker.track('invite_sent', {});
    if (outcome === 'copied') setBanner(f.inviteCopied);
  }

  /** Their upcoming events move to Everyone, so the dialog says how many first (032-later L78). */
  async function confirmRemoveManaged(member: Member) {
    const upcoming = await api.managedMemberUpcomingEvents(member.id);
    if (!upcoming.ok) {
      setSelected(null);
      return setBanner(f.actionFailed);
    }
    setConfirm({ kind: 'removeManaged', member, upcoming: upcoming.data });
  }

  async function run(action: () => Promise<{ ok: boolean }>, after?: () => void) {
    setConfirm(null);
    setSelected(null);
    const result = await action();
    if (!result.ok) return setBanner(f.actionFailed);
    after?.();
    await onChanged();
  }

  async function setColor(member: Member, color: MemberColor) {
    if (color === member.color) return;
    setBanner(null);
    setRecoloring(null);
    const result = await api.setMemberColor(member.id, color);
    if (!result.ok) return setBanner(result.error === 'color_taken' ? f.colorTaken : f.actionFailed);
    tracker.track('member_color_changed', { color });
    await onChanged();
  }

  function startAdd() {
    setBanner(null);
    setNameSheet({ kind: 'add', name: '', color: nextMemberColor(members.map((m) => m.color)) });
  }

  async function saveNameSheet() {
    if (!nameSheet) return;
    const name = DisplayName.safeParse(nameSheet.name);
    if (!name.success) return setNameSheet({ ...nameSheet, warning: f.nameMissing });
    setSavingSheet(true);
    // Past 8 members every color is taken: the database picks the next one round the palette.
    const free = !members.some((m) => nameSheet.kind === 'add' && m.color === nameSheet.color);
    const result =
      nameSheet.kind === 'add'
        ? await api.addManagedMember(name.data, free ? nameSheet.color : undefined)
        : await api.renameManagedMember(nameSheet.member.id, name.data);
    setSavingSheet(false);
    if (!result.ok) return setNameSheet({ ...nameSheet, warning: result.error === 'color_taken' ? f.colorTaken : f.actionFailed });
    if (nameSheet.kind === 'add') tracker.track('member_added_without_app', {});
    setNameSheet(null);
    await onChanged();
  }

  function confirmed() {
    if (!confirm) return;
    switch (confirm.kind) {
      case 'remove':
        return void run(() => api.removeMember(confirm.member.user_id), () => tracker.track('member_removed', {}));
      case 'removeManaged':
        return void run(() => api.removeManagedMember(confirm.member.id), () => tracker.track('member_removed', {}));
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
      case 'removeManaged':
        return {
          icon: 'trash' as const,
          title: confirm.upcoming > 0 ? f.removeManagedMoveTitle(confirm.member.display_name, confirm.upcoming) : f.removeManagedTitle(confirm.member.display_name),
          body: confirm.upcoming > 0 ? f.removeManagedMoveBody : f.removeManagedBody,
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

  const nameSheetDirty = nameSheet !== null && (nameSheet.kind === 'add' ? nameSheet.name.trim() !== '' : nameSheet.name !== nameSheet.member.display_name);

  return (
    <>
      <View className="gap-8">
        <Heading>{f.heading}</Heading>
        <ListGroup>
          {members.map((m, i) => {
            // Members without the app: anyone can manage them. Account members: only the owner,
            // and never their own row (edge case: hand over first).
            const manageable = !readOnly && (managed(m) || (isOwner && m.id !== me.id));
            return (
              <ListRow
                key={m.id}
                title={m.display_name}
                sub={subLine(m)}
                leading={{ kind: 'avatar', initial: initials.get(m.id) ?? '?', color: m.color }}
                trailing={{ kind: 'status', text: roleLabel(m) }}
                accessibilityLabel={f.memberLabel(m.display_name, subLine(m), roleLabel(m))}
                onPress={manageable ? () => setSelected(m) : undefined}
                last={i === members.length - 1}
              />
            );
          })}
        </ListGroup>
        <View className="flex-row gap-8">
          <Button
            label={f.invite}
            variant="dashed"
            icon="plus"
            className="flex-1"
            busy={inviting}
            busyLabel={f.inviting}
            disabled={readOnly}
            onPress={() => void invite()}
          />
          <Button label={f.addWithoutApp} variant="dashed" icon="plus" className="flex-1" disabled={readOnly} onPress={startAdd} />
        </View>
        <Text size={14} weight="600" color="ink-muted">
          {f.withoutAppHint}
        </Text>
        {/* Never stack two banners: offline, the offline banner replaces this one. */}
        {banner && !readOnly ? <StatusBanner message={banner} /> : null}
      </View>

      <View className="gap-8">
        <Heading>{f.myColor}</Heading>
        <Text size={14} weight="600" color="ink-muted">
          {f.myColorLead}
        </Text>
        <ColorSwatch label={f.myColor} options={swatches(members, initials, me, me.color, true)} disabled={readOnly} onSelect={(c) => void setColor(me, c)} />
      </View>

      {more ? (
        <View className="gap-8">
          <Heading>{strings.settings.more.heading}</Heading>
          <ListGroup>{more}</ListGroup>
        </View>
      ) : null}

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
        {selected && managed(selected) ? (
          <View className="gap-10">
            <Button label={f.rename} variant="outline" block onPress={() => (setSelected(null), setNameSheet({ kind: 'rename', member: selected, name: selected.display_name }))} />
            <Button label={f.changeColor} variant="outline" block onPress={() => (setSelected(null), setRecoloring(selected))} />
            <Button label={f.inviteManaged(selected.display_name)} variant="outline" block onPress={() => void invite(selected)} />
            <Link label={f.removeManaged} tone="danger" onPress={() => void confirmRemoveManaged(selected)} />
          </View>
        ) : selected && isAccount(selected) ? (
          <View className="gap-10">
            <Button label={f.makeOwner} variant="outline" block onPress={() => setConfirm({ kind: 'owner', member: selected })} />
            <Link label={f.remove} tone="danger" onPress={() => setConfirm({ kind: 'remove', member: selected })} />
          </View>
        ) : null}
      </BottomSheet>

      <BottomSheet
        visible={nameSheet !== null}
        onClose={() => setNameSheet(null)}
        title={nameSheet?.kind === 'add' ? f.addTitle : f.rename}
        closeLabel={f.cancel}
        dirty={nameSheetDirty}
        footer={
          nameSheet?.kind === 'rename' ? (
            <SheetFooter
              cancel={{ label: f.cancel, onPress: () => setNameSheet(null) }}
              primary={{ label: f.save, busy: savingSheet, busyLabel: f.saving, onPress: () => void saveNameSheet() }}
            />
          ) : (
            <Button label={f.add} block busy={savingSheet} busyLabel={f.adding} onPress={() => void saveNameSheet()} />
          )
        }
      >
        {nameSheet ? (
          <View className="gap-14">
            {nameSheet.kind === 'add' ? (
              <Text size={15} weight="600" color="ink-muted">
                {f.addLead}
              </Text>
            ) : null}
            <TextField
              label={f.nameLabel}
              warning={nameSheet.warning}
              value={nameSheet.name}
              maxLength={40}
              onChangeText={(v) => setNameSheet({ ...nameSheet, name: v, warning: undefined })}
            />
            {nameSheet.kind === 'add' ? (
              <View className="gap-8">
                <Text size={15} weight="800">
                  {f.colorLabel}
                </Text>
                <ColorSwatch
                  label={f.colorLabel}
                  options={swatches(members, initials, null, nameSheet.color, false, true)}
                  onSelect={(color) => setNameSheet({ ...nameSheet, color })}
                />
              </View>
            ) : null}
          </View>
        ) : null}
      </BottomSheet>

      <BottomSheet visible={recoloring !== null} onClose={() => setRecoloring(null)} title={f.changeColor} closeLabel={f.close}>
        {recoloring ? (
          <ColorSwatch label={f.changeColor} options={swatches(members, initials, recoloring, recoloring.color, false)} onSelect={(c) => void setColor(recoloring, c)} />
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

      {dialog ? <Dialog visible {...dialog} onConfirm={confirmed} onCancel={() => setConfirm(null)} /> : null}
    </>
  );
}
