import type { IconName } from '@cocon/ui';
import { strings } from '../strings/en';

/** The four tab destinations (spec 002, design/ui/TabBar.md), by Expo Router route name. */
export const TABS = [
  { key: 'home', route: 'index', icon: 'home', label: strings.tabBar.home },
  { key: 'recipes', route: 'recipes', icon: 'recipes', label: strings.tabBar.recipes },
  { key: 'groceries', route: 'groceries', icon: 'groceries', label: strings.tabBar.groceries },
  { key: 'settings', route: 'settings', icon: 'settings', label: strings.tabBar.settings },
] as const satisfies readonly { key: string; route: string; icon: IconName; label: string }[];

export type TabKey = (typeof TABS)[number]['key'];

/**
 * How non-tab screens are presented (design/flows.md). They live in the root stack, outside
 * `app/(tabs)`, so the tab bar is never shown on them.
 */
export const presentation = {
  /** Pushed screens: recipe page, settings sub-pages, timers. */
  stack: {},
  /** Bottom sheets: the screen draws a BottomSheet over the previous one. */
  sheet: { presentation: 'transparentModal', animation: 'none', contentStyle: { backgroundColor: 'transparent' } },
  /** Forms and cooking mode. */
  fullScreen: { presentation: 'fullScreenModal' },
} as const;
