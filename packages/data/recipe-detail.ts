import { parseVariantChanges, type IngredientRow, type RecipeVariant, type StepRow } from '@cocon/schemas';
import type { IngredientFactsInput } from '@cocon/quantity';
import type { Db } from './client';

/**
 * One recipe with everything its page needs (spec 008), shared by the app and the MCP server's
 * get_recipe (023), so both read a recipe the same way.
 */
export interface RecipeDetail {
  id: string;
  name: string;
  description: string | null;
  serves: number;
  total_minutes: number | null;
  cuisine: string | null;
  best_months: number[];
  photo_path: string | null;
  created_by: string | null;
  source: string;
  /** Set when someone deleted it while it was open ("This recipe was deleted by {name}."). */
  deleted_at: string | null;
  deleted_by: string | null;
  ingredients: IngredientRow[];
  steps: StepRow[];
  variants: RecipeVariant[];
  /** Catalog facts with the family's corrections (spec 031), by catalog key. */
  facts: Record<string, IngredientFactsInput>;
}

const ingredientColumns =
  'id, position, name, catalog_key, quantity, unit, size_word, weight_per_piece_g, piece_noun_singular, piece_noun_plural, prep_note';
const stepColumns = 'id, position, name, body, timer_seconds, timer_label, temp_check_c, temp_check_text, tip, photo_path';
const columns = `id, name, description, serves, total_minutes, cuisine, best_months, photo_path, created_by, source, deleted_at, deleted_by,
  recipe_ingredients(${ingredientColumns}), recipe_steps(${stepColumns}), recipe_variants(id, position, name, kind, changes)`;

const byPosition = (a: { position: number }, b: { position: number }) => a.position - b.position;

/** Drops the position, now that rows are in order: what applyVariants and the quantity engine read. */
function withoutPosition<T extends { position: number }>({ position: _position, ...row }: T): Omit<T, 'position'> {
  return row;
}

/** The recipe (RLS returns it only to its family), or null when there's no such recipe for them. */
export async function loadRecipe(client: Pick<Db, 'from'>, id: string): Promise<RecipeDetail | null> {
  const { data, error } = await client.from('recipes').select(columns).eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { recipe_ingredients, recipe_steps, recipe_variants, ...recipe } = data;
  const variants = [...recipe_variants].sort(byPosition).map((v) => ({ ...v, changes: parseVariantChanges(v.changes) }));

  const keys = new Set<string>();
  for (const i of recipe_ingredients) if (i.catalog_key) keys.add(i.catalog_key);
  for (const v of variants)
    for (const c of v.changes) {
      if (c.type === 'swap_ingredient') for (const w of c.with) if (w.catalog_key) keys.add(w.catalog_key);
      if (c.type === 'add_ingredient' && c.ingredient.catalog_key) keys.add(c.ingredient.catalog_key);
    }

  return {
    ...recipe,
    ingredients: [...recipe_ingredients].sort(byPosition).map(withoutPosition),
    steps: [...recipe_steps].sort(byPosition).map(withoutPosition),
    variants,
    facts: await loadFacts(client, [...keys]),
  };
}

/** Catalog facts with the family's corrections, by key (also the recipe form's, spec 015). */
export async function loadFacts(client: Pick<Db, 'from'>, keys: string[]): Promise<Record<string, IngredientFactsInput>> {
  if (keys.length === 0) return {};
  const { data, error } = await client
    .from('ingredient_facts')
    .select('catalog_key, name, plural, density_g_per_ml, size_small_g, size_medium_g, size_large_g, default_size, noun_singular, noun_plural, whole_only')
    .in('catalog_key', keys);
  if (error) throw error;
  const facts: Record<string, IngredientFactsInput> = {};
  for (const { catalog_key, ...row } of data) if (catalog_key) facts[catalog_key] = row;
  return facts;
}
