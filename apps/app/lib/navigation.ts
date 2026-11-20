import type { IconName } from '@cocon/ui';
import { strings } from '../strings/en';

/**
 * The five tab destinations (specs 002, 036; design/ui/TabBar.md), by Expo Router route name.
 * Menu is `/menu` (spec 029).
 */
export const TABS = [
  { key: 'home', route: 'index', icon: 'home', label: strings.tabBar.home },
  { key: 'calendar', route: 'calendar', icon: 'calendar', label: strings.tabBar.calendar },
  { key: 'recipes', route: 'recipes', icon: 'recipes', label: strings.tabBar.recipes },
  { key: 'groceries', route: 'groceries', icon: 'groceries', label: strings.tabBar.groceries },
  { key: 'menu', route: 'menu', icon: 'menu', label: strings.tabBar.menu },
] as const satisfies readonly { key: string; route: string; icon: IconName; label: string }[];

export type TabKey = (typeof TABS)[number]['key'];

/**
 * The side rail's destinations from 960 (spec 064, then 2026-11-20): the tabs, with Reminders and
 * Timers before Menu, since the rail has the room. Those two aren't tabs: they're pushed pages,
 * which show the rail too from 960 in place of their back button.
 */
export const RAIL_ITEMS = [
  ...TABS.filter((t) => t.key !== 'menu'),
  { key: 'reminders', route: 'reminders', icon: 'check', label: strings.menu.reminders },
  { key: 'timers', route: 'timers', icon: 'timer', label: strings.menu.timers },
  ...TABS.filter((t) => t.key === 'menu'),
] as const satisfies readonly { key: string; route: string; icon: IconName; label: string }[];

export type RailKey = (typeof RAIL_ITEMS)[number]['key'];

/** A rail destination that isn't a tab: its page. */
export const RAIL_PAGES = { reminders: '/reminders', timers: '/timers' } as const satisfies Partial<Record<RailKey, string>>;

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
