import { z } from 'zod';
import { CalendarDate, ClockTime, EventOverride, Recurrence, SlotKey, SlotTimes, TimeType } from './calendar';
import { CatalogKey, PhotoPath, SizeWord, Unit, VariantKind, type IngredientRow, type StepRow } from './recipes';
import { parseVariantChanges, type RecipeVariant } from './variants';

/**
 * Spec 019: a view-only share link's token, 32 random bytes in base64url (FR-001). The database
 * makes it; this only checks a link's shape before anything is asked.
 */
export const ShareToken = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

const Ingredient = z.object({
  id: z.uuid(),
  name: z.string(),
  catalog_key: CatalogKey.nullable(),
  quantity: z.number().nullable(),
  unit: Unit.nullable(),
  size_word: SizeWord.nullable(),
  weight_per_piece_g: z.number().nullable(),
  piece_noun_singular: z.string().nullable(),
  piece_noun_plural: z.string().nullable(),
  prep_note: z.string().nullable(),
});

const Step = z.object({
  id: z.uuid(),
  name: z.string().nullable(),
  body: z.string(),
  timer_seconds: z.int().nullable(),
  timer_label: z.string().nullable(),
  temp_check_c: z.number().nullable(),
  temp_check_text: z.string().nullable(),
  tip: z.string().nullable(),
  photo_path: PhotoPath.nullable(),
});

const Facts = z.object({
  name: z.string().nullable(),
  plural: z.string().nullable(),
  density_g_per_ml: z.number().nullable(),
  size_small_g: z.number().nullable(),
  size_medium_g: z.number().nullable(),
  size_large_g: z.number().nullable(),
  default_size: SizeWord.nullable(),
  noun_singular: z.string().nullable(),
  noun_plural: z.string().nullable(),
  whole_only: z.boolean().nullable(),
});

/** What the share endpoint returns for a shared recipe: only its shared fields (FR-002, SC-001). */
export const SharedRecipeResponse = z.object({
  recipe: z.object({
    name: z.string(),
    description: z.string().nullable(),
    serves: z.int().min(1),
    total_minutes: z.int().nullable(),
    prep_minutes: z.int().nullable(),
    cuisine: z.string().nullable(),
    best_months: z.array(z.int().min(1).max(12)),
    photo_path: PhotoPath.nullable(),
    /** Who made the link; null when they've left the family. */
    shared_by: z.string().nullable(),
    ingredients: z.array(Ingredient),
    steps: z.array(Step),
    variants: z.array(z.object({ id: z.uuid(), name: z.string(), kind: VariantKind, changes: z.unknown() })),
    facts: z.record(z.string(), Facts),
  }),
  /**
   * Signed links by photo path, for the header and step photos (032-later L26), without their
   * host: `/storage/v1/object/sign/…`. The reader puts its Supabase URL in front.
   */
  signedPhotos: z.record(z.string(), z.string().regex(/^\/storage\/v1\/object\/sign\/[^\s]+$/)),
});

export interface SharedRecipe {
  name: string;
  description: string | null;
  serves: number;
  total_minutes: number | null;
  prep_minutes: number | null;
  cuisine: string | null;
  best_months: number[];
  photo_path: string | null;
  shared_by: string | null;
  ingredients: IngredientRow[];
  steps: StepRow[];
  variants: RecipeVariant[];
  facts: z.infer<typeof SharedRecipeResponse>['recipe']['facts'];
}

/**
 * The endpoint's answer, read: variants with only the changes that are valid today, and photo
 * links on `supabaseUrl`. Null when it isn't one.
 */
export function parseSharedRecipe(body: unknown, supabaseUrl: string): { recipe: SharedRecipe; photoUrls: Record<string, string> } | null {
  const parsed = SharedRecipeResponse.safeParse(body);
  if (!parsed.success) return null;
  const { recipe, signedPhotos } = parsed.data;
  const base = supabaseUrl.replace(/\/+$/, '');
  return {
    recipe: { ...recipe, variants: recipe.variants.map((v, position) => ({ ...v, position, changes: parseVariantChanges(v.changes) })) },
    photoUrls: Object.fromEntries(Object.entries(signedPhotos).map(([path, link]) => [path, base + link])),
  };
}

/**
 * Spec 042 FR-005: what the share endpoint returns for a shared event date: the title, the date
 * and time fields, the place and first names ("everyone" and "others" as words). Never the notes,
 * checklist, reminder, who drives or any id. The page works the day out with @cocon/calendar's
 * `occurrenceOn` from `event`, `occurrence_date` and `exception`.
 */
export const SharedEventResponse = z.object({
  occurrence_date: CalendarDate,
  event: z.object({
    title: z.string().min(1).max(60),
    location: z.string().max(200).optional(),
    starts_on: CalendarDate,
    ends_on: CalendarDate,
    time_type: TimeType,
    slots: z.array(SlotKey),
    start_time: ClockTime.optional(),
    end_time: ClockTime.optional(),
    recurrence: Recurrence.optional(),
  }),
  exception: z
    .object({
      occurrence_date: CalendarDate,
      override: EventOverride.pick({ title: true, location: true, starts_on: true, ends_on: true, time_type: true, slots: true, start_time: true, end_time: true }),
    })
    .nullable(),
  who: z.array(z.string().min(1).max(40)).max(50),
  slot_times: SlotTimes.nullable(),
});
export type SharedEventResponse = z.infer<typeof SharedEventResponse>;
