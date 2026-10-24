import { normaliseName } from '@cocon/schemas/ingredient-text';
import type { Unit } from '@cocon/schemas/recipes';
import { sumNeeds } from './packs';
import type { IngredientFactsInput } from './types';
import { convert, kindOf, toBase } from './units';

/** What a grocery item is, for merging and "Move to…" (spec 020): its catalog entry, or its name. */
export function groceryIdentity(item: { catalog_key: string | null; name: string }): string {
  return item.catalog_key ?? `custom:${normaliseName(item.name)}`;
}

export interface GroceryAmount {
  quantity: number | null;
  /** Null with a quantity means pieces ("2 lemons"). */
  unit: Unit | null;
}

/** Where an item came from: a recipe, or who added it and how ('app' or the assistant). */
export interface GroceryOrigin {
  recipe_id: string | null;
  created_by: string | null;
  source: string;
}

export interface ListedGrocery extends GroceryAmount, GroceryOrigin {
  id: string;
  name: string;
  catalog_key: string | null;
  checked: boolean;
}

/** A recipe's items are one, whoever added them; otherwise one person's, the same way. */
const sameOrigin = (a: GroceryOrigin, b: GroceryOrigin) =>
  a.recipe_id === b.recipe_id && (a.recipe_id !== null || (a.created_by === b.created_by && a.source === b.source));

export type GroceryAddPlan = { kind: 'insert' } | { kind: 'merge'; id: string; quantity: number | null; unit: Unit | null };

const unitOf = (a: GroceryAmount): Unit => a.unit ?? 'piece';
const round = (n: number) => Math.round(n * 100) / 100;

/**
 * Spec 020 edge case: adding something already on the list merges the amounts. Only into an item
 * still to buy (a ticked one is in the trolley, so a new row appears), of the same origin (spec
 * 022: the list shows one row per thing anyway, so each recipe and person keeps their own item and
 * the row can say who it's for), and only when both amounts
 * add up: same kind (weight, volume or pieces), summed in the listed item's unit, or pinches with
 * pinches (spec 022: adding a recipe twice never makes a second nutmeg). When one side has no
 * amount, the merge keeps the other's. Otherwise it's a row of its own.
 */
export function planGroceryAdd(list: readonly ListedGrocery[], add: GroceryAdd): GroceryAddPlan {
  const identity = groceryIdentity(add);
  for (const item of list) {
    if (item.checked || groceryIdentity(item) !== identity || !sameOrigin(item, add)) continue;
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

export interface GroceryAdd extends GroceryAmount, GroceryOrigin {
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
  adds.forEach((add, n) => {
    const plan = planGroceryAdd(running, add);
    if (plan.kind === 'insert') {
      const id = `new:${n}`;
      inserts.set(id, { ...add });
      running.push({ id, name: add.name, catalog_key: add.catalog_key, quantity: add.quantity, unit: add.quantity == null ? null : add.unit, checked: false, recipe_id: add.recipe_id, created_by: add.created_by, source: add.source });
      return;
    }
    const target = running.find((i) => i.id === plan.id) as ListedGrocery;
    const after = { quantity: plan.quantity, unit: plan.quantity == null ? null : plan.unit };
    target.quantity = after.quantity;
    target.unit = after.unit;
    const pending = inserts.get(plan.id);
    if (pending) {
      inserts.set(plan.id, { ...pending, ...after });
      return;
    }
    const known = merges.get(plan.id);
    const original = list.find((i) => i.id === plan.id) as ListedGrocery;
    merges.set(plan.id, { id: plan.id, before: known?.before ?? { quantity: original.quantity, unit: original.unit }, after });
  });
  return { inserts: [...inserts.values()], merges: [...merges.values()] };
}

export interface CombinedAmount {
  /** One amount for them all ("1.2 kg", "15 pieces"), when they convert to the first one's kind. */
  total: GroceryAmount | null;
  /** Otherwise one amount per kind, in order: "11 pieces + 600 g". Empty with no amounts. */
  parts: GroceryAmount[];
}

const BASE: Record<'weight' | 'volume', Unit> = { weight: 'g', volume: 'ml' };

/**
 * Spec 022: the rows of one thing on the list read as one line ("Apple: 15 pieces"). Amounts are
 * summed in the first one's kind, through the catalog's densities and piece weights (spec 021's
 * sumNeeds); counts round up to whole ones. When the facts can't tell, they're summed per kind.
 * Rows with no amount add nothing.
 */
export function combineAmounts(amounts: readonly GroceryAmount[], facts: IngredientFactsInput | null | undefined): CombinedAmount {
  const known = amounts.filter((a): a is GroceryAmount & { quantity: number } => a.quantity != null);
  const [first] = known;
  if (!first) return { total: null, parts: [] };
  if (known.length === 1) return { total: { quantity: first.quantity, unit: first.unit }, parts: [{ quantity: first.quantity, unit: first.unit }] };
  const sum = sumNeeds(
    known.map((a) => ({ quantity: a.quantity, unit: a.unit === 'piece' ? null : a.unit })),
    facts,
  );
  if (sum) {
    const total: GroceryAmount = sum.kind === 'piece' ? { quantity: Math.ceil(round(sum.quantity)), unit: first.unit } : { quantity: round(sum.quantity), unit: BASE[sum.kind] };
    return { total, parts: [total] };
  }
  const byKind = new Map<string, { quantity: number; unit: Unit | null }>();
  for (const a of known) {
    const unit = unitOf(a);
    const kind = kindOf(unit);
    const key = kind === 'pinch' ? unit : kind;
    const value = kind === 'weight' || kind === 'volume' ? toBase(a.quantity, unit) : a.quantity;
    const into = byKind.get(key);
    if (into) into.quantity += value;
    else byKind.set(key, { quantity: value, unit: kind === 'weight' || kind === 'volume' ? BASE[kind] : a.unit });
  }
  return { total: null, parts: [...byKind.values()].map((p) => ({ quantity: round(p.quantity), unit: p.unit })) };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * An amount as it goes on the list (spec 022): counts round up, since you can't buy ⅓ of a leek;
 * anything else to two decimals. Never above the list's limit (under 100000).
 */
export function groceryQuantity(quantity: number, unit: Unit | null): number {
  const counted = unit == null || unit === 'piece';
  const q = counted ? Math.max(1, Math.ceil(round2(quantity))) : round2(quantity);
  return Math.min(Math.max(q, 0.01), 99999);
}

/**
 * A recipe's item rescaled for new servings on the list (spec 022, the recipe card's menu): its
 * amount times `to / from`, rounded as `groceryQuantity` does. No quantity stays none.
 */
export function rescaleGroceryAmount(amount: GroceryAmount, from: number, to: number): GroceryAmount {
  if (amount.quantity == null || from <= 0 || to <= 0) return amount;
  return { quantity: groceryQuantity((amount.quantity * to) / from, amount.unit), unit: amount.unit };
}
