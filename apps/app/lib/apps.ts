import type { IconName } from '@cocon/ui';
import { strings } from '../strings/en';

/**
 * Spec 029 FR-002: every part of the app, in the Menu's Apps. The first three open their tab;
 * the rest have no tab (Timers, 032-later L20). A new app is one more entry here, and its detail
 * in the Menu tab.
 */
export const APPS = [
  { key: 'calendar', icon: 'calendar', name: strings.menu.calendar, href: '/calendar' },
  { key: 'recipes', icon: 'recipes', name: strings.menu.recipes, href: '/recipes' },
  { key: 'groceries', icon: 'groceries', name: strings.menu.groceries, href: '/groceries' },
  { key: 'timers', icon: 'timer', name: strings.menu.timers, href: '/timers' },
] as const satisfies readonly { key: string; icon: IconName; name: string; href: string }[];

export type AppKey = (typeof APPS)[number]['key'];

/** FR-003: the settings pages, by their analytics name and route. */
export const SETTINGS_PAGES = {
  family: '/settings/family',
  ai: '/settings/ai',
  calendar: '/settings/calendar',
  recipes: '/settings/recipes',
  groceries: '/settings/groceries',
  deleted: '/settings/deleted',
} as const;

export type SettingsPage = keyof typeof SETTINGS_PAGES;
