import type { IconName } from '@cocon/ui';
import { strings } from '../strings/en';

/**
 * The five tab destinations (specs 002, 036; design/ui/TabBar.md), by Expo Router route name.
 * Menu still opens the `settings` route until spec 029 moves it to `/menu`.
 */
export const TABS = [
  { key: 'home', route: 'index', icon: 'home', label: strings.tabBar.home },
  { key: 'calendar', route: 'calendar', icon: 'calendar', label: strings.tabBar.calendar },
  { key: 'recipes', route: 'recipes', icon: 'recipes', label: strings.tabBar.recipes },
  { key: 'groceries', route: 'groceries', icon: 'groceries', label: strings.tabBar.groceries },
  { key: 'menu', route: 'settings', icon: 'menu', label: strings.tabBar.menu },
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
