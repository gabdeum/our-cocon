import { applyVariants, cuisineOf, DEFAULT_FAMILY_SETTINGS, resolveCooking, variantEffect, type CookingSettings, type RecipeVariant, type VariantChoice } from '@cocon/schemas';
import { groupSameIngredient, renderStep, renderTemperatureCheck, type FormatOptions, type QuantityIngredient } from '@cocon/quantity';
import { strings } from '../strings/en';
import type { Member } from './session';
import type { RecipeDetail } from './recipe';
import { formatTotalTime, recipeAuthor } from './recipe-format';
import type { RecipeChoices } from './recipe-choices';
import { mergedLine, scaleRecipe, withFacts, type IngredientLine, type LineIngredient, type PageScale } from '@cocon/data';

// Shared with the MCP server (spec 024): the ingredient list as the page shows it.
export { appliedIngredients, ingredientLine, mergedLine, rowScale, scaleRecipe, servingsText, type IngredientLine, type PageScale } from '@cocon/data';

const p = strings.recipePage;

/** Metric with a kitchen scale: the family defaults before anyone changes them (the form's previews). */
export const defaultFormat: FormatOptions = { system: 'metric', scale: true };

/**
 * Units and the kitchen scale as the quantity engine takes them: the "…" panel's quick toggles on
 * this device (spec 013), else the settings in force (the recipe's or the family's, spec 027).
 */
export const formatOf = (choices: Pick<RecipeChoices, 'system' | 'kitchenScale'>, settings: FormatOptions = defaultFormat): FormatOptions => ({
  system: choices.system ?? settings.system,
  scale: choices.kitchenScale ?? settings.scale,
});

/** FR-001 / edge cases: 1–16 servings, or up to what the recipe serves when it's more. */
export const SERVINGS_MIN = 1;
export const servingsMax = (serves: number) => Math.max(16, serves);

/** The list (FR-004): one line per ingredient, where its first row is. */
export const ingredientLines = (rows: LineIngredient[], options: FormatOptions) => groupSameIngredient(rows).map((g) => mergedLine(g, options));

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
  /** The step's photo in storage (spec 009 FR-004; shown from spec 014). */
  photoPath: string | null;
}

export interface RecipeView {
  ingredients: IngredientLine[];
  steps: StepLine[];
  stepCount: number;
  /** Servings shown: the stepper's, or unrounded after a scale by an ingredient (7.5). */
  servings: number;
  /** The ingredient the recipe is scaled by (013), when that scale still applies. */
  scaledBy: IngredientLine | null;
}


/** A timer's clock: "12:00", "05:30" (also the running clock, lib/timers.ts). */
export function timerClock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export type { CookingSettings } from '@cocon/schemas';
/** The settings in force before the family's load: all on, in metric. */
export const defaultCooking: CookingSettings = resolveCooking(DEFAULT_FAMILY_SETTINGS);

/**
 * What the page shows for the chosen servings and variants (spec 008 FR-004, SC-002; spec 009
 * FR-001). Steps are filled from the same scaled ingredients as the list, so their amounts always
 * match it (009 SC-001).
 */
export function recipeView(
  recipe: Pick<RecipeDetail, 'serves' | 'ingredients' | 'steps' | 'variants' | 'facts'>,
  servings: number | PageScale,
  choice: VariantChoice,
  options: FormatOptions = defaultFormat,
  cooking: Pick<CookingSettings, 'thermometer'> = defaultCooking,
): RecipeView {
  const applied = applyVariants(recipe, recipe.variants, choice);
  const scaled = scaleRecipe(recipe.serves, withFacts(recipe, applied.ingredients), typeof servings === 'number' ? { servings, scaledBy: null } : servings);
  const knownNames = ingredientNames(recipe);
  const steps = applied.steps.map((step, i): StepLine => ({
    id: step.id,
    number: i + 1,
    name: step.name ?? null,
    variant: step.fromVariant,
    parts: stepParts(step.body, scaled.ingredients, options, knownNames),
    tempCheck: cooking.thermometer ? renderTemperatureCheck(step.temp_check_text ?? null, step.temp_check_c ?? null, options.system) : null,
    timer: step.timer_seconds ? { seconds: step.timer_seconds, label: step.timer_label ?? step.name ?? '', clock: timerClock(step.timer_seconds) } : null,
    tip: step.tip ?? null,
    photoPath: step.photo_path ?? null,
  }));
  const ingredients = ingredientLines(scaled.ingredients, options);
  const scaledBy = scaled.by ? (ingredients.find((i) => i.id === scaled.by?.ingredientId) ?? null) : null;
  return { ingredients, steps, stepCount: steps.length, servings: scaled.servings, scaledBy };
}

/**
 * A step's text as StepText draws it: plain text, amounts ("2 leeks (300 g)") and, for an
 * ingredient that's gone, the name it had (or "an ingredient"). The recipe page and the form's
 * Preview both use this, so a token reads the same in both (spec 016 SC-001).
 */
export function stepParts(body: string, ingredients: QuantityIngredient[], options: FormatOptions, names: ReadonlyMap<string, string>): StepPart[] {
  return renderStep(body, ingredients, options).map((seg) =>
    seg.type === 'text' ? seg.text : seg.type === 'amount' ? { amount: seg.text } : { missing: names.get(seg.ingredientId) ?? p.steps.missingIngredient },
  );
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
