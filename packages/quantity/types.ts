import type { SizeWord, Unit } from '@cocon/schemas/recipes';

/**
 * Ingredient facts from the catalog with the family's corrections (spec 031's `ingredient_facts`
 * view or a `match_ingredients` row). Passed in, never looked up here (FR-008).
 */
export interface IngredientFactsInput {
  density_g_per_ml?: number | null;
  size_small_g?: number | null;
  size_medium_g?: number | null;
  size_large_g?: number | null;
  default_size?: SizeWord | null;
  whole_only?: boolean | null;
  name?: string | null;
  plural?: string | null;
  noun_singular?: string | null;
  noun_plural?: string | null;
}

/** A recipe ingredient as stored (spec 004), plus its catalog facts when it has some. */
export interface QuantityIngredient {
  id: string;
  name: string;
  quantity?: number | null;
  unit?: Unit | null;
  size_word?: SizeWord | null;
  /** The weight of one piece when the recipe was saved (spec 031 snapshot). */
  weight_per_piece_g?: number | null;
  piece_noun_singular?: string | null;
  piece_noun_plural?: string | null;
  facts?: IngredientFactsInput | null;
}

export type UnitSystem = 'metric' | 'imperial';

export interface FormatOptions {
  system: UnitSystem;
  /** "I'm using a kitchen scale" (spec 013): off shows cups and spoons and drops piece weights. */
  scale: boolean;
}

/**
 * How one ingredient reads (FR-002). `amount` and `unit` fill the amount column ("300" "ml",
 * "½" "large"), `sub` is the weight sub-line, `phrase` is what steps embed ("2 leeks (300 g)").
 */
export interface FormattedIngredient {
  amount: string;
  unit: string;
  sub: string | null;
  phrase: string;
}
