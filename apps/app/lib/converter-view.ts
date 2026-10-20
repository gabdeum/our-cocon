import { convertUnits, densityHint, kindOf, type ConverterResultUnit, type ConverterTab, type ConverterUnit } from '@cocon/quantity';
import { strings } from '../strings/en';
import type { RecipeDetail } from './recipe';
import type { RecipeChoices } from './recipe-choices';
import { appliedIngredients } from './recipe-view';

const c = strings.convertSheet;

/** What the converter opens with (OC-Units › Behaviour): Volume, in ml. */
export const converterStart = { tab: 'volume', unit: 'ml' } as const satisfies { tab: ConverterTab; unit: ConverterUnit };
/** The unit picked when switching to a tab. */
export const tabStartUnit: Record<ConverterTab, ConverterUnit> = { weight: 'g', volume: 'ml', oven: 'c' };

export interface ResultTileView {
  unit: ConverterResultUnit;
  /** "1¼" */
  value: string;
  /** "cups" */
  label: string;
}

export interface ConverterView {
  tiles: ResultTileView[];
  /** The "For this recipe" sentence, or null when no ingredient matches. */
  forRecipe: string | null;
}

/** Singular for 1 and anything less ("¾ cup", "1 tablespoon"), plural above ("1¼ cups"). */
const countOf = (text: string) => (/^(1|¼|½|¾|0(\.\d+)?)$/.test(text) ? 1 : 2);
const lowerFirst = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);

/**
 * The recipe ingredient the converter talks about: the first measured in this tab's kind
 * (a volume or a weight) whose density is known, so it can go the other way.
 */
export function recipeIngredient(recipe: Pick<RecipeDetail, 'ingredients' | 'steps' | 'variants' | 'facts'>, choices: RecipeChoices, tab: ConverterTab) {
  if (tab === 'oven') return null;
  return (
    appliedIngredients(recipe, choices).find((i) => i.unit && kindOf(i.unit) === tab && (i.facts?.density_g_per_ml ?? 0) > 0) ?? null
  );
}

/** Result tiles and the recipe note for `value` (spec 013 FR-004/005; every number from `@cocon/quantity`). */
export function converterView(value: number | null, from: ConverterUnit, ingredient: { name: string; density: number } | null): ConverterView {
  if (value === null) return { tiles: [], forRecipe: null };
  const name = ingredient ? lowerFirst(ingredient.name) : '';
  const tiles = convertUnits(value, from, ingredient?.density).map((t) => ({
    unit: t.unit,
    value: t.text,
    label: t.unit === 'cups_of' ? strings.cupsOf(countOf(t.text), name) : strings.unitLong[t.unit](countOf(t.text)),
  }));
  const hint = ingredient ? densityHint(value, from, ingredient.density) : null;
  const typed = `${String(Number(value.toFixed(2)))} ${strings.unitShort[from]}`;
  const forRecipe = !hint
    ? null
    : hint.unit === 'cup'
      ? c.fills(typed, name, `${hint.text} ${strings.unitLong.cup(countOf(hint.text))}`)
      : c.weighs(typed, name, `${hint.text} ${hint.unit}`);
  return { tiles, forRecipe };
}
