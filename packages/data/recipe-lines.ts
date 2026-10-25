import { applyVariants, ingredientName, type Applied, type IngredientRow, type Unit, type VariantChoice } from '@cocon/schemas';
import {
  firstRowShare,
  format,
  fractionText,
  groupSameIngredient,
  QuantityError,
  scale,
  sumIngredients,
  toStep,
  type FormatOptions,
  type QuantityIngredient,
  type Scaled,
} from '@cocon/quantity';
import type { RecipeDetail } from './recipe-detail';

/**
 * A recipe's ingredient list as the page shows it (specs 008, 013), shared by the app and the MCP
 * server's add_recipe_to_groceries (spec 024), so both put the same lines on the grocery list.
 */

/** "Scale by an ingredient" (spec 013): what you have of one ingredient. */
export interface ScaledBy {
  ingredientId: string;
  amount: number;
  unit: Unit;
}

/** Servings after a scale by an ingredient, to the nearest ½: "7½". */
export const servingsText = (servings: number) => fractionText(Math.max(0.5, toStep(servings, 0.5)));

export interface IngredientLine {
  /** Its first row's id. */
  id: string;
  /** Every row the line stands for: one, or several of the same ingredient ("Onion (sauce)", "Onion (topping)"). */
  ids: string[];
  /** The 104 px amount column: "300 ml", "3", "1 pinch"; "250 g + 2 tbsp" when rows don't add up. */
  amount: string;
  /** The name cooks read, without brackets or what follows a comma: "Mushrooms", "Large eggs". */
  name: string;
  /** The row's full name, as the form shows it: "Large eggs (glaze)". */
  fullName: string;
  /** Pieces' weight: "300 g". */
  sub: string | null;
  variant: boolean;
}

const upperFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const sizeWords = new Set(['small', 'medium', 'large']);

export type LineIngredient = Applied<IngredientRow> & QuantityIngredient;

/**
 * How one ingredient reads in the list (FR-004), from the quantity engine. A size word ("large")
 * moves from the amount to the name ("3" · "Large eggs"). Brackets and how it's prepared stay out
 * of the list; steps say how it's prepared.
 */
export function ingredientLine(ing: LineIngredient, options: FormatOptions): IngredientLine {
  const f = format(ing, options);
  const size = sizeWords.has(f.unit) ? f.unit : null;
  const amount = size ? f.amount : [f.amount, f.unit].filter(Boolean).join(' ');
  const sized = (name: string) => (size ? `${upperFirst(size)} ${name.charAt(0).toLowerCase()}${name.slice(1)}` : name);
  return { id: ing.id, ids: [ing.id], amount, name: sized(ingredientName(ing.name)), fullName: sized(ing.name), sub: f.sub, variant: ing.fromVariant };
}

/**
 * Rows of one ingredient (`groupSameIngredient`) as one line: their amounts added up, or side by
 * side ("250 g + 2 tbsp") when they don't add up. A Variant tag when any row is a variant's.
 */
export function mergedLine(rows: LineIngredient[], options: FormatOptions): IngredientLine {
  const [first] = rows;
  if (!first) throw new Error('mergedLine needs a row');
  if (rows.length === 1) return ingredientLine(first, options);
  const ids = rows.map((r) => r.id);
  const variant = rows.some((r) => r.fromVariant);
  const sum = sumIngredients(rows);
  if (sum) return { ...ingredientLine(sum, options), id: first.id, ids, name: ingredientLine(first, options).name, variant };
  const lines = rows.map((r) => ingredientLine(r, options));
  return { ...ingredientLine(first, options), ids, amount: lines.map((l) => l.amount).filter(Boolean).join(' + '), sub: null, variant };
}

/**
 * A scale by an ingredient as the engine takes it (spec 013). A line of several rows scales by
 * their total: its first row takes its share of the amount. Null when the line isn't in the recipe
 * (any more) or its amounts don't add up.
 */
export function rowScale<I extends QuantityIngredient & { catalog_key?: string | null }>(by: ScaledBy, ingredients: I[]): ScaledBy | null {
  const group = groupSameIngredient(ingredients).find((g) => g[0]?.id === by.ingredientId);
  if (!group) return null;
  if (group.length === 1) return by;
  const share = firstRowShare(group);
  return share ? { ...by, amount: by.amount * share } : null;
}

/** The page's scale: the stepper's servings, or a scale by an ingredient (spec 013). */
export interface PageScale {
  servings: number;
  scaledBy: ScaledBy | null;
}

/**
 * Scales by the ingredient when it's still in the recipe and its unit still fits (a variant or an
 * edit may have changed it); otherwise by the stepper's servings.
 */
export function scaleRecipe<I extends QuantityIngredient & { catalog_key?: string | null }>(serves: number, ingredients: I[], page: PageScale): Scaled<I> & { by: ScaledBy | null } {
  const { scaledBy } = page;
  const by = scaledBy && rowScale(scaledBy, ingredients);
  if (scaledBy && by) {
    try {
      return { ...scale({ serves, ingredients }, by), by: scaledBy };
    } catch (e) {
      if (!(e instanceof QuantityError)) throw e;
    }
  }
  return { ...scale({ serves, ingredients }, { servings: page.servings }), by: null };
}

/** Applied ingredients, each with its catalog facts. */
export const withFacts = (recipe: Pick<RecipeDetail, 'facts'>, applied: Applied<IngredientRow>[]) => applied.map((i) => ({ ...i, facts: i.catalog_key ? recipe.facts[i.catalog_key] : null }));

/** The recipe's ingredients after variants, each with its catalog facts. */
export function appliedIngredients(recipe: Pick<RecipeDetail, 'ingredients' | 'steps' | 'variants' | 'facts'>, choice: VariantChoice) {
  return withFacts(recipe, applyVariants(recipe, recipe.variants, choice).ingredients);
}
