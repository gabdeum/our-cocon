import type { Unit } from '@cocon/schemas/recipes';
import { QuantityError, assertAmount } from './errors';

/**
 * Fixed unit maths (spec 031: unit maths is code, ingredient facts are data). US measures only
 * (decision 12). Weights in grams, volumes in millilitres.
 */
export const GRAMS_PER: Record<'g' | 'kg' | 'oz' | 'lb', number> = { g: 1, kg: 1000, oz: 28.349523125, lb: 453.59237 };
export const ML_PER: Record<'ml' | 'l' | 'tsp' | 'tbsp' | 'cup', number> = {
  ml: 1,
  l: 1000,
  tsp: 4.92892159375,
  tbsp: 14.78676478125,
  cup: 236.5882365,
};

/** Density used for a piece-fit spoon amount when the catalog has none (water). */
export const WATER_G_PER_ML = 1;

export type UnitKind = 'weight' | 'volume' | 'piece' | 'pinch';

export function kindOf(unit: Unit): UnitKind {
  if (unit in GRAMS_PER) return 'weight';
  if (unit in ML_PER) return 'volume';
  return unit === 'piece' ? 'piece' : 'pinch';
}

/** `value` in `from`, as a weight in grams or a volume in millilitres. */
export function toBase(value: number, from: Unit): number {
  const kind = kindOf(from);
  if (kind === 'weight') return value * GRAMS_PER[from as keyof typeof GRAMS_PER];
  if (kind === 'volume') return value * ML_PER[from as keyof typeof ML_PER];
  return value;
}

/**
 * Converts between units of the same kind, or between weight and volume when the ingredient's
 * density is known (FR-008). Pieces and pinches only convert to themselves.
 */
export function convert(value: number, from: Unit, to: Unit, densityGPerMl?: number | null): number {
  assertAmount(value);
  const a = kindOf(from);
  const b = kindOf(to);
  if (from === to) return value;
  const base = toBase(value, from);
  if (a === b && (a === 'weight' || a === 'volume')) return base / toBase(1, to);
  if (densityGPerMl != null && densityGPerMl > 0) {
    if (a === 'weight' && b === 'volume') return base / densityGPerMl / toBase(1, to);
    if (a === 'volume' && b === 'weight') return (base * densityGPerMl) / toBase(1, to);
  }
  throw new QuantityError('incompatible_units', `Can't convert ${from} to ${to}`);
}

/** °C → °F, unrounded. */
export function cToF(celsius: number): number {
  return (celsius * 9) / 5 + 32;
}

/** °F → °C, unrounded (spec 016 stores °C). */
export function fToC(fahrenheit: number): number {
  return ((fahrenheit - 32) * 5) / 9;
}
