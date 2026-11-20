import { NavRail } from '@cocon/ui';
import type { Tracker } from '@cocon/schemas';
import { router, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TABS, type TabKey } from '../lib/navigation';
import { strings } from '../strings/en';
import { AppTimerPill, useHasTimers } from './timers/AppTimerPill';

/** Where each tab's screen is, for a rail drawn outside the tab navigator. */
const tabHref = (route: string) => (route === 'index' ? '/' : `/${route}`) as Href;

/**
 * The rail on a screen pushed over the tabs (spec 067: a recipe beside the Recipes list, from 960).
 * The same tabs and timer as AppTabBar's rail; a tab goes back to its screen under the stack.
 */
export function RouteRail({ active, tracker, onOpenTimers }: { active: TabKey; tracker: Tracker; onOpenTimers: () => void }) {
  const insets = useSafeAreaInsets();
  const hasTimers = useHasTimers();
  const select = (key: TabKey) => {
    const tab = TABS.find((t) => t.key === key);
    if (!tab) return;
    router.navigate(tabHref(tab.route));
    tracker.track('tab_selected', { tab: key, nav: 'rail' });
  };
  return (
    <NavRail
      label={strings.tabBar.label}
      items={[...TABS]}
      active={active}
      onSelect={select}
      insets={insets}
      timer={hasTimers ? <AppTimerPill vertical onOpen={onOpenTimers} tracker={tracker} /> : undefined}
    />
  );
}
