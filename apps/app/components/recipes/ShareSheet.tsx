import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { BottomSheet, Button, Callout, Card, Dialog, IconButton, Link, LinkField, RecipeSummary, SettingRow, ShareTile, StatusBanner } from '@cocon/ui';
import type { Tracker } from '@cocon/schemas';
import { strings } from '../../strings/en';
import { daysActive, shareLinkUrl, type ShareLink } from '../../lib/share';

const s = strings.share;
/** "Copied ✓" on the button, then back to "Copy link" (OC-Share › Dynamic copy). */
export const COPIED_MS = 2000;

export interface ShareSheetApi {
  /** The recipe's active link, made now if it has none. */
  open: () => Promise<ShareLink & { created: boolean }>;
  stop: (token: string) => Promise<void>;
  setOptions: (token: string, options: Partial<Pick<ShareLink, 'include_variants' | 'include_tips'>>) => Promise<void>;
  copy: (text: string) => Promise<unknown>;
  /** The system share sheet with "{recipe name} — {link}". */
  share: (token: string) => Promise<unknown>;
}

export interface ShareSheetProps {
  recipeName: string;
  familyName: string;
  photoUri?: string;
  api: ShareSheetApi;
  tracker: Tracker;
  onClose: () => void;
}

type LinkState = { kind: 'creating' } | { kind: 'failed' } | { kind: 'shared'; link: ShareLink } | { kind: 'stopped' };

/** Share a recipe as a view-only link (spec 019 US1, US3; design/ui/OC-Share.md). */
export function ShareSheet({ recipeName, familyName, photoUri, api, tracker, onClose }: ShareSheetProps) {
  const [state, setState] = useState<LinkState>({ kind: 'creating' });
  const [copied, setCopied] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [confirmStop, setConfirmStop] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(copiedTimer.current), []);

  // The link is made when the sheet opens, and again with "Create a new link" (`attempt`).
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    api.open().then(
      ({ created, ...link }) => {
        if (created) tracker.track('share_link_created', {});
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
  const url = link ? shareLinkUrl(link.token) : null;

  const copy = async () => {
    if (!url) return;
    await api.copy(url);
    setCopied(true);
    setBanner(s.copiedBanner);
    clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), COPIED_MS);
  };

  const setOption = async (key: 'include_variants' | 'include_tips', on: boolean) => {
    if (!link) return;
    setState({ kind: 'shared', link: { ...link, [key]: on } });
    try {
      await api.setOptions(link.token, { [key]: on });
    } catch {
      // Changes apply instantly; a failed one goes back, and says so.
      setState({ kind: 'shared', link });
      setBanner(s.changeFailed);
    }
  };

  const stop = async () => {
    setConfirmStop(false);
    if (!link) return;
    try {
      await api.stop(link.token);
      tracker.track('share_link_stopped', { days_active: daysActive(link.created_at) });
      setState({ kind: 'stopped' });
      setCopied(false);
      setBanner(null);
    } catch {
      setBanner(s.changeFailed);
    }
  };

  const field = state.kind === 'creating' ? s.creating : state.kind === 'shared' ? (url ?? '') : state.kind === 'stopped' ? s.notShared : '';

  return (
    <>
      <BottomSheet visible title={s.title} closeLabel={s.close} onClose={onClose} headerAction={<IconButton icon="close" label={s.close} variant="soft" onPress={onClose} />}>
        {banner ? <StatusBanner message={banner} /> : null}

        <RecipeSummary name={recipeName} sub={s.fromFamily(familyName)} photoUri={photoUri} photoLabel={s.photo} />

        <Callout variant="info" icon="view-only" text={s.viewOnly} />

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

        <Card className="gap-0 px-16 py-4">
          <SettingRow label={s.includeVariants} value={link?.include_variants ?? true} disabled={!link} onValueChange={(on) => void setOption('include_variants', on)} />
          <SettingRow label={s.includeTips} value={link?.include_tips ?? true} disabled={!link} onValueChange={(on) => void setOption('include_tips', on)} last />
        </Card>

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
