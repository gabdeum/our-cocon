import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { BackHeader, BottomSheet, Button, Callout, Card, Dialog, Link, LinkField, ListGroup, ListRow, Overline, PushedScreen, SettingRow, StepText, Text } from '@cocon/ui';
import type { AssistantConnection, AssistantConnections } from '@cocon/data';
import { AiPermission, type AiPermissions, type ConnectionAssistant, type KnownAssistant, type Tracker } from '@cocon/schemas';
import { strings } from '../../strings/en';
import { ASSISTANTS, highlightParts, minutesSince, type AssistantEntry } from '../../lib/assistants';
import { OfflineBanner } from '../sync/OfflineBanner';

const c = strings.aiConnections;
const PERMISSIONS = AiPermission.options;

/** An assistant the Manage sheet acts on: one of the three, or an app the database can't name. */
interface Managed {
  assistant: ConnectionAssistant;
  name: string;
  connection: AssistantConnection;
}

export interface AiConnectionsProps {
  /** Undefined while loading. */
  assistants: AssistantConnections | undefined;
  permissions: AiPermissions | undefined;
  /** The MCP server's address members paste into their assistant: `${mcpUrl}/mcp`. */
  address: string;
  tracker: Tracker;
  failed?: boolean;
  onRetry: () => void;
  onBack: () => void;
  /** Loads the connections again and returns them ("I've done this — check connection"). */
  onCheck: () => Promise<AssistantConnections>;
  onDisconnect: (clientIds: string[]) => Promise<void>;
  onSetPermission: (permission: AiPermission, allowed: boolean) => Promise<void>;
  onCopy: (text: string) => Promise<unknown>;
  /** Offline: readable, nothing can change. */
  readOnly?: boolean;
  list?: readonly AssistantEntry[];
  now?: Date;
}

/**
 * Settings › AI assistants (OC-Connect, spec 025): each assistant with its status and Connect or
 * Manage, what this member's assistants may do (spec 024), and phrases to try.
 */
export function AiConnections({
  assistants,
  permissions,
  address,
  tracker,
  failed,
  onRetry,
  onBack,
  onCheck,
  onDisconnect,
  onSetPermission,
  onCopy,
  readOnly,
  list = ASSISTANTS,
  now = new Date(),
}: AiConnectionsProps) {
  // Kept while the sheet closes (it still shows that assistant); `run` starts each opening afresh.
  const [connect, setConnect] = useState<{ assistant: KnownAssistant | null; open: boolean; run: number }>({ assistant: null, open: false, run: 0 });
  // Kept while the sheet closes, like Connect's.
  const [managing, setManaging] = useState<Managed | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [confirm, setConfirm] = useState<Managed | null>(null);
  const [disconnectFailed, setDisconnectFailed] = useState(false);
  // A switch moves at once; the saved value takes over once it's back.
  const [saving, setSaving] = useState<Partial<AiPermissions>>({});
  const [permissionFailed, setPermissionFailed] = useState(false);
  const ago = (date: Date) => c.timeAgo(minutesSince(date, now));
  const name = (key: KnownAssistant) => strings.assistants[key];

  const openManage = (target: Managed) => {
    setManaging(target);
    setManageOpen(true);
    setDisconnectFailed(false);
  };

  const openConnect = (key: KnownAssistant) => {
    tracker.track('ai_connect_started', { assistant: key });
    setConnect((v) => ({ assistant: key, open: true, run: v.run + 1 }));
  };

  const disconnect = async (target: Managed) => {
    setConfirm(null);
    try {
      await onDisconnect(target.connection.clientIds);
      tracker.track('ai_disconnected', { assistant: target.assistant });
      setManageOpen(false);
    } catch {
      setDisconnectFailed(true);
    }
  };

  const setPermission = async (permission: AiPermission, allowed: boolean) => {
    setSaving((v) => ({ ...v, [permission]: allowed }));
    try {
      await onSetPermission(permission, allowed);
      tracker.track('ai_permission_changed', { permission, allowed });
      setPermissionFailed(false);
    } catch {
      setPermissionFailed(true);
    } finally {
      setSaving(({ [permission]: _done, ...rest }) => rest);
    }
  };

  let rows;
  if (assistants === undefined && failed) {
    rows = (
      <View className="gap-12">
        <Callout variant="warn" text={c.loadFailed} />
        <Button label={c.retry} variant="soft" onPress={onRetry} />
      </View>
    );
  } else if (assistants === undefined) {
    // The rows without their status until it loads.
    rows = (
      <View role="progressbar" aria-label={c.loading}>
        <ListGroup>
          {list.map((a, i) => (
            <ListRow key={a.key} title={name(a.key)} leading={{ kind: 'tile', letters: a.letters, tone: a.tone }} last={i === list.length - 1} />
          ))}
        </ListGroup>
      </View>
    );
  } else {
    const others = assistants.others.map((o, i) => ({ key: `other-${i}`, name: c.otherName(o.name), letters: (o.name ?? '?').slice(0, 1).toUpperCase(), connection: o }));
    const unavailable = list.filter((a) => !a.available);
    rows = (
      <View className="gap-8">
        <ListGroup>
          {list.map((a, i) => {
            const connection = assistants.known[a.key];
            const last = i === list.length - 1 && others.length === 0;
            return (
              <ListRow
                key={a.key}
                title={name(a.key)}
                sub={connection ? c.connected(ago(connection.lastUsed)) : a.available ? c.notConnected : c.notAvailable}
                subTone={connection ? 'olive' : 'muted'}
                leading={{ kind: 'tile', letters: a.letters, tone: a.tone }}
                trailing={
                  connection
                    ? { kind: 'node', node: <Link label={c.manage} tone="quiet" accessibilityLabel={c.manageA11y(name(a.key))} onPress={() => openManage({ assistant: a.key, name: name(a.key), connection })} /> }
                    : a.available
                      ? { kind: 'node', node: <Button label={c.connect} variant="olive" size="sm" accessibilityLabel={c.connectA11y(name(a.key))} disabled={readOnly} onPress={() => openConnect(a.key)} /> }
                      : undefined
                }
                last={last}
              />
            );
          })}
          {others.map((o, i) => (
            <ListRow
              key={o.key}
              title={o.name}
              sub={c.connected(ago(o.connection.lastUsed))}
              subTone="olive"
              leading={{ kind: 'tile', letters: o.letters, tone: 'honey' }}
              trailing={{ kind: 'node', node: <Link label={c.manage} tone="quiet" accessibilityLabel={c.manageA11y(o.name)} onPress={() => openManage({ assistant: 'other', name: o.name, connection: o.connection })} /> }}
              last={i === others.length - 1}
            />
          ))}
        </ListGroup>
        {unavailable.map((a) => (
          <Text key={a.key} variant="caption" color="ink-muted">
            {c.notAvailableNote(name(a.key))}
          </Text>
        ))}
      </View>
    );
  }

  // The Manage sheet's summary; the screen has the switches.
  const permissionSummary = PERMISSIONS.map((p, i) => {
    const allowed = permissions?.[p];
    return (
      <ListRow
        key={p}
        title={c.permissions[p]}
        trailing={allowed === undefined ? undefined : { kind: 'value', text: allowed ? c.allowed : c.notAllowed, tone: allowed ? 'olive' : undefined }}
        last={i === PERMISSIONS.length - 1}
      />
    );
  });

  return (
    <PushedScreen className="gap-16">
      <BackHeader backLabel={c.back} onBack={onBack} title={c.title} lead={c.lead} />
      <OfflineBanner screen="settings" tracker={tracker} />
      {rows}
      <View className="gap-8">
        <Text size={18} weight="900" role="heading">
          {c.permissionsHeading}
        </Text>
        <Text variant="caption" color="ink-muted">
          {c.permissionLead}
        </Text>
        {permissionFailed && !readOnly ? <Callout variant="warn" text={c.permissionFailed} /> : null}
        <ListGroup inset>
          {PERMISSIONS.map((p, i) => (
            <SettingRow
              key={p}
              label={c.permissions[p]}
              value={saving[p] ?? permissions?.[p] ?? true}
              onValueChange={(allowed) => void setPermission(p, allowed)}
              disabled={readOnly || !permissions || saving[p] !== undefined}
              last={i === PERMISSIONS.length - 1}
            />
          ))}
        </ListGroup>
      </View>
      <Card tone="sage">
        <Overline className="text-olive-deep">{c.trySaying}</Overline>
        {c.examples.map((e) => (
          <Text key={e} size={16} weight="800">
            {e}
          </Text>
        ))}
      </Card>

      <ConnectSheet
        key={connect.run}
        assistant={connect.assistant}
        visible={connect.open}
        address={address}
        tracker={tracker}
        onCheck={onCheck}
        onCopy={onCopy}
        onClose={() => setConnect((v) => ({ ...v, open: false }))}
      />

      <BottomSheet visible={manageOpen && managing !== null} onClose={() => setManageOpen(false)} title={managing?.name ?? ''} closeLabel={c.close}>
        {managing ? (
          <View className="gap-14">
            <Text color="ink-muted" weight="700">
              {c.lastUsed(ago(managing.connection.lastUsed))}
            </Text>
            <ListGroup title={c.permissionsHeading}>{permissionSummary}</ListGroup>
            {disconnectFailed ? <Callout variant="warn" text={c.disconnectFailed} /> : null}
            <Button label={c.disconnect} variant="danger" block disabled={readOnly} onPress={() => setConfirm(managing)} />
          </View>
        ) : null}
      </BottomSheet>
      <Dialog
        visible={confirm !== null}
        title={c.disconnectTitle(confirm?.name ?? '')}
        body={c.disconnectBody}
        confirmLabel={c.disconnect}
        onConfirm={() => {
          if (confirm) void disconnect(confirm);
        }}
        cancelLabel={c.cancel}
        onCancel={() => setConfirm(null)}
      />

    </PushedScreen>
  );
}

/** The guided Connect sheet (OC-Connect.md › Connect sheet): steps, the address with Copy, then a check. */
function ConnectSheet({
  assistant,
  visible,
  address,
  tracker,
  onCheck,
  onCopy,
  onClose,
}: {
  assistant: KnownAssistant | null;
  visible: boolean;
  address: string;
  tracker: Tracker;
  onCheck: () => Promise<AssistantConnections>;
  onCopy: (text: string) => Promise<unknown>;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<'connected' | 'notYet' | null>(null);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  const check = async () => {
    if (!assistant) return;
    setChecking(true);
    try {
      const found = (await onCheck()).known[assistant] !== undefined;
      setResult(found ? 'connected' : 'notYet');
      if (found) tracker.track('ai_connected', { assistant });
      else tracker.track('ai_connect_failed', { assistant, step: c.checkStep });
    } catch {
      setResult('notYet');
      tracker.track('ai_connect_failed', { assistant, step: c.checkStep });
    } finally {
      setChecking(false);
    }
  };

  const assistantName = assistant ? strings.assistants[assistant] : '';
  const note = assistant ? c.notes[assistant] : undefined;
  return (
    <BottomSheet
      visible={visible && assistant !== null}
      onClose={onClose}
      title={c.connectTitle(assistantName)}
      closeLabel={c.close}
      footer={
        result === 'connected' ? (
          <Button label={c.close} variant="ink" block onPress={onClose} />
        ) : (
          <Button label={c.check} variant="ink" block busy={checking} busyLabel={c.checking} onPress={() => void check()} />
        )
      }
    >
      {assistant ? (
        <View className="gap-14">
          <View role="list" className="gap-10">
            {c.steps[assistant].map((step, i) => (
              <View key={step} role="listitem" className="flex-row gap-10">
                <Text size={16} weight="900" color="olive-deep">
                  {`${i + 1}.`}
                </Text>
                <View className="min-w-0 flex-1">
                  <StepText parts={highlightParts(step)} />
                </View>
              </View>
            ))}
          </View>
          {note ? (
            <Text variant="caption" color="ink-muted">
              {note}
            </Text>
          ) : null}
          <LinkField
            value={address}
            label={c.addressLabel}
            actionLabel={copied ? c.copied : c.copy}
            onAction={() => void onCopy(address).then(() => setCopied(true))}
          />
          {result === 'connected' ? <Callout variant="info" text={c.connectedResult} /> : null}
          {result === 'notYet' ? <Callout variant="warn" text={c.notYet(c.checkStep)} /> : null}
        </View>
      ) : null}
    </BottomSheet>
  );
}
