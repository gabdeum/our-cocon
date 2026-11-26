import { useSyncExternalStore } from 'react';

/** A recipe's ingredients on their way to the grocery list (spec 022): the list shows its card meanwhile. */
export interface PendingGroceryAdd {
  id: number;
  familyId: string;
  recipeId: string;
  recipeName: string;
  photoPath: string | null;
  /** Items being added. */
  count: number;
}

let adds: readonly PendingGroceryAdd[] = [];
let next = 1;
const listeners = new Set<() => void>();
const set = (to: readonly PendingGroceryAdd[]) => {
  adds = to;
  for (const l of listeners) l();
};

/**
 * Runs `add` (the writes, then the list's refetch) while the grocery list shows the recipe as being
 * added. It outlives the sheet that started it, which closes at once.
 */
export async function whileAddingGroceries<T>(add: Omit<PendingGroceryAdd, 'id'>, run: () => Promise<T>): Promise<T> {
  const pending = { ...add, id: next++ };
  set([...adds, pending]);
  try {
    return await run();
  } finally {
    set(adds.filter((a) => a !== pending));
  }
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};

/** This family's adds in progress, oldest first. */
export function usePendingGroceryAdds(familyId: string | null): readonly PendingGroceryAdd[] {
  const all = useSyncExternalStore(subscribe, () => adds, () => adds);
  return familyId ? all.filter((a) => a.familyId === familyId) : [];
}
