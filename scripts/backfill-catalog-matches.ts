import type pg from 'pg';
import { pieceSnapshot, type MatchResult } from '../packages/schemas/catalog';
import { parseIngredientText } from '../packages/schemas/ingredient-text';

/**
 * Spec 052 FR-003: after a catalog version, links what matched nothing before. scripts/migrate.ts
 * runs it right after the `backfill_catalog_matches` migration, in the same transaction; locally,
 * `pnpm db:backfill` (scripts/db-backfill.ts) runs it against local Supabase. It only fills rows whose `catalog_key` is
 * null, so running it twice changes nothing.
 * - Custom ingredients whose exact name the catalog now knows are linked to that entry and keep their
 *   aisle, sizes and packs (unless the family already has its own row for that entry).
 * - Recipe lines get the entry, and, when counted in pieces, the spec 031 snapshot (piece weight,
 *   size word, nouns), without replacing what the cook typed.
 * - Grocery items get the entry and its aisle (the family's own aisle first), unless someone already
 *   moved the item out of Other.
 */
export interface BackfillCounts {
  family_ingredients: number;
  recipe_ingredients: number;
  grocery_items: number;
}

type Queryable = Pick<pg.Client, 'query'>;

/** The matcher's answer (`_match_ingredients`), numbers as numbers. */
const MATCH = `select idx, how, catalog_key, family_ingredient_id, name, plural, aisle,
  density_g_per_ml::float8, size_small_g::float8, size_medium_g::float8, size_large_g::float8,
  default_size, noun_singular, noun_plural, whole_only, diet
  from public._match_ingredients($1::uuid, $2::jsonb)`;

/** The catalog entry each name matches for this family (null: the whole catalog, no custom names). */
async function matchNames(client: Queryable, family: string | null, names: readonly string[]): Promise<Map<string, MatchResult>> {
  const out = new Map<string, MatchResult>();
  const unique = [...new Set(names)];
  for (let i = 0; i < unique.length; i += 100) {
    const chunk = unique.slice(i, i + 100);
    const queries = chunk.map((n) => {
      const { full, core } = parseIngredientText(n);
      return { full: full.slice(0, 80), core: core.slice(0, 80) };
    });
    const { rows } = await client.query<MatchResult>(MATCH, [family, JSON.stringify(queries)]);
    for (const row of rows) {
      const name = chunk[row.idx];
      if (name != null && row.how !== 'none' && row.catalog_key) out.set(name, row);
    }
  }
  return out;
}

function byFamily<T extends { family_id: string }>(rows: readonly T[]): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const row of rows) out.set(row.family_id, [...(out.get(row.family_id) ?? []), row]);
  return out;
}

export async function backfillCatalogMatches(client: Queryable): Promise<BackfillCounts> {
  const counts: BackfillCounts = { family_ingredients: 0, recipe_ingredients: 0, grocery_items: 0 };

  // Custom ingredients first, so items of that name pick up the family's aisle through the entry.
  const customs = await client.query<{ id: string; family_id: string; custom_name: string }>(
    'select id, family_id, custom_name from public.family_ingredients where custom_name is not null order by created_at, id',
  );
  const customHits = await matchNames(client, null, customs.rows.map((c) => c.custom_name));
  for (const c of customs.rows) {
    const hit = customHits.get(c.custom_name);
    // Linking rewrites the family's own entry: only for the very name, never a close one.
    if (!hit || hit.how !== 'exact') continue;
    const { rowCount } = await client.query(
      `update public.family_ingredients set catalog_key = $2, custom_name = null, name_norm = null
       where id = $1 and not exists (
         select 1 from public.family_ingredients o where o.family_id = $3 and o.catalog_key = $2)`,
      [c.id, hit.catalog_key, c.family_id],
    );
    counts.family_ingredients += rowCount ?? 0;
  }

  // A backfill isn't an edit: recipes keep their "updated" time.
  await client.query('alter table public.recipe_ingredients disable trigger recipe_ingredients_touch_recipe');
  const lines = await client.query<{
    id: string;
    family_id: string;
    name: string;
    unit: string | null;
    size_word: 'small' | 'medium' | 'large' | null;
    weight_per_piece_g: string | null;
    piece_noun_singular: string | null;
    piece_noun_plural: string | null;
  }>(
    `select id, family_id, name, unit, size_word, weight_per_piece_g, piece_noun_singular, piece_noun_plural
     from public.recipe_ingredients where catalog_key is null`,
  );
  for (const [family, rows] of byFamily(lines.rows)) {
    const hits = await matchNames(client, family, rows.map((r) => r.name));
    for (const r of rows) {
      const hit = hits.get(r.name);
      if (!hit) continue;
      const snap = r.unit === 'piece' ? pieceSnapshot(hit, r.size_word ?? parseIngredientText(r.name).size_word) : null;
      const { rowCount } = await client.query(
        `update public.recipe_ingredients set catalog_key = $2,
           size_word = coalesce(size_word, $3::public.size_word),
           weight_per_piece_g = coalesce(weight_per_piece_g, $4),
           piece_noun_singular = coalesce(piece_noun_singular, $5),
           piece_noun_plural = coalesce(piece_noun_plural, $6)
         where id = $1 and catalog_key is null`,
        [r.id, hit.catalog_key, snap?.size_word ?? null, snap?.weight_per_piece_g ?? null, snap?.piece_noun_singular ?? null, snap?.piece_noun_plural ?? null],
      );
      counts.recipe_ingredients += rowCount ?? 0;
    }
  }
  await client.query('alter table public.recipe_ingredients enable trigger recipe_ingredients_touch_recipe');

  const items = await client.query<{ id: string; family_id: string; name: string }>(
    'select id, family_id, name from public.grocery_items where catalog_key is null',
  );
  for (const [family, rows] of byFamily(items.rows)) {
    const hits = await matchNames(client, family, rows.map((r) => r.name));
    for (const r of rows) {
      const hit = hits.get(r.name);
      if (!hit) continue;
      const { rowCount } = await client.query(
        `update public.grocery_items set catalog_key = $2,
           aisle = case when aisle = 'other' then $3::public.aisle else aisle end
         where id = $1 and catalog_key is null`,
        [r.id, hit.catalog_key, hit.aisle],
      );
      counts.grocery_items += rowCount ?? 0;
    }
  }
  return counts;
}

export function countsText(c: BackfillCounts): string {
  return `Linked to the catalog: ${c.recipe_ingredients} recipe line(s), ${c.grocery_items} grocery item(s), ${c.family_ingredients} custom ingredient(s).`;
}
