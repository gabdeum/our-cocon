import { useEffect } from 'react';
import { StatusBanner } from '@cocon/ui';
import type { EventProps, Tracker } from '@cocon/schemas';
import { useOnline } from '../../lib/online';
import { strings } from '../../strings/en';

export type OfflineScreen = EventProps<'offline_banner_shown'>['screen'];

/**
 * "You're offline…" at the top of a screen's content (spec 004, Patterns.md › Offline). Cached
 * data stays readable; screens disable their editing controls with useOnline().
 */
export function OfflineBanner({ screen, tracker }: { screen: OfflineScreen; tracker: Tracker }) {
  const online = useOnline();
  // Once each time this screen goes offline.
  useEffect(() => {
    if (!online) tracker.track('offline_banner_shown', { screen });
  }, [online, screen, tracker]);
  return online ? null : <StatusBanner tone="warn" message={strings.sync.offline} />;
}
