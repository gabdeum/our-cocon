import { applyVariants, cuisineOf, variantEffect, type Applied, type IngredientRow, type RecipeVariant, type VariantChoice } from '@cocon/schemas';
import { format, scale, type FormatOptions, type QuantityIngredient } from '@cocon/quantity';
import { strings } from '../strings/en';
import type { Member } from './session';
import type { RecipeDetail } from './recipe';
import { formatTotalTime, recipeAuthor } from './recipe-format';

const p = strings.recipePage;

/**
 * Units and the kitchen scale for the recipe page. Until the recipe and family settings exist
 * (spec 027) and the "…" panel's scale switch (013), every recipe uses the screen's defaults.
 */
export const defaultFormat: FormatOptions = { system: 'metric', scale: true };

/** FR-001 / edge cases: 1–16 servings, or up to what the recipe serves when it's more. */
export const SERVINGS_MIN = 1;
export const servingsMax = (serves: number) => Math.max(16, serves);

export interface IngredientLine {
  id: string;
  /** The 104 px amount column: "300 ml", "3", "1 pinch". */
  amount: string;
  /** "Mushrooms, sliced", "Large eggs". */
  name: string;
  /** Pieces' weight: "300 g". */
  sub: string | null;
  variant: boolean;
}

const upperFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const sizeWords = new Set(['small', 'medium', 'large']);

/**
 * How one ingredient reads in the list (FR-004), from the quantity engine. A size word ("large")
 * moves from the amount to the name ("3" · "Large eggs"), and the prep note follows the name.
 */
export function ingredientLine(ing: Applied<IngredientRow> & QuantityIngredient, options: FormatOptions): IngredientLine {
  const f = format(ing, options);
  const size = sizeWords.has(f.unit) ? f.unit : null;
  const amount = size ? f.amount : [f.amount, f.unit].filter(Boolean).join(' ');
  const base = size ? `${upperFirst(size)} ${ing.name.charAt(0).toLowerCase()}${ing.name.slice(1)}` : ing.name;
  return { id: ing.id, amount, name: ing.prep_note ? `${base}, ${ing.prep_note}` : base, sub: f.sub, variant: ing.fromVariant };
}

export interface RecipeView {
  ingredients: IngredientLine[];
  stepCount: number;
}

/** What the page shows for the chosen servings and variants (FR-004, SC-002). */
export function recipeView(recipe: Pick<RecipeDetail, 'serves' | 'ingredients' | 'steps' | 'variants' | 'facts'>, servings: number, choice: VariantChoice, options: FormatOptions = defaultFormat): RecipeView {
  const applied = applyVariants(recipe, recipe.variants, choice);
  const withFacts = applied.ingredients.map((i) => ({ ...i, facts: i.catalog_key ? recipe.facts[i.catalog_key] : null }));
  const scaled = scale({ serves: recipe.serves, ingredients: withFacts }, { servings });
  return { ingredients: scaled.ingredients.map((i) => ingredientLine(i, options)), stepCount: applied.steps.length };
}

/** How many variants are on, for `variant_selected`. */
export const variantCount = (choice: VariantChoice) => (choice.version ? 1 : 0) + choice.options.length;

/**
 * "Best Oct – Mar" (FR-001): best months as runs, wrapping round the new year. Null when the
 * recipe is good all year (no months, or all twelve).
 */
export function bestMonthsLabel(months: readonly number[]): string | null {
  const set = new Set(months.filter((m) => m >= 1 && m <= 12));
  if (set.size === 0 || set.size === 12) return null;
  const has = (m: number) => set.has(((m - 1 + 12) % 12) + 1);
  // Start each run at a month whose previous month isn't in the set, in calendar order.
  const runs: [number, number][] = [];
  for (let m = 1; m <= 12; m++) {
    if (!set.has(m) || has(m - 1)) continue;
    let end = m;
    while (has(end + 1)) end = (end % 12) + 1;
    runs.push([m, end]);
  }
  const name = (m: number) => strings.monthsShort[m - 1] as string;
  if (runs.length === 1) {
    const [from, to] = runs[0] as [number, number];
    return from === to ? p.bestMonth(name(from)) : p.bestMonths(name(from), name(to));
  }
  return p.bestRuns(runs.map(([from, to]) => (from === to ? name(from) : p.monthRun(name(from), name(to)))));
}

/** The header's chips (FR-001): time, cuisine, best months, author. Empty ones are left out. */
export function recipeChips(recipe: Pick<RecipeDetail, 'total_minutes' | 'cuisine' | 'best_months' | 'created_by' | 'source'>, members: readonly Pick<Member, 'user_id' | 'display_name'>[]) {
  const cuisine = cuisineOf(recipe.cuisine);
  return {
    facts: [recipe.total_minutes ? formatTotalTime(recipe.total_minutes) : null, cuisine ? strings.cuisines[cuisine] : null, bestMonthsLabel(recipe.best_months)].filter(
      (c): c is string => c !== null,
    ),
    author: recipeAuthor(recipe.created_by, recipe.source, members),
  };
}

/** An option's one-line hint (FR-002): "Adds 3 ingredients and 1 step". Null when it changes nothing. */
export function optionHint(variant: Pick<RecipeVariant, 'changes'>): string | null {
  const e = variantEffect(variant.changes);
  const things = (ingredients: number, steps: number) =>
    [ingredients ? p.effect.ingredients(ingredients) : null, steps ? p.effect.steps(steps) : null].filter(Boolean).join(p.effect.and);
  const parts = [
    e.ingredientsAdded || e.stepsAdded ? p.effect.adds(things(e.ingredientsAdded, e.stepsAdded)) : null,
    e.ingredientsRemoved || e.stepsRemoved ? p.effect.removes(things(e.ingredientsRemoved, e.stepsRemoved)) : null,
    e.stepsChanged ? p.effect.changes(p.effect.steps(e.stepsChanged)) : null,
  ].filter(Boolean);
  return parts.length ? parts.join(p.effect.list) : null;
}
