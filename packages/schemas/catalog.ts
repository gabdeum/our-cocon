import { z } from 'zod';
import { Aisle } from './groceries';
import { normaliseName } from './ingredient-text';
import { CatalogKey, Quantity, SizeWord, Unit } from './recipes';

/**
 * Spec 031: the ingredient catalog. `data/catalog/ingredients.json` is shaped by `CatalogFile`;
 * `pnpm catalog` validates it and writes the migration that loads it. The database checks the
 * same limits (supabase/migrations, catalog).
 */
export const StoreProfile = z.enum(['us', 'eu']);
export type StoreProfile = z.infer<typeof StoreProfile>;

export const DietFlag = z.enum(['meat', 'fish', 'dairy', 'gluten']);
export type DietFlag = z.infer<typeof DietFlag>;

/** Languages the catalog has names in (FR-008: English only in V1). */
export const CatalogLang = z.enum(['en']);
export type CatalogLang = z.infer<typeof CatalogLang>;

const Name = z.string().trim().min(1).max(80);
const Grams = z.number().positive().lt(100000);

/** How an ingredient is sold in one store profile ("pint carton", "20 cl"). Loose: sold by count or weight. */
export const PackSize = z.strictObject({
  size: Quantity,
  unit: Unit,
  label: z.string().trim().min(1).max(40),
  loose: z.boolean(),
});
export type PackSize = z.infer<typeof PackSize>;

export const PieceSizes = z.strictObject({ small: Grams.optional(), medium: Grams, large: Grams.optional() });

const CatalogEntry = z
  .strictObject({
    key: CatalogKey,
    names: z.record(CatalogLang, z.strictObject({ singular: Name, plural: Name })),
    synonyms: z.record(CatalogLang, z.array(Name).max(20)).optional(),
    aisle: Aisle,
    density_g_per_ml: z.number().positive().max(25).optional(),
    /** SC-002: anything counted in pieces has at least a medium size. */
    sizes: PieceSizes.optional(),
    default_size: SizeWord.optional(),
    /** What one piece is called ("clove", "sheet of shortcrust pastry"), when not the name itself. */
    nouns: z.strictObject({ singular: Name, plural: Name }).optional(),
    whole_only: z.boolean().default(false),
    diet: z.array(DietFlag).default([]),
    packs: z.strictObject({ us: z.array(PackSize).max(10).optional(), eu: z.array(PackSize).max(10).optional() }).optional(),
    /** Where the numbers come from. Kept in the repo for review, not loaded. */
    source: z.string().trim().min(1).max(300),
  })
  .refine((e) => e.names.en != null, 'Every entry has an English name')
  .refine((e) => (e.default_size == null) === (e.sizes == null), 'A default size goes with sizes')
  .refine((e) => e.default_size == null || e.sizes?.[e.default_size] != null, 'The default size must be one of the sizes')
  .refine((e) => new Set(e.diet).size === e.diet.length, 'Each diet flag once');
export type CatalogEntry = z.infer<typeof CatalogEntry>;

/** Every name, plural and synonym an entry answers to, normalised as the matcher sees them. */
export function matchNames(entry: CatalogEntry): { lang: CatalogLang; name_norm: string; kind: 'name' | 'plural' | 'synonym' }[] {
  const out = new Map<string, { lang: CatalogLang; name_norm: string; kind: 'name' | 'plural' | 'synonym' }>();
  for (const lang of CatalogLang.options) {
    const names = entry.names[lang];
    const add = (text: string, kind: 'name' | 'plural' | 'synonym') => {
      const name_norm = normaliseName(text);
      if (name_norm && !out.has(`${lang}:${name_norm}`)) out.set(`${lang}:${name_norm}`, { lang, name_norm, kind });
    };
    if (names) {
      add(names.singular, 'name');
      add(names.plural, 'plural');
    }
    for (const s of entry.synonyms?.[lang] ?? []) add(s, 'synonym');
  }
  return [...out.values()];
}

export const CatalogFile = z
  .strictObject({
    version: z.int().min(1),
    ingredients: z.array(CatalogEntry).min(1).max(5000),
  })
  .superRefine((file, ctx) => {
    const keys = new Set<string>();
    const names = new Map<string, string>();
    file.ingredients.forEach((entry, i) => {
      if (keys.has(entry.key)) ctx.addIssue({ code: 'custom', path: ['ingredients', i, 'key'], message: `Duplicate key ${entry.key}` });
      keys.add(entry.key);
      for (const { lang, name_norm } of matchNames(entry)) {
        const owner = names.get(`${lang}:${name_norm}`);
        if (owner && owner !== entry.key) {
          ctx.addIssue({ code: 'custom', path: ['ingredients', i], message: `"${name_norm}" belongs to both ${owner} and ${entry.key}` });
        }
        names.set(`${lang}:${name_norm}`, entry.key);
      }
    });
  });
export type CatalogFile = z.infer<typeof CatalogFile>;

/**
 * A family's correction to a catalog entry, or an ingredient the catalog doesn't have (FR-004).
 * `name_norm` is derived, never typed: use `familyIngredientRow`.
 */
export const FamilyIngredientInput = z
  .strictObject({
    catalog_key: CatalogKey.nullish(),
    custom_name: Name.nullish(),
    aisle: Aisle.nullish(),
    size_small_g: Grams.nullish(),
    size_medium_g: Grams.nullish(),
    size_large_g: Grams.nullish(),
    packs: z.array(PackSize).max(20).nullish(),
  })
  .refine((i) => (i.catalog_key == null) !== (i.custom_name == null), 'Either a catalog ingredient or a custom name');
export type FamilyIngredientInput = z.infer<typeof FamilyIngredientInput>;

/** The row to upsert into `family_ingredients`, with the custom name normalised for matching. */
export function familyIngredientRow(input: FamilyIngredientInput) {
  const row = FamilyIngredientInput.parse(input);
  return { ...row, name_norm: row.custom_name ? normaliseName(row.custom_name) : null };
}

/** What `match_ingredients` takes per line (from `parseIngredientText`). */
export const MatchQuery = z.strictObject({ full: z.string().max(80), core: z.string().max(80) });
export type MatchQuery = z.infer<typeof MatchQuery>;
export const MatchQueries = z.array(MatchQuery).max(100);

/** An ingredient's facts with the family's corrections applied (the `ingredient_facts` view). */
export const IngredientFacts = z.object({
  catalog_key: CatalogKey.nullable(),
  family_ingredient_id: z.uuid().nullable(),
  name: z.string(),
  plural: z.string(),
  aisle: Aisle,
  density_g_per_ml: z.number().nullable(),
  size_small_g: z.number().nullable(),
  size_medium_g: z.number().nullable(),
  size_large_g: z.number().nullable(),
  default_size: SizeWord.nullable(),
  noun_singular: z.string().nullable(),
  noun_plural: z.string().nullable(),
  whole_only: z.boolean(),
  diet: z.array(DietFlag),
});
export type IngredientFacts = z.infer<typeof IngredientFacts>;

/** One row per line sent, in order. `how: 'none'`: no facts, aisle Other (the caller keeps the text). */
export const MatchResult = IngredientFacts.extend({
  idx: z.int().min(0),
  how: z.enum(['exact', 'fuzzy', 'none']),
  name: z.string().nullable(),
  plural: z.string().nullable(),
});
export type MatchResult = z.infer<typeof MatchResult>;

/**
 * What a recipe ingredient stores when it's linked to the catalog (spec 031: recipes keep a
 * snapshot, so a later catalog change never alters a saved recipe). Without a size, the default.
 */
export function pieceSnapshot(facts: IngredientFacts | MatchResult, size?: SizeWord | null) {
  const grams = { small: facts.size_small_g, medium: facts.size_medium_g, large: facts.size_large_g };
  const sizeWord = size && grams[size] != null ? size : facts.default_size;
  const weight = sizeWord ? grams[sizeWord] : null;
  return {
    catalog_key: facts.catalog_key,
    size_word: size && size === sizeWord ? size : null,
    weight_per_piece_g: weight ?? null,
    piece_noun_singular: facts.noun_singular ?? facts.name?.toLowerCase() ?? null,
    piece_noun_plural: facts.noun_plural ?? facts.plural?.toLowerCase() ?? null,
  };
}
