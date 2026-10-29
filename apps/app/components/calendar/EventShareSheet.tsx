import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { BottomSheet, Button, Callout, Dialog, IconButton, Link, LinkField, ShareTile } from '@cocon/ui';
import type { Tracker } from '@cocon/schemas';
import { strings } from '../../strings/en';
import { useToast } from '../../lib/toast';
import { eventShareUrl, type EventShareLink } from '../../lib/event-share';
import { COPIED_MS } from '../recipes/ShareSheet';

const s = strings.share;
const e = strings.calendar.event;

export interface EventShareSheetApi {
  /** The event date's active link, made now if it has none. */
  open: () => Promise<EventShareLink & { created: boolean }>;
  stop: (token: string) => Promise<void>;
  copy: (text: string) => Promise<unknown>;
  /** The system share sheet with "{title} — {link}". */
  share: (token: string) => Promise<unknown>;
}

type LinkState = { kind: 'creating' } | { kind: 'failed' } | { kind: 'shared'; link: EventShareLink } | { kind: 'stopped' };

/**
 * Share one event date as a view-only link (spec 042 FR-005; OC-CalEvent.md › Share): OC-Share's
 * layout without the recipe card and switches. The page shows the title, day, time, place and
 * first names; the link stops working once the event is over, or when it's stopped.
 */
export function EventShareSheet({ api, tracker, onClose }: { api: EventShareSheetApi; tracker: Tracker; onClose: () => void }) {
  const [state, setState] = useState<LinkState>({ kind: 'creating' });
  const [copied, setCopied] = useState(false);
  const toast = useToast();
  const [confirmStop, setConfirmStop] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(copiedTimer.current), []);

  // The link is made when the sheet opens, and again with "Create a new link" (`attempt`).
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    api.open().then(
      ({ created, ...link }) => {
        if (created) tracker.track('event_shared', {});
        if (live) setState({ kind: 'shared', link });
      },
      () => {
        if (live) setState({ kind: 'failed' });
      },
    );
    return () => {
      live = false;
    };
  }, [api, tracker, attempt]);
  const again = () => {
    setState({ kind: 'creating' });
    setAttempt((n) => n + 1);
  };

  const link = state.kind === 'shared' ? state.link : null;
  const url = link ? eventShareUrl(link.token) : null;

  const copy = async () => {
    if (!url) return;
    await api.copy(url);
    setCopied(true);
    toast.show({ text: s.copiedBanner });
    clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), COPIED_MS);
  };

  const stop = async () => {
    setConfirmStop(false);
    if (!link) return;
    try {
      await api.stop(link.token);
      setState({ kind: 'stopped' });
      setCopied(false);
      toast.hide();
    } catch {
      toast.show({ text: s.changeFailed, tone: 'warn' });
    }
  };

  const field = state.kind === 'creating' ? s.creating : state.kind === 'shared' ? (url ?? '') : state.kind === 'stopped' ? s.notShared : '';

  return (
    <>
      <BottomSheet visible title={e.shareTitle} lead={e.shareLead} closeLabel={s.close} onClose={onClose} headerAction={<IconButton icon="close" label={s.close} variant="soft" onPress={onClose} />}>

        {state.kind === 'failed' ? (
          <View className="gap-10">
            <Callout variant="warn" text={s.failed} />
            <Button label={s.retry} variant="soft" onPress={again} />
          </View>
        ) : state.kind === 'stopped' ? (
          <LinkField label={s.linkLabel} value={field} actionLabel={s.createNew} onAction={again} />
        ) : (
          <LinkField label={s.linkLabel} value={field} actionLabel={copied ? s.copied : s.copy} actionDisabled={!url} onAction={() => void copy()} />
        )}

        <View className="flex-row gap-10">
          <ShareTile label={s.message} icon="message" tone="honey" disabled={!link} onPress={() => link && void api.share(link.token)} />
          <ShareTile label={s.email} icon="mail" disabled={!link} onPress={() => link && void api.share(link.token)} />
          <ShareTile label={s.more} icon="more" disabled={!link} onPress={() => link && void api.share(link.token)} />
        </View>

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
