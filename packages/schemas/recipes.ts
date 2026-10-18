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
const PhotoPath = z.string().min(1).max(300);
const Text = (max: number) => z.string().trim().min(1).max(max);

export const RecipeInput = z.strictObject({
  name: Text(80),
  description: z.string().trim().max(140).nullish(),
  serves: z.int().min(1).max(50),
  total_minutes: Minutes.nullish(),
  prep_minutes: Minutes.nullish(),
  cuisine: Text(40).nullish(),
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
const stepRules = (s: z.infer<typeof StepFields>) => s.timer_label == null || s.timer_seconds != null;

export const StepInput = StepFields.extend({ position: Position }).refine(stepRules, 'A timer label needs a timer');
export type StepInput = z.infer<typeof StepInput>;

/** An ingredient a variant brings in. It has its own id, so its steps can mention it. */
const VariantIngredient = IngredientFields.extend({ id: z.uuid() }).refine(ingredientRules, ingredientRulesMessage);

/** One change a variant makes to the base recipe (spec 017 FR-002). Ids refer to the base recipe's rows. */
export const VariantChange = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('swap_ingredient'), ingredient_id: z.uuid(), with: z.array(VariantIngredient).min(1).max(10) }),
  z.strictObject({ type: z.literal('add_ingredient'), ingredient: VariantIngredient }),
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

export const VariantInput = z.strictObject({
  position: Position,
  name: Text(40),
  kind: VariantKind,
  changes: z.array(VariantChange).max(50),
});
export type VariantInput = z.infer<typeof VariantInput>;
