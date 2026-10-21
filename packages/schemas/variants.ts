import { MAX_VARIANT_CHANGES, VariantChange, type IngredientRow, type StepRow, type VariantKind } from './recipes';

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
 * When a swap brings in exactly one ingredient under a new id, the steps' tokens for the old one
 * follow it ("Add {ing:lardons}" reads "Add 250 g mushrooms", spec 009). A swap to several
 * ingredients leaves the token alone: the variant rewrites that step, or it reads as missing.
 */
export function applyVariants(
  base: { ingredients: readonly IngredientRow[]; steps: readonly StepRow[] },
  variants: readonly RecipeVariant[],
  choice: VariantChoice,
): AppliedRecipe {
  let ingredients: Applied<IngredientRow>[] = base.ingredients.map((i) => ({ ...i, fromVariant: false }));
  let steps: Applied<StepRow>[] = base.steps.map((s) => ({ ...s, fromVariant: false }));
  const renamed = new Map<string, string>();

  for (const variant of activeVariants(variants, choice)) {
    variant.changes.forEach((change, index) => {
      switch (change.type) {
        case 'swap_ingredient': {
          const at = ingredients.findIndex((i) => i.id === change.ingredient_id);
          if (at < 0) return;
          ingredients = [...ingredients.slice(0, at), ...change.with.map((i) => ({ ...i, fromVariant: true })), ...ingredients.slice(at + 1)];
          const only = change.with.length === 1 ? change.with[0] : undefined;
          if (only && only.id !== change.ingredient_id) renamed.set(change.ingredient_id, only.id);
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
          // FR-004: a changed step carries the Variant tag too.
          const { type: _type, step_id, ...fields } = change;
          steps = steps.map((s) => (s.id === step_id ? { ...s, ...fields, fromVariant: true } : s));
          return;
        }
        case 'remove_step':
          steps = steps.filter((s) => s.id !== change.step_id);
          return;
      }
    });
  }
  if (renamed.size === 0) return { ingredients, steps };
  // Follow chains (a swapped-in ingredient swapped again by a later variant) to the last id.
  const target = (id: string) => {
    let to = id;
    for (let hops = 0; renamed.has(to) && hops < renamed.size; hops++) to = renamed.get(to) as string;
    return to;
  };
  const retoken = (body: string) => body.replace(/\{ing:([^{}\s:]+)\}/g, (token, id: string) => (renamed.has(id) ? `{ing:${target(id)}}` : token));
  return { ingredients, steps: steps.map((s) => ({ ...s, body: retoken(s.body) })) };
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

/** A variant's changes that are valid today; one bad change (an older shape) doesn't hide the rest. */
export function parseVariantChanges(changes: unknown): VariantChange[] {
  if (!Array.isArray(changes)) return [];
  // The same cap as VariantInput, so an oversized row can't slow every open.
  return changes.slice(0, MAX_VARIANT_CHANGES).flatMap((c) => {
    const parsed = VariantChange.safeParse(c);
    return parsed.success ? [parsed.data] : [];
  });
}

/** The base row a change points at: an ingredient or a step, by id. */
export function changeTarget(change: VariantChange): { ingredient: string } | { step: string } {
  switch (change.type) {
    case 'swap_ingredient':
    case 'remove_ingredient':
      return { ingredient: change.ingredient_id };
    case 'add_ingredient':
      // Added at the end: it points at nothing, so it can't break. Its own id stands in.
      return { ingredient: change.ingredient.id };
    default:
      return { step: change.step_id };
  }
}

/**
 * The changes (by index) that point at an ingredient or step the base recipe no longer has
 * (edge case: shown as broken in the editor, skipped on the page by `applyVariants`).
 */
export function brokenChanges(base: { ingredients: readonly { id: string }[]; steps: readonly { id: string }[] }, changes: readonly VariantChange[]): number[] {
  const ingredients = new Set(base.ingredients.map((i) => i.id));
  const steps = new Set(base.steps.map((s) => s.id));
  return changes.flatMap((change, index) => {
    if (change.type === 'add_ingredient') return [];
    const target = changeTarget(change);
    return 'ingredient' in target ? (ingredients.has(target.ingredient) ? [] : [index]) : steps.has(target.step) ? [] : [index];
  });
}

/** The key two changes clash on: replacing or removing the same ingredient, or changing or removing the same step. */
function clashKey(change: VariantChange): string | null {
  if (change.type === 'swap_ingredient' || change.type === 'remove_ingredient') return `i:${change.ingredient_id}`;
  if (change.type === 'change_step' || change.type === 'remove_step') return `s:${change.step_id}`;
  return null;
}

/**
 * For each variant (by id), the changes another variant also makes to the same ingredient or step,
 * with that variant's name: "Also changed by “Vegetarian”" (edge case). Only variants that can be on
 * together count: two versions never are. When both are on, the later in the list wins
 * (`applyVariants` applies them in order).
 */
export function variantConflicts(
  variants: readonly Pick<RecipeVariant, 'id' | 'name' | 'kind' | 'changes'>[],
): Record<string, Record<number, string[]>> {
  const out: Record<string, Record<number, string[]>> = {};
  for (const v of variants) {
    const mine: Record<number, string[]> = {};
    v.changes.forEach((change, index) => {
      const key = clashKey(change);
      if (!key) return;
      const others = variants
        .filter((o) => o.id !== v.id && !(o.kind === 'version' && v.kind === 'version') && o.changes.some((c) => clashKey(c) === key))
        .map((o) => o.name);
      if (others.length > 0) mine[index] = others;
    });
    out[v.id] = mine;
  }
  return out;
}
