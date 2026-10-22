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
 * add up: same kind (weight, volume or pieces), summed in the listed item's unit, or pinches with
 * pinches (spec 022: adding a recipe twice never makes a second nutmeg). When one side has no
 * amount, the merge keeps the other's. Otherwise it's a row of its own.
 */
export function planGroceryAdd(list: readonly ListedGrocery[], add: GroceryAmount & { name: string; catalog_key: string | null }): GroceryAddPlan {
  const identity = groceryIdentity(add);
  for (const item of list) {
    if (item.checked || groceryIdentity(item) !== identity) continue;
    if (item.quantity == null) return { kind: 'merge', id: item.id, quantity: add.quantity, unit: add.quantity == null ? null : add.unit };
    if (add.quantity == null) return { kind: 'merge', id: item.id, quantity: item.quantity, unit: item.unit };
    const into = unitOf(item);
    const kind = kindOf(into);
    if (kind !== kindOf(unitOf(add))) continue;
    const total = round(item.quantity + (into === unitOf(add) ? add.quantity : convert(add.quantity, unitOf(add), into)));
    return { kind: 'merge', id: item.id, quantity: total, unit: item.unit };
  }
  return { kind: 'insert' };
}

export interface GroceryAdd extends GroceryAmount {
  name: string;
  catalog_key: string | null;
}

export interface GroceryMerge {
  id: string;
  /** The listed item's amount before this add, for Undo and "Already on the list (100 ml)". */
  before: GroceryAmount;
  after: GroceryAmount;
}

export interface GroceryAddsPlan<A extends GroceryAdd> {
  /** New rows, each with every later add of the same thing already summed in. */
  inserts: (A & GroceryAmount)[];
  /** Items already on the list, each once, with its total after all the adds. */
  merges: GroceryMerge[];
  /** For each add, in order: the listed item it goes into, or null when it makes (or joins) a new row. */
  into: (GroceryMerge | null)[];
}

/**
 * Spec 022 FR-002: several adds at once (a recipe's ingredients), in order. Each one is planned
 * against the list as the earlier ones left it, so two lines of the same thing make one row, and
 * adding the same recipe again only updates what's there (SC-001).
 */
export function planGroceryAdds<A extends GroceryAdd>(list: readonly ListedGrocery[], adds: readonly A[]): GroceryAddsPlan<A> {
  const running: ListedGrocery[] = list.map((i) => ({ ...i }));
  const inserts = new Map<string, A & GroceryAmount>();
  const merges = new Map<string, GroceryMerge>();
  const into: (GroceryMerge | null)[] = [];
  adds.forEach((add, n) => {
    const plan = planGroceryAdd(running, add);
    if (plan.kind === 'insert') {
      const id = `new:${n}`;
      inserts.set(id, { ...add });
      running.push({ id, name: add.name, catalog_key: add.catalog_key, quantity: add.quantity, unit: add.quantity == null ? null : add.unit, checked: false });
      into.push(null);
      return;
    }
    const target = running.find((i) => i.id === plan.id) as ListedGrocery;
    const after = { quantity: plan.quantity, unit: plan.quantity == null ? null : plan.unit };
    target.quantity = after.quantity;
    target.unit = after.unit;
    const pending = inserts.get(plan.id);
    if (pending) {
      inserts.set(plan.id, { ...pending, ...after });
      into.push(null);
      return;
    }
    const known = merges.get(plan.id);
    const original = list.find((i) => i.id === plan.id) as ListedGrocery;
    const merge = { id: plan.id, before: known?.before ?? { quantity: original.quantity, unit: original.unit }, after };
    merges.set(plan.id, merge);
    into.push(merge);
  });
  return { inserts: [...inserts.values()], merges: [...merges.values()], into };
}
