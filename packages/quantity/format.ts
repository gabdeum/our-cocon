import type { SizeWord } from '@cocon/schemas/recipes';
import { QuantityError, assertAmount } from './errors';
import { decimalText, fractionText, toStep } from './round';
import type { FormatOptions, FormattedIngredient, IngredientFactsInput, QuantityIngredient, UnitSystem } from './types';
import { GRAMS_PER, ML_PER, WATER_G_PER_ML, kindOf, toBase } from './units';

interface Measure {
  amount: string;
  unit: string;
}

const text = (m: Measure) => (m.unit ? `${m.amount} ${m.unit}` : m.amount);
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** Whole g, kg from 1000 g; oz to 1 decimal, lb from 16 oz (FR-003). Null when it rounds to 0. */
function weight(grams: number, system: UnitSystem): Measure | null {
  if (system === 'metric') {
    const g = Math.round(grams);
    if (g >= 1000) return { amount: decimalText(grams / 1000), unit: 'kg' };
    return g === 0 ? null : { amount: String(g), unit: 'g' };
  }
  const oz = toStep(grams / GRAMS_PER.oz, 0.1);
  if (oz >= 16) return { amount: decimalText(grams / GRAMS_PER.lb), unit: 'lb' };
  return oz === 0 ? null : { amount: decimalText(oz), unit: 'oz' };
}

/** Whole ml, L from 1000 ml. */
function metricVolume(ml: number): Measure | null {
  const rounded = Math.round(ml);
  if (rounded >= 1000) return { amount: decimalText(ml / 1000), unit: 'L' };
  return rounded === 0 ? null : { amount: String(rounded), unit: 'ml' };
}

/** FR-004: cups from ¼ cup (nearest ¼), then tbsp, then tsp (nearest ½). */
function usVolume(ml: number): Measure | null {
  const cups = ml / ML_PER.cup;
  if (cups >= 0.25 || toStep(ml / ML_PER.tbsp, 0.5) >= 4) {
    const n = toStep(cups, 0.25);
    return { amount: fractionText(n), unit: n > 1 ? 'cups' : 'cup' };
  }
  return spoons(ml);
}

/** Decided on the rounded amount, so just under 1 tbsp reads "1 tbsp", not "3 tsp". */
function spoons(ml: number): Measure | null {
  const tsp = toStep(ml / ML_PER.tsp, 0.5);
  if (tsp >= 3) return { amount: fractionText(toStep(ml / ML_PER.tbsp, 0.5)), unit: 'tbsp' };
  return tsp === 0 ? null : { amount: fractionText(tsp), unit: 'tsp' };
}

/** Metric cooks still use spoons: they stay spoons up to ¼ cup, then become ml. */
function metricSpoons(ml: number): Measure | null {
  return ml >= ML_PER.cup / 4 ? metricVolume(ml) : spoons(ml);
}

function aPinch(noun: string): FormattedIngredient {
  return { amount: 'a pinch', unit: '', sub: null, phrase: `a pinch of ${noun}` };
}

function measured(m: Measure | null, noun: string): FormattedIngredient {
  return m ? { amount: m.amount, unit: m.unit, sub: null, phrase: `${text(m)} ${noun}` } : aPinch(noun);
}

interface Sizes {
  grams: Partial<Record<SizeWord, number>>;
  fallback: SizeWord;
}

/** The catalog's piece sizes, when there's a default to fit against and the item can be cut. */
function sizesOf(facts: IngredientFactsInput): Sizes | null {
  if (facts.whole_only || !facts.default_size) return null;
  const grams: Partial<Record<SizeWord, number>> = {};
  if (facts.size_small_g) grams.small = facts.size_small_g;
  if (facts.size_medium_g) grams.medium = facts.size_medium_g;
  if (facts.size_large_g) grams.large = facts.size_large_g;
  return grams[facts.default_size] ? { grams, fallback: facts.default_size } : null;
}

interface Nouns {
  one: string;
  many: string;
}

function nouns(ing: QuantityIngredient, facts: IngredientFactsInput): Nouns {
  const one = ing.piece_noun_singular ?? facts.noun_singular ?? lowerFirst(facts.name ?? ing.name);
  return { one, many: ing.piece_noun_plural ?? facts.noun_plural ?? lowerFirst(facts.plural ?? ing.name) };
}

/** How far the default size may be from the amount and still be chosen over a closer size. */
const DEFAULT_MARGIN = 0.1;

interface Candidate {
  count: number;
  size: SizeWord;
  word: boolean;
}

/**
 * FR-009: `grams` as the piece amount closest to it. Tiny amounts become spoons; below one piece
 * of the default size, ¼, ½ or ¾ of it or one whole piece of any size; from there on, whole and
 * half default pieces or whole pieces of the other sizes. The default size is preferred whenever
 * it is within 10% of the amount. The brackets keep the actual weight.
 */
function pieceFit(grams: number, ing: QuantityIngredient, facts: IngredientFactsInput, sizes: Sizes, options: FormatOptions): FormattedIngredient {
  const { grams: g, fallback } = sizes;
  const def = g[fallback] as number;
  const w = weight(grams, options.system);
  const bracket = options.scale && w ? ` (${text(w)})` : '';
  const sub = options.scale && w ? text(w) : null;

  if (grams < Math.min((0.9 * def) / 4, g.small ? 0.9 * g.small : Infinity)) {
    const noun = lowerFirst(facts.plural ?? ing.name);
    const ml = grams / (facts.density_g_per_ml ?? WATER_G_PER_ML);
    const v = options.system === 'metric' ? metricSpoons(ml) : usVolume(ml);
    if (!v) return aPinch(noun);
    return { amount: v.amount, unit: v.unit, sub, phrase: `${text(v)} of ${noun}${bracket}` };
  }

  const others = (Object.keys(g) as SizeWord[]).filter((s) => s !== fallback);
  let candidates: Candidate[];
  if (grams < def) {
    candidates = [
      { count: 1, size: fallback, word: true },
      ...[0.75, 0.5, 0.25].map((count) => ({ count, size: fallback, word: false })),
      ...others.map((size) => ({ count: 1, size, word: true })),
    ];
  } else {
    const more = others.map((size) => ({ count: Math.max(1, Math.round(grams / (g[size] as number))), size, word: true }));
    candidates = [{ count: Math.max(1, toStep(grams / def, 0.5)), size: fallback, word: true }, ...more.sort((a, b) => a.count - b.count)];
  }
  const closest = (list: Candidate[]) => {
    let best = list[0] as Candidate;
    let bestOff = Infinity;
    for (const c of list) {
      const off = Math.abs(c.count * (g[c.size] as number) - grams);
      if (off < bestOff - 1e-9) [best, bestOff] = [c, off];
    }
    return { best, off: bestOff };
  };
  // The default size wins whenever it is within 10% of the amount, even if another size is closer.
  const byDefault = closest(candidates.filter((c) => c.size === fallback));
  const best = byDefault.off <= DEFAULT_MARGIN * grams + 1e-9 ? byDefault.best : closest(candidates).best;

  const n = nouns(ing, facts);
  const amount = fractionText(best.count);
  // The default size goes unsaid ("2½ leeks"); only another size is named ("1 large onion").
  const unit = best.word && best.size !== fallback ? best.size : '';
  return { amount, unit, sub, phrase: `${amount}${unit ? ` ${unit}` : ''} ${best.count > 1 ? n.many : n.one}${bracket}` };
}

/** The weight of one piece: the snapshot saved with the recipe, else the catalog's size for it. */
export function pieceWeight(ing: QuantityIngredient): number | null {
  const f = ing.facts;
  const size = ing.size_word ?? f?.default_size;
  const catalog = size === 'small' ? f?.size_small_g : size === 'large' ? f?.size_large_g : size === 'medium' ? f?.size_medium_g : null;
  return ing.weight_per_piece_g ?? catalog ?? null;
}

/** FR-002: how an ingredient reads in the list and in steps. */
export function format(ing: QuantityIngredient, options: FormatOptions): FormattedIngredient {
  const q = ing.quantity;
  if (q == null && ing.unit != null) throw new QuantityError('invalid_quantity', `"${ing.name}" has a unit but no amount`);
  if (q == null || q === 0) return { amount: '', unit: '', sub: null, phrase: ing.name };
  assertAmount(q, `The amount of "${ing.name}"`);

  const facts = ing.facts ?? {};
  const unit = ing.unit ?? 'piece';
  const noun = lowerFirst(ing.name);
  const kind = kindOf(unit);
  const sizes = sizesOf(facts);

  if (kind === 'pinch') {
    const n = Math.max(1, Math.round(q));
    const m = { amount: String(n), unit: n === 1 ? 'pinch' : 'pinches' };
    return { ...m, sub: null, phrase: `${text(m)} of ${noun}` };
  }

  if (kind === 'volume') {
    const ml = toBase(q, unit);
    const m = options.system === 'imperial' ? usVolume(ml) : unit === 'tsp' || unit === 'tbsp' ? metricSpoons(ml) : metricVolume(ml);
    // A volume shows its weight as the sub-line when the density is known, like pieces do.
    const density = facts.density_g_per_ml;
    const w = m && options.scale && density ? weight(ml * density, options.system) : null;
    return { ...measured(m, noun), sub: w ? text(w) : null };
  }

  if (kind === 'weight') {
    const grams = toBase(q, unit);
    if (sizes) return pieceFit(grams, ing, facts, sizes, options);
    const density = facts.density_g_per_ml;
    if (!options.scale && density) {
      const v = usVolume(grams / density);
      if (v) return measured({ amount: `about ${v.amount}`, unit: v.unit }, noun);
    }
    return measured(weight(grams, options.system), noun);
  }

  const perPiece = pieceWeight(ing);
  if (sizes && perPiece && Math.abs(q - Math.round(q)) > 1e-9) return pieceFit(q * perPiece, ing, facts, sizes, options);

  const count = Math.max(0.5, toStep(q, 0.5));
  const n = nouns(ing, facts);
  const amount = fractionText(count);
  // As in pieceFit: the catalog's default size goes unsaid.
  const size = ing.size_word && ing.size_word !== facts.default_size ? ing.size_word : '';
  const w = options.scale && perPiece ? weight(q * perPiece, options.system) : null;
  const sub = w ? text(w) : null;
  return {
    amount,
    unit: size,
    sub,
    phrase: `${amount}${size ? ` ${size}` : ''} ${count > 1 ? n.many : n.one}${sub ? ` (${sub})` : ''}`,
  };
}
