import type { Unit } from '@cocon/schemas/recipes';
import { QuantityError, assertAmount } from './errors';
import { pieceWeight } from './format';
import type { QuantityIngredient } from './types';
import { convert, kindOf } from './units';

export interface ScalableRecipe<I extends QuantityIngredient = QuantityIngredient> {
  serves: number;
  ingredients: I[];
}

export type ScaleBy = { servings: number } | { ingredientId: string; amount: number; unit: Unit };

export interface Scaled<I extends QuantityIngredient = QuantityIngredient> {
  factor: number;
  /** Unrounded ("about 7½ servings" is the caller's wording). */
  servings: number;
  ingredients: I[];
}

/** `amount` of `unit` in the ingredient's own unit, or why it can't be. */
function inIngredientUnit(ing: QuantityIngredient, amount: number, unit: Unit): number {
  const own = ing.unit ?? 'piece';
  if (kindOf(own) === 'pinch' || kindOf(unit) === 'pinch') throw new QuantityError('incompatible_units', `Can't scale by a pinch of "${ing.name}"`);
  const perPiece = pieceWeight(ing);
  if (own === 'piece' && unit !== 'piece') {
    if (!perPiece || kindOf(unit) !== 'weight') throw new QuantityError('incompatible_units', `"${ing.name}" is counted in pieces`);
    return convert(amount, unit, 'g') / perPiece;
  }
  if (own !== 'piece' && unit === 'piece') throw new QuantityError('incompatible_units', `"${ing.name}" isn't counted in pieces`);
  return convert(amount, unit, own, ing.facts?.density_g_per_ml);
}

/**
 * FR-001: a recipe at another serving size, or scaled so one ingredient matches what you have.
 * Scaling by an ingredient rounds whole-only items (eggs) to whole numbers (spec 013).
 */
export function scale<I extends QuantityIngredient>(recipe: ScalableRecipe<I>, by: ScaleBy): Scaled<I> {
  if (!Number.isFinite(recipe.serves) || recipe.serves <= 0) throw new QuantityError('invalid_quantity', `Serves must be more than 0, got ${recipe.serves}`);
  let factor: number;
  const byIngredient = 'ingredientId' in by;
  if (byIngredient) {
    const ing = recipe.ingredients.find((i) => i.id === by.ingredientId);
    if (!ing) throw new QuantityError('unknown_ingredient', `No ingredient ${by.ingredientId} in this recipe`);
    if (!ing.quantity) throw new QuantityError('invalid_quantity', `"${ing.name}" has no amount to scale by`);
    assertAmount(by.amount);
    if (by.amount === 0) throw new QuantityError('invalid_quantity', 'Enter how much you have');
    factor = inIngredientUnit(ing, by.amount, by.unit) / ing.quantity;
  } else {
    if (!Number.isFinite(by.servings) || by.servings <= 0) throw new QuantityError('invalid_quantity', `Servings must be more than 0, got ${by.servings}`);
    factor = by.servings / recipe.serves;
  }

  const ingredients = recipe.ingredients.map((ing) => {
    if (ing.quantity == null) return ing;
    let quantity = ing.quantity * factor;
    if (byIngredient && ing.facts?.whole_only) quantity = Math.max(1, Math.round(quantity));
    return { ...ing, quantity };
  });
  return { factor, servings: recipe.serves * factor, ingredients };
}
