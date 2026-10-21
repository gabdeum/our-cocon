import { cuisineOf, parseMinutes, RecipeInput, type Cuisine, type RecipeFormSection } from '@cocon/schemas';
import { strings } from '../strings/en';
import { loadFacts } from './recipe';
import type { ChoiceStorage } from './recipe-choices';
import { formatTotalTime } from './recipe-format';
import { saveIngredients, type FormFacts, type IngredientDraft, type IngredientSaveRow, type SavedIngredient } from './recipe-ingredients';
import type { SavedStep, StepSaveRow } from './recipe-steps';
import type { Client } from './supabase';

const f = strings.recipeForm;

/** The form's sections in order (spec 014 FR-001); each opens with `?section=`. */
export const FORM_SECTIONS: readonly RecipeFormSection[] = ['details', 'ingredients', 'steps', 'variants'];

/** A link's `?section=`, or Details for anything else. */
export function sectionOf(param: unknown): RecipeFormSection {
  return FORM_SECTIONS.find((s) => s === param) ?? 'details';
}

/** The section "Next: …" opens, or null on the last one ("Save recipe"). */
export function nextSection(section: RecipeFormSection): RecipeFormSection | null {
  return FORM_SECTIONS[FORM_SECTIONS.indexOf(section) + 1] ?? null;
}

/** Serves when the field is left empty: the database's default. */
export const DEFAULT_SERVES = 4;

/** The Details fields as typed (FR-002). Times and serves stay text until Save reads them. */
export interface DetailsForm {
  name: string;
  description: string;
  serves: string;
  totalTime: string;
  prepTime: string;
  cuisine: Cuisine | null;
  source: string;
  /** 1–12. */
  bestMonths: number[];
  photoPath: string | null;
}

/** A recipe's saved details, as the form loads them (`loadRecipeForm`). */
export interface RecipeDetails {
  id: string;
  name: string;
  description: string | null;
  serves: number;
  total_minutes: number | null;
  prep_minutes: number | null;
  cuisine: string | null;
  source_text: string | null;
  best_months: number[];
  photo_path: string | null;
  /** Spec 015: the ingredients and catalog facts by key; spec 016: the steps. */
  ingredients?: SavedIngredient[];
  steps?: SavedStep[];
  /** Photos the recipe's variants add with their steps: the form never removes these (spec 017 edits them). */
  variantPhotos?: string[];
  facts?: Record<string, FormFacts>;
}

const stepColumns = 'id, position, name, body, timer_seconds, timer_label, temp_check_c, temp_check_text, tip, photo_path';

const ingredientColumns =
  'id, position, name, catalog_key, quantity, unit, size_word, weight_per_piece_g, piece_noun_singular, piece_noun_plural, prep_note';

export const recipeFormKey = (familyId: string, id: string) => ['recipes', familyId, 'form', id] as const;

/** One recipe as the form edits it (RLS returns it only to its family), or null when it isn't there. */
export async function loadRecipeForm(client: Pick<Client, 'from'>, id: string): Promise<RecipeDetails | null> {
  const { data, error } = await client
    .from('recipes')
    .select(
      `id, name, description, serves, total_minutes, prep_minutes, cuisine, source_text, best_months, photo_path,
      recipe_ingredients(${ingredientColumns}), recipe_steps(${stepColumns}), recipe_variants(changes)`,
    )
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { recipe_ingredients, recipe_steps, recipe_variants, ...details } = data;
  const keys = [...new Set(recipe_ingredients.flatMap((i) => (i.catalog_key ? [i.catalog_key] : [])))];
  return {
    ...details,
    ingredients: recipe_ingredients,
    steps: recipe_steps,
    variantPhotos: recipe_variants.flatMap((v) => variantStepPhotos(v.changes)),
    facts: await loadFacts(client, keys),
  };
}

/** The photo paths a variant's added steps name. Read loosely: `changes` is jsonb an assistant may have written. */
function variantStepPhotos(changes: unknown): string[] {
  if (!Array.isArray(changes)) return [];
  return changes.flatMap((c: unknown) => {
    const path = (c as { type?: unknown; step?: { photo_path?: unknown } } | null)?.step?.photo_path;
    return (c as { type?: unknown } | null)?.type === 'add_step' && typeof path === 'string' ? [path] : [];
  });
}

/** The form's starting values: the recipe as saved, or an empty new recipe. */
export function formFromRecipe(recipe: RecipeDetails | null): DetailsForm {
  return {
    name: recipe?.name ?? '',
    description: recipe?.description ?? '',
    serves: String(recipe?.serves ?? DEFAULT_SERVES),
    totalTime: recipe?.total_minutes ? formatTotalTime(recipe.total_minutes) : '',
    prepTime: recipe?.prep_minutes ? formatTotalTime(recipe.prep_minutes) : '',
    cuisine: cuisineOf(recipe?.cuisine),
    source: recipe?.source_text ?? '',
    bestMonths: [...(recipe?.best_months ?? [])].sort((a, b) => a - b),
    photoPath: recipe?.photo_path ?? null,
  };
}

/** Whether Cancel should ask before throwing the edits away (US3). */
export function isDirty(start: DetailsForm, now: DetailsForm): boolean {
  const norm = (d: DetailsForm) => JSON.stringify({ ...d, bestMonths: [...d.bestMonths].sort((a, b) => a - b) });
  return norm(start) !== norm(now);
}

export type DetailsField = 'name' | 'serves' | 'totalTime' | 'prepTime';
export type DetailsWarnings = Partial<Record<DetailsField, string>>;

/**
 * What Save sends, or the warnings to show (OC-EditBasics › Validation copy). Only the name is
 * required; an empty Serves is 4, empty times are none.
 */
export function readDetails(form: DetailsForm): { input: RecipeInput } | { warnings: DetailsWarnings } {
  const warnings: DetailsWarnings = {};
  const name = form.name.trim();
  if (!name) warnings.name = f.nameMissing;
  const servesText = form.serves.trim();
  const serves = servesText === '' ? DEFAULT_SERVES : /^\d+$/.test(servesText) ? Number(servesText) : NaN;
  if (!(serves >= 1 && serves <= 50)) warnings.serves = f.servesInvalid;
  const total = parseMinutes(form.totalTime);
  if (total === 'invalid') warnings.totalTime = f.timeInvalid;
  const prep = parseMinutes(form.prepTime);
  if (prep === 'invalid') warnings.prepTime = f.timeInvalid;
  if (Object.keys(warnings).length > 0) return { warnings };
  const parsed = RecipeInput.safeParse({
    name,
    description: form.description.trim() || null,
    serves,
    total_minutes: total === 'invalid' ? null : total,
    prep_minutes: prep === 'invalid' ? null : prep,
    cuisine: form.cuisine,
    source_text: form.source.trim() || null,
    best_months: [...form.bestMonths].sort((a, b) => a - b),
    photo_path: form.photoPath,
  });
  // The fields' own limits (maxLength) keep text within the schema; this is the last word. No
  // warning fits anything else, so the form says it couldn't save.
  if (!parsed.success) return { warnings: parsed.error.issues.some((i) => i.path[0] === 'name') ? { name: f.nameMissing } : {} };
  return { input: parsed.data };
}

/**
 * Saves the details: a new recipe with the id the form made (its photo is already under it), or an
 * edit. Then the ingredients (spec 015) and the steps (spec 016), each when they changed: steps
 * last, as they mention the ingredients. `created` says the recipe now exists even if a later part
 * failed, so trying again updates it instead of adding it twice; `detailsSaved` says the details
 * (and so the header photo) were written, whatever happened after.
 */
export async function saveRecipe(
  client: Pick<Client, 'from' | 'rpc'>,
  target: { id: string; familyId: string; isNew: boolean },
  input: RecipeInput,
  ingredients?: { rows: IngredientSaveRow[]; drafts: IngredientDraft[] },
  steps?: StepSaveRow[],
): Promise<{ ok: boolean; created: boolean; detailsSaved: boolean }> {
  const { id, familyId, isNew } = target;
  try {
    // The database sets the family from who's signed in, whatever is sent (spec 004).
    const { error } = isNew
      ? await client.from('recipes').insert({ id, family_id: familyId, ...input })
      : await client.from('recipes').update(input).eq('id', id);
    if (error) return { ok: false, created: false, detailsSaved: false };
  } catch {
    return { ok: false, created: false, detailsSaved: false };
  }
  const saved = { created: isNew, detailsSaved: true };
  if (ingredients && !(await saveIngredients(client, { recipeId: id, familyId }, ingredients.rows, ingredients.drafts))) return { ok: false, ...saved };
  if (steps && !(await saveSteps(client, id, steps))) return { ok: false, ...saved };
  return { ok: true, ...saved };
}

/** The recipe's whole step list in one call: order is position, steps left out are removed. */
async function saveSteps(client: Pick<Client, 'rpc'>, recipeId: string, rows: StepSaveRow[]): Promise<boolean> {
  try {
    const { error } = await client.rpc('save_recipe_steps', { p_recipe_id: recipeId, p_steps: rows });
    return !error;
  } catch {
    return false;
  }
}

// "Advanced mode" (US2): remembered per person on this device, like the recipe page's choices (013).
const advancedKey = (userId: string) => `cocon.form.${userId}.advanced`;

export async function readAdvanced(storage: ChoiceStorage, userId: string): Promise<boolean> {
  try {
    return (await storage.getItem(advancedKey(userId))) === 'true';
  } catch {
    return false;
  }
}

/** Best effort: if the device refuses, the switch just isn't remembered. */
export async function writeAdvanced(storage: ChoiceStorage, userId: string, on: boolean): Promise<void> {
  try {
    await storage.setItem(advancedKey(userId), on ? 'true' : 'false');
  } catch {
    // Nothing to tell anyone.
  }
}
