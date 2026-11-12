import { useCallback, useSyncExternalStore } from 'react';
import type { UnitSystem } from '@cocon/schemas';

/**
 * Spec 051 (after review): the "…" panel's Metric · Imperial switch lasts for the visit only. It's
 * kept in memory by recipe, shared by the recipe page and cooking mode over it, and forgotten when
 * the recipe page closes. Nothing is saved: the member's own units are on Menu › Recipes.
 */
const chosen = new Map<string, UnitSystem>();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};

/** The units picked for this recipe on this visit (null: the member's own), and a way to pick. */
export function useVisitUnits(recipeId: string): [UnitSystem | null, (system: UnitSystem) => void] {
  const units = useSyncExternalStore(subscribe, () => chosen.get(recipeId) ?? null);
  const pick = useCallback(
    (system: UnitSystem) => {
      chosen.set(recipeId, system);
      notify();
    },
    [recipeId],
  );
  return [units, pick];
}

/** The visit is over (the recipe page closed): back to the member's own units next time. */
export function forgetVisitUnits(recipeId: string): void {
  if (chosen.delete(recipeId)) notify();
}
