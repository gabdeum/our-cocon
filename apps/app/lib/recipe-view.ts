import { applyVariants, cuisineOf, variantEffect, type Applied, type IngredientRow, type RecipeVariant, type VariantChoice } from '@cocon/schemas';
import { format, renderStep, renderTemperatureCheck, scale, type FormatOptions, type QuantityIngredient } from '@cocon/quantity';
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

/** Step text for StepCard: plain text, a highlighted amount, or the name of an ingredient that's gone. */
export type StepPart = string | { amount: string } | { missing: string };

export interface StepLine {
  /** The step's id; a variant's added step is `<variant id>:<change index>`. */
  id: string;
  /** 1…n after variants are applied, so numbering never skips. */
  number: number;
  name: string | null;
  variant: boolean;
  parts: StepPart[];
  /** "the center should reach 71 °C (160 °F) and barely wobble." Null when there's none or the thermometer setting is off. */
  tempCheck: string | null;
  timer: { seconds: number; label: string; clock: string } | null;
  tip: string | null;
}

export interface RecipeView {
  ingredients: IngredientLine[];
  steps: StepLine[];
  stepCount: number;
}

/** A timer's clock: "12:00", "05:30" (also the running clock, lib/timers.ts). */
export function timerClock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export interface CookingSettings {
  /** "I have a thermometer" (spec 027). Until that setting exists, it's on. */
  thermometer: boolean;
  /** "Keep screen on while cooking" (spec 027, used by cooking mode, 012). On until that setting exists. */
  keepAwake: boolean;
}
export const defaultCooking: CookingSettings = { thermometer: true, keepAwake: true };

/**
 * What the page shows for the chosen servings and variants (spec 008 FR-004, SC-002; spec 009
 * FR-001). Steps are filled from the same scaled ingredients as the list, so their amounts always
 * match it (009 SC-001).
 */
export function recipeView(
  recipe: Pick<RecipeDetail, 'serves' | 'ingredients' | 'steps' | 'variants' | 'facts'>,
  servings: number,
  choice: VariantChoice,
  options: FormatOptions = defaultFormat,
  cooking: Pick<CookingSettings, 'thermometer'> = defaultCooking,
): RecipeView {
  const applied = applyVariants(recipe, recipe.variants, choice);
  const withFacts = applied.ingredients.map((i) => ({ ...i, facts: i.catalog_key ? recipe.facts[i.catalog_key] : null }));
  const scaled = scale({ serves: recipe.serves, ingredients: withFacts }, { servings });
  const knownNames = ingredientNames(recipe);
  const steps = applied.steps.map((step, i): StepLine => ({
    id: step.id,
    number: i + 1,
    name: step.name ?? null,
    variant: step.fromVariant,
    parts: renderStep(step.body, scaled.ingredients, options).map((seg) =>
      seg.type === 'text' ? seg.text : seg.type === 'amount' ? { amount: seg.text } : { missing: knownNames.get(seg.ingredientId) ?? p.steps.missingIngredient },
    ),
    tempCheck: cooking.thermometer ? renderTemperatureCheck(step.temp_check_text ?? null, step.temp_check_c ?? null, options.system) : null,
    timer: step.timer_seconds ? { seconds: step.timer_seconds, label: step.timer_label ?? step.name ?? '', clock: timerClock(step.timer_seconds) } : null,
    tip: step.tip ?? null,
  }));
  return { ingredients: scaled.ingredients.map((i) => ingredientLine(i, options)), steps, stepCount: steps.length };
}

/** Every ingredient name the recipe has known, base and variants, for tokens whose ingredient is gone. */
function ingredientNames(recipe: Pick<RecipeDetail, 'ingredients' | 'variants'>): Map<string, string> {
  const names = new Map(recipe.ingredients.map((i) => [i.id, i.name]));
  for (const v of recipe.variants)
    for (const c of v.changes) {
      if (c.type === 'swap_ingredient') for (const i of c.with) names.set(i.id, i.name);
      else if (c.type === 'add_ingredient') names.set(c.ingredient.id, c.ingredient.name);
    }
  return names;
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
