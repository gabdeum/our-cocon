import { useSyncExternalStore } from 'react';
import { emptyFilters, type RecipeFilters } from '@cocon/schemas';
import type { SessionState } from './session';

/**
 * The recipe filters for this session (spec 007 FR-005): shared by the Recipes list, its quick
 * pills and the Filters sheet, kept in memory so they reset when the app restarts. Kept per person
 * and family, so whoever signs in next on this device never starts with someone else's filters.
 */
let current: { scope: string | null; filters: RecipeFilters; query: string } = { scope: null, filters: emptyFilters, query: '' };
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Whose filters these are: the signed-in person in their family, or null before that. */
export function filterScope(state: SessionState): string | null {
  return state.status === 'ready' ? `${state.userId}:${state.family.id}` : null;
}

const mine = (scope: string | null) => scope !== null && current.scope === scope;

export function getRecipeFilters(scope: string | null): RecipeFilters {
  return mine(scope) ? current.filters : emptyFilters;
}

/** Does nothing until someone is signed in to a family. */
export function setRecipeFilters(scope: string | null, filters: RecipeFilters) {
  if (scope === null) return;
  current = { scope, filters, query: mine(scope) ? current.query : '' };
  for (const listener of listeners) listener();
}

/**
 * The list's search when it opens the sheet, so the sheet counts what the list will show. Kept here
 * rather than in the route's URL, so search text never lands in the browser's history.
 */
export function setSheetSearch(scope: string | null, query: string) {
  if (scope === null) return;
  current = { scope, filters: getRecipeFilters(scope), query };
}

export function getSheetSearch(scope: string | null): string {
  return mine(scope) ? current.query : '';
}

export function useRecipeFilters(scope: string | null): RecipeFilters {
  return useSyncExternalStore(
    subscribe,
    () => getRecipeFilters(scope),
    () => getRecipeFilters(scope),
  );
}

/** FR-003: "In season" is on while this month is one of the chosen best months. */
export const inSeasonOn = (filters: RecipeFilters, month: number) => filters.months.includes(month);

export function toggleInSeason(filters: RecipeFilters, month: number): RecipeFilters {
  const months = inSeasonOn(filters, month) ? filters.months.filter((m) => m !== month) : [...filters.months, month].sort((a, b) => a - b);
  return { ...filters, months };
}

/** FR-003: "Under 30 min" is the same choice as the sheet's "Under 30 min". */
export const under30On = (filters: RecipeFilters) => filters.time === 'under_30';

export function toggleUnder30(filters: RecipeFilters): RecipeFilters {
  return { ...filters, time: under30On(filters) ? null : 'under_30' };
}
