import { useEffect } from 'react';
import { StatusBanner } from '@cocon/ui';
import type { EventProps, Tracker } from '@cocon/schemas';
import { onlineManager } from '@tanstack/react-query';
import { useOnline } from '../../lib/online';
import { strings } from '../../strings/en';

export type OfflineScreen = EventProps<'offline_banner_shown'>['screen'];

// Screens that already showed the banner in this offline spell, so a remount doesn't count twice.
const shownThisSpell = new Set<OfflineScreen>();
onlineManager.subscribe((online) => {
  if (online) shownThisSpell.clear();
});

/**
 * "You're offline…" at the top of a screen's content (spec 004, Patterns.md › Offline). Cached
 * data stays readable; screens disable their editing controls with useOnline().
 */
export function OfflineBanner({ screen, tracker }: { screen: OfflineScreen; tracker: Tracker }) {
  const online = useOnline();
  // Once per screen per offline spell.
  useEffect(() => {
    if (online || shownThisSpell.has(screen)) return;
    shownThisSpell.add(screen);
    tracker.track('offline_banner_shown', { screen });
  }, [online, screen, tracker]);
  return online ? null : <StatusBanner tone="warn" message={strings.sync.offline} />;
}
