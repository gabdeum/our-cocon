import { assertAmount } from './errors';
import { decimalText, fractionText, toStep } from './round';
import { cToF, fToC, GRAMS_PER, ML_PER } from './units';

/**
 * The unit converter (spec 013 FR-004/005; design/ui/OC-Units.md). Fluid ounces and gas mark live
 * here only: recipes never store them (spec 005). US measures (decision 12).
 */
export const CONVERTER_UNITS = {
  weight: ['g', 'kg', 'oz', 'lb'],
  volume: ['ml', 'l', 'tsp', 'tbsp', 'cup', 'fl_oz'],
  oven: ['c', 'f', 'gas_mark'],
} as const;

export type ConverterTab = keyof typeof CONVERTER_UNITS;
export type ConverterUnit = (typeof CONVERTER_UNITS)[ConverterTab][number];
/** A result tile's unit: a converter unit, cups of a recipe ingredient, or a fan oven's °C / °F. */
export type ConverterResultUnit = ConverterUnit | 'cups_of' | 'fan_c' | 'fan_f';

export interface ConverterResult {
  unit: ConverterResultUnit;
  /** For the label's singular or plural ("1 cup", "1¼ cups"). */
  value: number;
  /** "1¼", "20", "10.1", "350". */
  text: string;
}

/** US fluid ounce. */
export const FL_OZ_ML = 29.5735295625;

/** Gas marks by °C, as UK ovens print them. */
const GAS_MARKS: readonly [mark: number, celsius: number][] = [
  [0.25, 110],
  [0.5, 120],
  [1, 140],
  [2, 150],
  [3, 170],
  [4, 180],
  [5, 190],
  [6, 200],
  [7, 220],
  [8, 230],
  [9, 240],
];

/** A fan oven runs this much hotter, so recipes for it read 20 °C lower. */
export const FAN_OVEN_DROP_C = 20;

const places = (value: number, n: number) => String(Number(value.toFixed(n)));

/** Cups to the nearest ¼; under ¼ cup, two decimals. */
const cupsText = (cups: number) => (cups >= 0.25 ? fractionText(toStep(cups, 0.25)) : places(cups, 2));
/** Spoons: whole from 10, the nearest ½ below. */
const spoonsText = (n: number) => (n >= 10 ? String(Math.round(n)) : fractionText(toStep(n, 0.5)));

const VOLUME_ML: Record<(typeof CONVERTER_UNITS)['volume'][number], number> = { ...ML_PER, fl_oz: FL_OZ_ML };

function volumeText(ml: number, unit: (typeof CONVERTER_UNITS)['volume'][number]): string {
  const v = ml / VOLUME_ML[unit];
  if (unit === 'cup') return cupsText(v);
  if (unit === 'tsp' || unit === 'tbsp') return spoonsText(v);
  if (unit === 'ml') return String(Math.round(v));
  return places(v, unit === 'fl_oz' ? 1 : 2);
}

function weightText(grams: number, unit: (typeof CONVERTER_UNITS)['weight'][number]): string {
  const v = grams / GRAMS_PER[unit];
  if (unit === 'g') return String(Math.round(v));
  return places(v, unit === 'oz' ? 1 : 2);
}

/** The nearest gas mark to `celsius`. */
export function gasMark(celsius: number): number {
  let best = GAS_MARKS[0] as (typeof GAS_MARKS)[number];
  for (const m of GAS_MARKS) if (Math.abs(m[1] - celsius) < Math.abs(best[1] - celsius)) best = m;
  return best[0];
}

/** A gas mark's °C (the nearest mark when it isn't one). */
function gasMarkC(mark: number): number {
  let best = GAS_MARKS[0] as (typeof GAS_MARKS)[number];
  for (const m of GAS_MARKS) if (Math.abs(m[0] - mark) < Math.abs(best[0] - mark)) best = m;
  return best[1];
}

/** °F as ovens print it (steps of 25, like spec 005's oven temperatures). */
const ovenF = (celsius: number) => Math.round(toStep(cToF(celsius), 25));

export function tabOf(unit: ConverterUnit): ConverterTab {
  return (Object.keys(CONVERTER_UNITS) as ConverterTab[]).find((t) => (CONVERTER_UNITS[t] as readonly string[]).includes(unit)) as ConverterTab;
}

/**
 * Up to 4 result tiles for `value` in `from`, the first one the main result (honey):
 * - Volume: cups, tablespoons, teaspoons, fl oz, then ml and L; never the unit typed in.
 * - Weight: g (kg from 1000 g), oz, lb, and cups of the recipe ingredient when its density is known.
 * - Oven: the two other scales, then a fan oven's °C and °F.
 */
export function convertUnits(value: number, from: ConverterUnit, densityGPerMl?: number | null): ConverterResult[] {
  assertAmount(value);
  const tab = tabOf(from);
  if (tab === 'volume') {
    const ml = value * VOLUME_ML[from as keyof typeof VOLUME_ML];
    return (['cup', 'tbsp', 'tsp', 'fl_oz', 'ml', 'l'] as const)
      .filter((u) => u !== from)
      .slice(0, 4)
      .map((unit) => ({ unit, value: ml / VOLUME_ML[unit], text: volumeText(ml, unit) }));
  }
  if (tab === 'weight') {
    const grams = value * GRAMS_PER[from as keyof typeof GRAMS_PER];
    const metric = from === 'g' ? 'kg' : from === 'kg' ? 'g' : grams >= 1000 ? 'kg' : 'g';
    const tiles: ConverterResult[] = ([metric, 'oz', 'lb'] as const)
      .filter((u) => u !== from)
      .map((unit) => ({ unit, value: grams / GRAMS_PER[unit], text: weightText(grams, unit) }));
    if (densityGPerMl != null && densityGPerMl > 0) {
      const cups = grams / densityGPerMl / ML_PER.cup;
      tiles.push({ unit: 'cups_of', value: cups, text: cupsText(cups) });
    }
    return tiles;
  }
  // Oven: °F reads in steps of 25 and °C from °F in steps of 10, as recipes print them.
  const celsius = from === 'c' ? value : from === 'f' ? toStep(fToC(value), 10) : gasMarkC(value);
  const c = Math.round(celsius);
  const fan = c - FAN_OVEN_DROP_C;
  const scales: ConverterResult[] = [
    { unit: 'c', value: c, text: String(c) },
    { unit: 'f', value: ovenF(c), text: String(ovenF(c)) },
    { unit: 'gas_mark', value: gasMark(c), text: fractionText(gasMark(c)) },
  ];
  return [
    ...scales.filter((t) => t.unit !== from),
    { unit: 'fan_c', value: fan, text: String(fan) },
    { unit: 'fan_f', value: ovenF(fan), text: String(ovenF(fan)) },
  ];
}

/**
 * "For this recipe" (OC-Units): what `value` of a volume weighs, or how many cups a weight fills,
 * for an ingredient whose density is known. Grams are whole (kg from 1000 g); cups as above.
 */
export function densityHint(value: number, from: ConverterUnit, densityGPerMl: number): { unit: 'g' | 'kg' | 'cup'; value: number; text: string } | null {
  assertAmount(value);
  if (!(densityGPerMl > 0) || value === 0) return null;
  const tab = tabOf(from);
  if (tab === 'volume') {
    const grams = value * VOLUME_ML[from as keyof typeof VOLUME_ML] * densityGPerMl;
    return grams >= 1000 ? { unit: 'kg', value: grams / 1000, text: decimalText(grams / 1000) } : { unit: 'g', value: grams, text: String(Math.round(grams)) };
  }
  if (tab === 'weight') {
    const cups = (value * GRAMS_PER[from as keyof typeof GRAMS_PER]) / densityGPerMl / ML_PER.cup;
    return { unit: 'cup', value: cups, text: cupsText(cups) };
  }
  return null;
}
