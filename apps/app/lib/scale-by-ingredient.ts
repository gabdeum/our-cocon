import { groupSameIngredient, kindOf, pieceWeight, QuantityError, scale, sumIngredients, type FormatOptions } from '@cocon/quantity';
import type { VariantChoice } from '@cocon/schemas';
import type { Unit } from '@cocon/schemas/recipes';
import { strings } from '../strings/en';
import type { RecipeDetail } from './recipe';
import type { RecipeChoices, ScaledBy } from './recipe-choices';
import { appliedIngredients, mergedLine, rowScale, scaleRecipe, servingsText } from './recipe-view';

const s = strings.scaleSheet;

/** OC-ScaleIng: ingredients listed before "Show all {n} ingredients" (FR-003). */
export const INGREDIENTS_SHOWN = 3;
/** Scaled amounts in the preview. */
const PREVIEW_AMOUNTS = 4;
/** "That's a big change" outside these factors. */
export const BIG_CHANGE = { below: 0.25, above: 4 } as const;

const WEIGHTS: Unit[] = ['g', 'kg', 'oz', 'lb'];
const VOLUMES: Unit[] = ['ml', 'l', 'tsp', 'tbsp', 'cup'];

export interface ScaleCandidate {
  id: string;
  /** "Bacon lardons", "Large eggs". */
  name: string;
  /** What the page shows now: "200 g", "3 (150 g)". */
  current: string;
  /** Only units that match it (edge cases): no ml for lardons. */
  units: Unit[];
  unit: Unit;
}

type Recipe = Pick<RecipeDetail, 'serves' | 'ingredients' | 'steps' | 'variants' | 'facts'>;

/**
 * The ingredients you can scale by (FR-003), as the list shows them: those with an amount, never a
 * pinch. Pieces take a count, or a weight when one piece's weight is known. A line of several rows
 * scales by their total, so it's offered only when they add up.
 */
export function scaleCandidates(recipe: Recipe, choices: RecipeChoices, options: FormatOptions): ScaleCandidate[] {
  const scaled = scaleRecipe(recipe.serves, appliedIngredients(recipe, choices), choices).ingredients;
  return groupSameIngredient(scaled).flatMap((rows) => {
    const [ing] = rows;
    const own = ing?.unit ?? 'piece';
    if (!ing?.quantity || kindOf(own) === 'pinch') return [];
    if (rows.length > 1 && !(sumIngredients(rows) && rowScale({ ingredientId: ing.id, amount: 1, unit: own }, rows))) return [];
    const units = kindOf(own) === 'weight' ? WEIGHTS : kindOf(own) === 'volume' ? VOLUMES : pieceWeight(ing) ? ['piece' as const, ...WEIGHTS] : ['piece' as const];
    const line = mergedLine(rows, options);
    return [{ id: ing.id, name: line.name, current: line.sub ? `${line.amount} (${line.sub})` : line.amount, units, unit: own }];
  });
}

export interface ScalePreview {
  /** "1.25" */
  factor: string;
  /** "Recipe × 1.25 → about 7½ servings" */
  result: string;
  /** "Leeks 2½ (375 g) · Eggs 4 (190 g) · …" */
  amounts: string;
  /** Whole items are rounded; cooking times stay the same. */
  note: string;
  /** "That's a big change. Check cooking times." when the factor is under ¼ or over 4. */
  warning: string | null;
}

const list = (names: string[]) => (names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')}${s.and}${names.at(-1)}`);

/**
 * The sheet's result card for `by`, from the recipe as written (its own servings), or null when
 * there's nothing to scale by (empty or 0, or an amount that can't be used).
 */
export function scalePreview(recipe: Recipe, choice: VariantChoice, by: ScaledBy, options: FormatOptions): ScalePreview | null {
  if (!(by.amount > 0)) return null;
  const ingredients = appliedIngredients(recipe, choice);
  const row = rowScale(by, ingredients);
  if (!row) return null;
  let scaled;
  try {
    scaled = scale({ serves: recipe.serves, ingredients }, row);
  } catch (e) {
    if (e instanceof QuantityError) return null;
    throw e;
  }
  const others = groupSameIngredient(scaled.ingredients).filter((g) => g[0]?.id !== by.ingredientId && g.some((i) => i.quantity && kindOf(i.unit ?? 'piece') !== 'pinch'));
  const amounts = others.slice(0, PREVIEW_AMOUNTS).map((g) => {
    const line = mergedLine(g, options);
    return `${line.name} ${line.amount}${line.sub ? ` (${line.sub})` : ''}`;
  });
  const whole = others.filter((g) => g[0]?.facts?.whole_only).map((g) => mergedLine(g, options).name);
  const factor = String(Number(scaled.factor.toFixed(2)));
  return {
    factor,
    result: s.result(factor, servingsText(scaled.servings)),
    amounts: amounts.join(' · '),
    note: whole.length ? s.rounded(list(whole)) : s.timesSame,
    warning: scaled.factor < BIG_CHANGE.below || scaled.factor > BIG_CHANGE.above ? s.bigChange : null,
  };
}

/** "250", "1,5", " 2.5 " → a number; anything else (or nothing) → null. */
export function parseAmount(text: string): number | null {
  const t = text.trim().replace(',', '.');
  if (!/^\d*\.?\d+$|^\d+\.$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
