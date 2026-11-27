import { z } from 'zod';
import { CalendarDate, ClockTime, EventOverride, Recurrence, SlotKey, SlotTimes, TimeType } from './calendar';
import { StoreProfile } from './catalog';
import { UnitSystem } from './family';
import { Aisle } from './groceries';
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
    /** Spec 051 FR-015: the parts of its Source line (`recipeSource`); absent from older answers. */
    source_text: z.string().nullish(),
    source: z.string().nullish(),
    author_name: z.string().nullish(),
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
  source_text?: string | null;
  source?: string | null;
  author_name?: string | null;
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
 * reminder, who drives or any id. The page works the day out with @cocon/calendar's
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

/**
 * Spec 072 FR-002: how long a grocery-list link lasts, the share sheet's "How long" pills. The end
 * itself is worked out on the device (`expiresAtFor`), "none" has none.
 */
export const ShareDuration = z.enum(['1h', 'today', 'week', 'none']);
export type ShareDuration = z.infer<typeof ShareDuration>;

const StorePack = z.object({ size: z.number(), unit: Unit, label: z.string(), loose: z.boolean() });

/**
 * Spec 072 FR-003: what the grocery share endpoint returns for a live link: the list's items as a
 * guest sees them (never who added or ticked them, or their recipes), the family's store and units,
 * and the packs of what's listed, so the rows read as on the family's own list.
 */
export const SharedGroceriesResponse = z.object({
  family_name: z.string(),
  can_edit: z.boolean(),
  expires_at: z.string().nullable(),
  settings: z.object({ store_profile: StoreProfile, round_to_packs: z.boolean(), units: UnitSystem }),
  items: z
    .array(
      z.object({
        id: z.uuid(),
        name: z.string(),
        catalog_key: CatalogKey.nullable(),
        quantity: z.number().nullable(),
        unit: Unit.nullable(),
        aisle: Aisle.nullable(),
        checked: z.boolean(),
        recipe_detail: z.string().nullable(),
      }),
    )
    .max(1000),
  packs: z.record(
    CatalogKey,
    z.object({
      facts: z.object({
        name: z.string().nullable(),
        density_g_per_ml: z.number().nullable(),
        size_small_g: z.number().nullable(),
        size_medium_g: z.number().nullable(),
        size_large_g: z.number().nullable(),
        default_size: SizeWord.nullable(),
      }),
      packs: z.object({ us: z.array(StorePack), eu: z.array(StorePack) }),
    }),
  ),
});
export type SharedGroceriesResponse = z.infer<typeof SharedGroceriesResponse>;

/** Rows one guest write may name at most (the endpoint checks the same). */
export const SHARED_WRITE_MAX_IDS = 500;
const ItemIds = z.array(z.uuid()).min(1).max(SHARED_WRITE_MAX_IDS);

/**
 * Spec 072 FR-004/005: one guest change, as the page sends it to the share endpoint. The endpoint
 * (Deno, no workspace imports) checks the same shape by hand, and the database's own checks hold
 * the rest.
 */
export const SharedGroceryWrite = z.discriminatedUnion('op', [
  z.object({ op: z.literal('add'), name: z.string().trim().min(1).max(80), quantity: z.number().positive().nullable(), unit: Unit.nullable(), full: z.string().max(80), core: z.string().max(80) }),
  z.object({ op: z.literal('check'), ids: ItemIds, checked: z.boolean() }),
  z.object({ op: z.literal('clear'), ids: ItemIds }),
  z.object({ op: z.literal('restore'), ids: ItemIds }),
]);
export type SharedGroceryWrite = z.infer<typeof SharedGroceryWrite>;
