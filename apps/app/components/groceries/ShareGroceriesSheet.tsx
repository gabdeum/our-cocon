import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { BottomSheet, Button, Callout, Card, Dialog, Link, LinkField, Overline, Pill, PillRow, SettingRow, ShareTile, Text } from '@cocon/ui';
import type { ShareDuration, Tracker } from '@cocon/schemas';
import { strings } from '../../strings';
import { useFailureToast, useToast } from '../../lib/toast';
import { endsText, groceryShareUrl, hoursActive, type GroceryShareLink } from '../../lib/grocery-share';
import { COPIED_MS } from '../recipes/ShareSheet';

const s = strings.groceryShare;
const DURATIONS: readonly ShareDuration[] = ['1h', 'today', 'week', 'none'];

export interface ShareGroceriesApi {
  /** The family's live link, or null. */
  load: () => Promise<GroceryShareLink | null>;
  /** "Create link": the live link, or a new one with this time and switch. */
  create: (duration: ShareDuration, canEdit: boolean) => Promise<GroceryShareLink & { created: boolean }>;
  /** A change on the live link; a new time comes back with its end. */
  setOptions: (token: string, options: { duration?: ShareDuration; can_edit?: boolean }) => Promise<Pick<GroceryShareLink, 'expires_at'> | null>;
  stop: (token: string) => Promise<void>;
  copy: (text: string) => Promise<unknown>;
  /** The system share sheet with "Our grocery list — {link}". */
  share: (token: string) => Promise<unknown>;
}

export interface ShareGroceriesSheetProps {
  api: ShareGroceriesApi;
  /** The list as plain text (lib/groceries.ts › listText), null with nothing to buy. */
  listText: string | null;
  tracker: Tracker;
  use24h: boolean;
  onClose: () => void;
}

type LinkState = { kind: 'loading' } | { kind: 'none' } | { kind: 'creating' } | { kind: 'failed' } | { kind: 'shared'; link: GroceryShareLink };

/** Share the grocery list by link, for a while, or copy it as text (spec 072; design/ui/OC-ShareGroceries.md). */
export function ShareGroceriesSheet({ api, listText, tracker, use24h, onClose }: ShareGroceriesSheetProps) {
  const [state, setState] = useState<LinkState>({ kind: 'loading' });
  const [duration, setDuration] = useState<ShareDuration>('today');
  const [canEdit, setCanEdit] = useState(true);
  const [copied, setCopied] = useState(false);
  const [confirmStop, setConfirmStop] = useState(false);
  const toast = useToast();
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(copiedTimer.current), []);

  // A live link shows as it is; without one, "Create link" makes it (`attempt` loads again after a failure).
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    api.load().then(
      (link) => {
        if (!live) return;
        if (link) {
          setDuration(link.duration);
          setCanEdit(link.can_edit);
        }
        setState(link ? { kind: 'shared', link } : { kind: 'none' });
      },
      () => {
        if (live) setState({ kind: 'failed' });
      },
    );
    return () => {
      live = false;
    };
  }, [api, attempt]);

  const link = state.kind === 'shared' ? state.link : null;
  const url = link ? groceryShareUrl(link.token) : null;

  const create = async () => {
    setState({ kind: 'creating' });
    try {
      const { created, ...made } = await api.create(duration, canEdit);
      if (created) tracker.track('grocery_share_created', { duration, can_edit: canEdit });
      setDuration(made.duration);
      setCanEdit(made.can_edit);
      setState({ kind: 'shared', link: made });
    } catch {
      setState({ kind: 'failed' });
    }
  };
  const retry = () => {
    setState({ kind: 'loading' });
    setAttempt((n) => n + 1);
  };

  const copyLink = async () => {
    if (!url) return;
    await api.copy(url);
    setCopied(true);
    toast.show({ text: s.copiedBanner });
    clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), COPIED_MS);
  };

  const copyText = async () => {
    if (!listText) {
      toast.show({ text: s.nothingToCopy });
      return;
    }
    await api.copy(listText);
    tracker.track('grocery_list_copied', {});
    toast.show({ text: s.textCopied });
  };

  /** Before a link: only what "Create link" will use. On a live link: applied at once, put back on failure. */
  const change = async (options: { duration?: ShareDuration; can_edit?: boolean }) => {
    if (options.duration) setDuration(options.duration);
    if (options.can_edit !== undefined) setCanEdit(options.can_edit);
    if (!link) return;
    try {
      const ends = await api.setOptions(link.token, options);
      setState({ kind: 'shared', link: { ...link, ...options, ...(ends ?? {}) } });
      tracker.track('grocery_share_changed', options);
    } catch {
      setDuration(link.duration);
      setCanEdit(link.can_edit);
      toast.show({ text: s.changeFailed, tone: 'warn' });
    }
  };

  const stop = async () => {
    setConfirmStop(false);
    if (!link) return;
    try {
      await api.stop(link.token);
      tracker.track('grocery_share_stopped', { hours_active: hoursActive(link.created_at) });
      setState({ kind: 'none' });
      setCopied(false);
      toast.hide();
    } catch {
      toast.show({ text: s.changeFailed, tone: 'warn' });
    }
  };

  // Failures are warn toasts (spec 053 FR-015).
  useFailureToast(state.kind === 'failed' && s.failed, retry);

  const field = state.kind === 'shared' ? (url ?? '') : state.kind === 'creating' || state.kind === 'loading' ? s.creating : s.notShared;
  const ends = link ? (endsText(link.expires_at, { endsToday: s.endsToday, endsOn: s.endsOn }, use24h) ?? s.untilStopped) : null;
  const busy = state.kind === 'loading' || state.kind === 'creating';

  return (
    <>
      <BottomSheet visible title={s.title} closeLabel={s.close} onClose={onClose} closeButton>
        <Callout variant="info" icon="view-only" text={s.info(canEdit)} />

        <View className="gap-8">
          <Overline>{s.howLong}</Overline>
          <PillRow>
            {DURATIONS.map((d) => (
              <Pill key={d} label={s.durations[d]} selected={duration === d} disabled={busy} onPress={() => void change({ duration: d })} />
            ))}
          </PillRow>
        </View>

        <Card className="gap-0 px-16 py-4">
          <SettingRow label={s.canEdit} value={canEdit} disabled={busy} onValueChange={(on) => void change({ can_edit: on })} last />
        </Card>

        <View className="gap-6">
          {link ? (
            <LinkField label={s.linkLabel} value={field} actionLabel={copied ? s.copied : s.copy} onAction={() => void copyLink()} />
          ) : (
            <LinkField label={s.linkLabel} value={field} actionLabel={s.create} actionDisabled={busy} onAction={() => void create()} />
          )}
          {ends ? (
            <Text size={14} color="ink-muted">
              {ends}
            </Text>
          ) : null}
        </View>

        <View className="flex-row gap-10">
          <ShareTile label={s.message} icon="message" tone="honey" disabled={!link} onPress={() => link && void api.share(link.token)} />
          <ShareTile label={s.email} icon="mail" disabled={!link} onPress={() => link && void api.share(link.token)} />
          <ShareTile label={s.more} icon="more" disabled={!link} onPress={() => link && void api.share(link.token)} />
        </View>

        <Button label={s.copyText} variant="soft" block onPress={() => void copyText()} />

        {link ? <Link label={s.stop} tone="warn" className="self-center px-8" onPress={() => setConfirmStop(true)} /> : null}
      </BottomSheet>
      <Dialog
        visible={confirmStop}
        icon="view-only"
        title={s.stopTitle}
        body={s.stopBody}
        confirmLabel={s.stopConfirm}
        onConfirm={() => void stop()}
        cancelLabel={s.stopKeep}
        onCancel={() => setConfirmStop(false)}
      />
    </>
  );
}
