import type { StoreProfile } from '@cocon/schemas/catalog';
import type { Unit } from '@cocon/schemas/recipes';
import { readAmount } from './parse-amount';
import type { IngredientFactsInput } from './types';
import { kindOf, toBase, type UnitKind } from './units';
import { en, type ParserWords } from './words.en';

/**
 * Spec 021: what to buy for what recipes need. Pack sizes come from the catalog (spec 031's
 * `ingredient_packs`, the family's correction replacing the catalog's), per store profile.
 */
export interface StorePack {
  size: number;
  unit: Unit;
  /** "1 pint carton", "20 cl", "each", "per kg". */
  label: string;
  /** Sold loose: by weight ("per kg") or one by one ("each"). */
  loose: boolean;
}

/** An amount to buy for: null unit means pieces ("6 apples"). */
export interface PackNeed {
  quantity: number;
  unit: Unit | null;
}

type Kind = 'weight' | 'volume' | 'piece';

export interface PackPick {
  pack: StorePack;
  count: number;
}

/**
 * The packs to buy. `loose` is set when the item is bought loose by weight ("Buy 1 kg loose"):
 * `amount` is then how much, in grams or ml. Otherwise `picks` are the packs ("2 × 20 cl"), one
 * by one for packs sold "each". `leftover` is in the need's base unit (g, ml or pieces).
 */
export interface PackPlan {
  picks: PackPick[];
  loose: { pack: StorePack; amount: number; kind: 'weight' | 'volume' } | null;
  kind: Kind;
  need: number;
  bought: number;
  leftover: number;
  /** The leftover is an estimate: US sizes are imperial, or a density or piece weight was used. */
  approximate: boolean;
}

/** What one piece weighs (the default size, with the family's correction), for pieces ↔ weight. */
export function pieceGrams(facts: IngredientFactsInput | null | undefined): number | null {
  if (!facts) return null;
  const size = facts.default_size ?? 'medium';
  const g = size === 'small' ? facts.size_small_g : size === 'large' ? facts.size_large_g : facts.size_medium_g;
  return g && g > 0 ? g : null;
}

const kindOfUnit = (unit: Unit | null): UnitKind => (unit == null ? 'piece' : kindOf(unit));

/** `value` in base units of `from` (g, ml, pieces) as base units of `to`; null when the facts can't tell. */
function toKind(value: number, from: Kind, to: Kind, facts: IngredientFactsInput | null | undefined): number | null {
  if (from === to) return value;
  const density = facts?.density_g_per_ml ?? null;
  const piece = pieceGrams(facts);
  let grams: number | null;
  if (from === 'weight') grams = value;
  else if (from === 'volume') grams = density ? value * density : null;
  else grams = piece ? value * piece : null;
  if (grams == null) return null;
  if (to === 'weight') return grams;
  if (to === 'volume') return density ? grams / density : null;
  return piece ? grams / piece : null;
}

/**
 * The amounts summed in base units (FR-002), in the first one's kind; null when one of them can't
 * be converted to it.
 */
export function sumNeeds(needs: readonly PackNeed[], facts: IngredientFactsInput | null | undefined): { quantity: number; kind: Kind } | null {
  const first = needs[0];
  if (!first) return null;
  const kind = kindOfUnit(first.unit);
  if (kind === 'pinch') return null;
  let total = 0;
  for (const n of needs) {
    const k = kindOfUnit(n.unit);
    if (k === 'pinch') return null;
    const v = toKind(n.unit == null ? n.quantity : toBase(n.quantity, n.unit), k, kind, facts);
    if (v == null) return null;
    total += v;
  }
  return { quantity: total, kind };
}

/** The largest grid the search runs on: plenty for any family's shop, quick on a phone. */
const MAX_STEPS = 4_000;
const SAME = 1e-6;
/**
 * Leftovers this close count as the same (1% of the need): catalog sizes are rounded (a half pint
 * is stored as 236 ml, a pint as 473 ml), and nobody picks two cartons over one to save a spoonful.
 */
const TIE = 0.01;

interface Option {
  picks: PackPick[];
  loose: PackPlan['loose'];
  bought: number;
  count: number;
  approximate: boolean;
}

/**
 * FR-003: the packs that cover `need` with the least left over, then exact sizes before estimated
 * ones, then the fewest packs (buying loose counts as one), then the catalog's order. Null when
 * there's no amount, no pack, or no pack that converts to the need (FR edge case: "Need …" only).
 */
export function pickPacks(
  need: PackNeed | { quantity: number; kind: Kind },
  packs: readonly StorePack[],
  facts: IngredientFactsInput | null | undefined,
  profile: StoreProfile,
): PackPlan | null {
  const kind: UnitKind = 'kind' in need ? need.kind : kindOfUnit(need.unit);
  if (kind === 'pinch' || !(need.quantity > 0)) return null;
  const amount = 'kind' in need || need.unit == null ? need.quantity : toBase(need.quantity, need.unit);
  // US stores sell imperial sizes, stored in metric: their leftovers are never exact.
  const imperial = profile === 'us' && kind !== 'piece';

  const options: Option[] = [];
  const packed: { pack: StorePack; size: number; approximate: boolean }[] = [];
  for (const pack of packs) {
    const packKind = kindOfUnit(pack.unit) as Kind;
    if ((packKind as UnitKind) === 'pinch') continue;
    const size = toKind(packKind === 'piece' ? pack.size : toBase(pack.size, pack.unit), packKind, kind, facts);
    if (size == null || !(size > 0)) continue;
    const approximate = packKind !== kind || imperial;
    if (pack.loose && packKind !== 'piece') {
      // By weight: exactly what's needed.
      const exact = toKind(amount, kind, packKind, facts) as number;
      options.push({ picks: [], loose: { pack, amount: exact, kind: packKind }, bought: amount, count: 1, approximate });
    } else if (pack.loose && pack.size === 1) {
      // One by one: whole pieces.
      const count = Math.max(1, Math.ceil(amount / size - SAME));
      options.push({ picks: [{ pack, count }], loose: null, bought: count * size, count: 1, approximate });
    } else {
      packed.push({ pack, size, approximate });
    }
  }
  const combo = cover(amount, packed);
  if (combo) options.push(combo);

  let best: Option | null = null;
  for (const o of options) {
    if (!best) {
      best = o;
      continue;
    }
    const d = o.bought - best.bought;
    const tolerance = TIE * amount + SAME;
    if (d < -tolerance) best = o;
    else if (d > tolerance) continue;
    else if (o.approximate !== best.approximate) best = o.approximate ? best : o;
    else if (o.count < best.count) best = o;
  }
  if (!best) return null;
  return {
    picks: best.picks,
    loose: best.loose,
    kind,
    need: amount,
    bought: best.bought,
    leftover: Math.max(0, best.bought - amount),
    approximate: best.approximate,
  };
}

/**
 * The fewest-packs combination for each total, on a grid (1 g or ml, 0.01 piece, coarser for huge
 * amounts). Sizes round down and the need up, so what's bought always covers it (SC-001).
 */
function cover(amount: number, packs: readonly { pack: StorePack; size: number; approximate: boolean }[]): Option | null {
  if (packs.length === 0) return null;
  const largest = Math.max(...packs.map((p) => p.size));
  const base = packs.every((p) => Number.isInteger(p.size)) && Number.isInteger(amount) ? 1 : 0.01;
  const step = Math.max(base, (amount + largest) / MAX_STEPS);
  const sizes = packs.map((p) => Math.floor(p.size / step + SAME));
  const target = Math.ceil(amount / step - SAME);
  const limit = target + Math.max(...sizes);
  if (sizes.every((s) => s === 0)) return null;

  const fewest = new Int32Array(limit + 1).fill(-1);
  const last = new Int16Array(limit + 1).fill(-1);
  fewest[0] = 0;
  for (let x = 1; x <= limit; x++) {
    for (let i = 0; i < sizes.length; i++) {
      const s = sizes[i] as number;
      if (s === 0 || s > x) continue;
      const before = fewest[x - s] as number;
      if (before < 0) continue;
      const current = fewest[x] as number;
      if (current < 0 || before + 1 < current) {
        fewest[x] = before + 1;
        last[x] = i;
      }
    }
  }
  let total = -1;
  let tieUntil = limit;
  for (let x = Math.max(target, 1); x <= Math.min(limit, tieUntil); x++) {
    const n = fewest[x] as number;
    if (n < 0) continue;
    if (total < 0) {
      total = x;
      tieUntil = x + Math.floor((TIE * amount) / step);
    } else if (n < (fewest[total] as number)) total = x;
  }
  if (total < 0) return null;

  const counts = new Array<number>(packs.length).fill(0);
  for (let x = total; x > 0; ) {
    const i = last[x] as number;
    counts[i] = (counts[i] as number) + 1;
    x -= sizes[i] as number;
  }
  const picks = packs.flatMap((p, i) => (counts[i] ? [{ pack: p.pack, count: counts[i] as number }] : []));
  return {
    picks,
    loose: null,
    bought: packs.reduce((sum, p, i) => sum + p.size * (counts[i] as number), 0),
    count: counts.reduce((a, b) => a + b, 0),
    approximate: picks.some((p) => packs.find((q) => q.pack === p.pack)?.approximate),
  };
}

/** Store sizes people type that recipes don't use: centilitres and US liquid measures, in ml. */
const STORE_UNITS: Record<string, number> = {
  cl: 10,
  pint: 473.176,
  pints: 473.176,
  pt: 473.176,
  quart: 946.353,
  quarts: 946.353,
  qt: 946.353,
  gallon: 3785.41,
  gallons: 3785.41,
  gal: 3785.41,
};

/**
 * FR-004: a family's own pack size, typed as "250 g", "20 cl", "1 pint" or "6" (pieces). Null when
 * it isn't one amount and one unit. Spoons and pinches aren't pack sizes.
 */
export function parsePackSize(text: string, words: ParserWords = en): { size: number; unit: Unit } | null {
  const trimmed = text.trim();
  const amount = readAmount(trimmed);
  if (!amount || !(amount.value > 0)) return null;
  const word = trimmed.slice(amount.length).trim().toLowerCase().replace(/\.$/, '');
  if (!word) return { size: amount.value, unit: 'piece' };
  const store = STORE_UNITS[word];
  if (store) return { size: Math.round(amount.value * store * 100) / 100, unit: 'ml' };
  const unit = words.units[word];
  if (!unit || unit === 'pinch' || unit === 'tsp' || unit === 'tbsp') return null;
  return { size: amount.value, unit };
}
