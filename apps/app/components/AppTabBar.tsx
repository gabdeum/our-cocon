import { TabBar } from '@cocon/ui';
import type { Tracker } from '@cocon/schemas';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TABS, type TabKey } from '../lib/navigation';
import { strings } from '../strings/en';
import { AppTimerPill, useHasTimers } from './timers/AppTimerPill';

/** The parts of Expo Router's tab-bar props this uses (its BottomTabBarProps). */
export interface TabNavigationProps {
  state: { index: number; routes: { key: string; name: string }[] };
  emitter: {
    emit: (event: { type: 'tabPress'; target: string; canPreventDefault: true }) => { defaultPrevented: boolean };
  };
  navigateToTab: (routeKey: string) => void;
}

/** Connects the design-system TabBar to Expo Router's tabs and sends `tab_selected` (spec 002), with the TimerPill (011). */
export function AppTabBar({ state, emitter, navigateToTab, tracker, onOpenTimers }: TabNavigationProps & { tracker: Tracker; onOpenTimers: () => void }) {
  const insets = useSafeAreaInsets();
  const hasTimers = useHasTimers();
  const current = state.routes[state.index]?.name;
  const active = TABS.find((t) => t.route === current)?.key ?? 'home';

  const select = (key: TabKey) => {
    const tab = TABS.find((t) => t.key === key);
    const route = state.routes.find((r) => r.name === tab?.route);
    if (!tab || !route) return;
    const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (key === active || event.defaultPrevented) return;
    navigateToTab(route.key);
    tracker.track('tab_selected', { tab: key });
  };

  return (
    <TabBar
      label={strings.tabBar.label}
      items={[...TABS]}
      active={active}
      onSelect={select}
      bottomInset={insets.bottom}
      // The TimerPill above the bar while any timer exists (spec 011 US1).
      timerPill={hasTimers ? <AppTimerPill onOpen={onOpenTimers} tracker={tracker} /> : undefined}
    />
  );
}
