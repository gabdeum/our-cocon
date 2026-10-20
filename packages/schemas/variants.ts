import type { IngredientRow, StepRow, VariantChange, VariantKind } from './recipes';

/**
 * Variants (decision 16: they change only ingredients and steps). The one place a recipe's chosen
 * variants are applied, for the recipe page (008, 009), cooking mode (012), "Add to groceries"
 * (022) and the MCP server (023).
 */
export interface RecipeVariant {
  id: string;
  position: number;
  name: string;
  kind: VariantKind;
  changes: VariantChange[];
}

/** What's picked: one version (null = the base recipe, "Classic") and any options switched on. */
export interface VariantChoice {
  version: string | null;
  options: readonly string[];
}

export const noVariants: VariantChoice = { version: null, options: [] };

/** A row as it reads with the chosen variants; `fromVariant` when a variant brought it in. */
export type Applied<T> = T & { fromVariant: boolean };

export interface AppliedRecipe {
  ingredients: Applied<IngredientRow>[];
  steps: Applied<StepRow>[];
}

/** The chosen variants that exist, in their saved order. Unknown ids are ignored. */
export function activeVariants(variants: readonly RecipeVariant[], choice: VariantChoice): RecipeVariant[] {
  return variants
    .filter((v) => (v.kind === 'version' ? v.id === choice.version : choice.options.includes(v.id)))
    .sort((a, b) => a.position - b.position);
}

/** A choice with only ids that still exist (a variant can be deleted while it's remembered). */
export function validChoice(variants: readonly RecipeVariant[], choice: VariantChoice): VariantChoice {
  const version = variants.some((v) => v.kind === 'version' && v.id === choice.version) ? choice.version : null;
  const options = choice.options.filter((id) => variants.some((v) => v.kind === 'option' && v.id === id));
  return { version, options: [...new Set(options)] };
}

/**
 * The recipe's ingredients and steps with the chosen variants applied in their saved order. A
 * change pointing at a row that isn't there (removed by an earlier change, or edited away) is
 * skipped, so a recipe always opens. An added step gets the id `<variant id>:<change index>`.
 */
export function applyVariants(
  base: { ingredients: readonly IngredientRow[]; steps: readonly StepRow[] },
  variants: readonly RecipeVariant[],
  choice: VariantChoice,
): AppliedRecipe {
  let ingredients: Applied<IngredientRow>[] = base.ingredients.map((i) => ({ ...i, fromVariant: false }));
  let steps: Applied<StepRow>[] = base.steps.map((s) => ({ ...s, fromVariant: false }));

  for (const variant of activeVariants(variants, choice)) {
    variant.changes.forEach((change, index) => {
      switch (change.type) {
        case 'swap_ingredient': {
          const at = ingredients.findIndex((i) => i.id === change.ingredient_id);
          if (at < 0) return;
          ingredients = [...ingredients.slice(0, at), ...change.with.map((i) => ({ ...i, fromVariant: true })), ...ingredients.slice(at + 1)];
          return;
        }
        case 'add_ingredient':
          ingredients = [...ingredients, { ...change.ingredient, fromVariant: true }];
          return;
        case 'remove_ingredient':
          ingredients = ingredients.filter((i) => i.id !== change.ingredient_id);
          return;
        case 'add_step': {
          const at = steps.findIndex((s) => s.id === change.step_id);
          if (at < 0) return;
          const added = { ...change.step, id: `${variant.id}:${index}`, fromVariant: true };
          const where = change.place === 'before' ? at : at + 1;
          steps = [...steps.slice(0, where), added, ...steps.slice(where)];
          return;
        }
        case 'change_step': {
          const { type: _type, step_id, ...fields } = change;
          steps = steps.map((s) => (s.id === step_id ? { ...s, ...fields } : s));
          return;
        }
        case 'remove_step':
          steps = steps.filter((s) => s.id !== change.step_id);
          return;
      }
    });
  }
  return { ingredients, steps };
}

export interface VariantEffect {
  ingredientsAdded: number;
  ingredientsRemoved: number;
  stepsAdded: number;
  stepsChanged: number;
  stepsRemoved: number;
}

/**
 * What a variant does, for its one-line hint ("Adds 3 ingredients and 1 step", spec 008 FR-002).
 * A swap counts what it brings in as added: the hint says what you'll need, not what goes.
 */
export function variantEffect(changes: readonly VariantChange[]): VariantEffect {
  const effect: VariantEffect = { ingredientsAdded: 0, ingredientsRemoved: 0, stepsAdded: 0, stepsChanged: 0, stepsRemoved: 0 };
  for (const change of changes) {
    if (change.type === 'swap_ingredient') effect.ingredientsAdded += change.with.length;
    else if (change.type === 'add_ingredient') effect.ingredientsAdded += 1;
    else if (change.type === 'remove_ingredient') effect.ingredientsRemoved += 1;
    else if (change.type === 'add_step') effect.stepsAdded += 1;
    else if (change.type === 'change_step') effect.stepsChanged += 1;
    else effect.stepsRemoved += 1;
  }
  return effect;
}
