import { normaliseName } from '@cocon/schemas/ingredient-text';
import type { Unit } from '@cocon/schemas/recipes';
import { convert, kindOf } from './units';

/** What a grocery item is, for merging and "Move to…" (spec 020): its catalog entry, or its name. */
export function groceryIdentity(item: { catalog_key: string | null; name: string }): string {
  return item.catalog_key ?? `custom:${normaliseName(item.name)}`;
}

export interface GroceryAmount {
  quantity: number | null;
  /** Null with a quantity means pieces ("2 lemons"). */
  unit: Unit | null;
}

export interface ListedGrocery extends GroceryAmount {
  id: string;
  name: string;
  catalog_key: string | null;
  checked: boolean;
}

export type GroceryAddPlan = { kind: 'insert' } | { kind: 'merge'; id: string; quantity: number | null; unit: Unit | null };

const unitOf = (a: GroceryAmount): Unit => a.unit ?? 'piece';
const round = (n: number) => Math.round(n * 100) / 100;

/**
 * Spec 020 edge case: adding something already on the list merges the amounts. Only into an item
 * still to buy (a ticked one is in the trolley, so a new row appears), and only when both amounts
 * add up: same kind (weight, volume or pieces), summed in the listed item's unit. When one side
 * has no amount, the merge keeps the other's. Otherwise it's a row of its own.
 */
export function planGroceryAdd(list: readonly ListedGrocery[], add: GroceryAmount & { name: string; catalog_key: string | null }): GroceryAddPlan {
  const identity = groceryIdentity(add);
  for (const item of list) {
    if (item.checked || groceryIdentity(item) !== identity) continue;
    if (item.quantity == null) return { kind: 'merge', id: item.id, quantity: add.quantity, unit: add.quantity == null ? null : add.unit };
    if (add.quantity == null) return { kind: 'merge', id: item.id, quantity: item.quantity, unit: item.unit };
    const into = unitOf(item);
    const kind = kindOf(into);
    if (kind !== kindOf(unitOf(add)) || kind === 'pinch') continue;
    const total = round(item.quantity + convert(add.quantity, unitOf(add), into));
    return { kind: 'merge', id: item.id, quantity: total, unit: item.unit };
  }
  return { kind: 'insert' };
}
