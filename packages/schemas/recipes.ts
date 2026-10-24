import { z } from 'zod';

/**
 * Spec 004 recipe inputs. The database checks the same limits (supabase/migrations, recipes);
 * these give forms and the MCP server an answer before anything is sent.
 */
export const Unit = z.enum(['g', 'kg', 'ml', 'l', 'tsp', 'tbsp', 'cup', 'oz', 'lb', 'piece', 'pinch']);
export const SizeWord = z.enum(['small', 'medium', 'large']);
export const VariantKind = z.enum(['option', 'version']);
export type Unit = z.infer<typeof Unit>;
export type SizeWord = z.infer<typeof SizeWord>;
export type VariantKind = z.infer<typeof VariantKind>;

export const CatalogKey = z.string().regex(/^[a-z0-9_]{1,60}$/);
export const Quantity = z.number().positive().lt(100000);
const Minutes = z.int().min(1).max(10080);
const Position = z.int().min(0);
/** A stored photo: `<family id>/<recipe id>/<uuid>.jpg` (spec 014; storage and the database check the same shape). */
export const PhotoPath = z.string().regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|webp)$/);
const Text = (max: number) => z.string().trim().min(1).max(max);

/**
 * Spec 006 FR-003: the V1 cuisines, stored as their key in `recipes.cuisine` (text). Labels live in
 * the app's strings file. Anything else (empty, or a key from an older or newer list) is Other.
 */
export const Cuisine = z.enum([
  'american',
  'british',
  'caribbean',
  'chinese',
  'french',
  'german',
  'greek',
  'indian',
  'italian',
  'japanese',
  'korean',
  'latin_american',
  'mexican',
  'middle_eastern',
  'moroccan',
  'portuguese',
  'scandinavian',
  'spanish',
  'thai',
  'turkish',
  'vietnamese',
  'west_african',
]);
export type Cuisine = z.infer<typeof Cuisine>;

/** A stored cuisine as a known key, or null for Other. Never throws, so reading a row never fails. */
export function cuisineOf(value: string | null | undefined): Cuisine | null {
  const parsed = Cuisine.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export const RecipeInput = z.strictObject({
  name: Text(80),
  description: z.string().trim().max(140).nullish(),
  serves: z.int().min(1).max(50),
  total_minutes: Minutes.nullish(),
  prep_minutes: Minutes.nullish(),
  cuisine: Cuisine.nullish(),
  source_text: z.string().trim().max(200).nullish(),
  best_months: z
    .array(z.int().min(1).max(12))
    .refine((months) => new Set(months).size === months.length, 'Each month once'),
  photo_path: PhotoPath.nullish(),
});
export type RecipeInput = z.infer<typeof RecipeInput>;

const IngredientFields = z.strictObject({
  name: Text(80),
  catalog_key: CatalogKey.nullish(),
  quantity: Quantity.nullish(),
  unit: Unit.nullish(),
  size_word: SizeWord.nullish(),
  weight_per_piece_g: Quantity.nullish(),
  piece_noun_singular: Text(40).nullish(),
  piece_noun_plural: Text(40).nullish(),
  prep_note: z.string().trim().max(80).nullish(),
});

type IngredientShape = z.infer<typeof IngredientFields>;
/** A recipe ingredient, base or brought in by a variant (spec 008: what `applyVariants` works on). */
export type IngredientRow = IngredientShape & { id: string };
const ingredientRules = (i: IngredientShape) =>
  (i.unit == null || i.quantity != null) && ((i.size_word == null && i.weight_per_piece_g == null) || i.unit === 'piece');
const ingredientRulesMessage = 'A unit needs an amount; a size or piece weight needs the unit "piece"';

export const IngredientInput = IngredientFields.extend({ position: Position }).refine(ingredientRules, ingredientRulesMessage);
export type IngredientInput = z.infer<typeof IngredientInput>;

const StepFields = z.strictObject({
  name: Text(60).nullish(),
  /** Text with ingredient tokens `{ing:<ingredient id>}` (spec 016). */
  body: Text(2000),
  timer_seconds: z.int().min(1).max(86400).nullish(),
  timer_label: Text(40).nullish(),
  /** Always °C; the app shows both scales. */
  temp_check_c: z.number().min(-50).max(400).nullish(),
  temp_check_text: Text(120).nullish(),
  tip: Text(200).nullish(),
  photo_path: PhotoPath.nullish(),
});
/** A recipe step, base or added by a variant. */
export type StepRow = z.infer<typeof StepFields> & { id: string };
const stepRules = (s: z.infer<typeof StepFields>) => s.timer_label == null || s.timer_seconds != null;

/** At most this many steps a recipe (032-later L23; the database checks positions 0–99). */
export const MAX_STEPS = 100;

export const StepInput = StepFields.extend({ position: Position.max(MAX_STEPS - 1) }).refine(stepRules, 'A timer label needs a timer');
export type StepInput = z.infer<typeof StepInput>;

/** An ingredient a variant brings in. It has its own id, so its steps can mention it. */
const VariantIngredient = IngredientFields.extend({ id: z.uuid() }).refine(ingredientRules, ingredientRulesMessage);

/** One change a variant makes to the base recipe (spec 017 FR-002). Ids refer to the base recipe's rows. */
export const VariantChange = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('swap_ingredient'), ingredient_id: z.uuid(), with: z.array(VariantIngredient).min(1).max(10) }),
  z.strictObject({
    type: z.literal('add_ingredient'),
    ingredient: VariantIngredient,
    /** Where it goes in the list: next to this base ingredient (after it unless `place` says before). Without one, or once that one is gone, at the end. */
    next_to_id: z.uuid().optional(),
    place: z.enum(['before', 'after']).optional(),
  }),
  z.strictObject({ type: z.literal('remove_ingredient'), ingredient_id: z.uuid() }),
  z.strictObject({
    type: z.literal('add_step'),
    step_id: z.uuid(),
    place: z.enum(['before', 'after']),
    step: StepFields.refine(stepRules, 'A timer label needs a timer'),
  }),
  z.strictObject({
    type: z.literal('change_step'),
    step_id: z.uuid(),
    body: Text(2000).optional(),
    timer_seconds: z.int().min(1).max(86400).nullable().optional(),
    timer_label: Text(40).nullable().optional(),
    temp_check_c: z.number().min(-50).max(400).nullable().optional(),
    temp_check_text: Text(120).nullable().optional(),
  }),
  z.strictObject({ type: z.literal('remove_step'), step_id: z.uuid() }),
]);
export type VariantChange = z.infer<typeof VariantChange>;

/** At most this many variants a recipe, and changes a variant (spec 017; the database checks both). */
export const MAX_VARIANTS = 20;
export const MAX_VARIANT_CHANGES = 50;

export const VariantInput = z.strictObject({
  position: Position,
  name: Text(40),
  kind: VariantKind,
  changes: z.array(VariantChange).max(MAX_VARIANT_CHANGES),
});
export type VariantInput = z.infer<typeof VariantInput>;
