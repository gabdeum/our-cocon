// Spec 052 FR-003 against local Supabase: after catalog version 5, unmatched recipe lines, grocery
// items and custom ingredients are linked, and what a family set by hand stays. Everything runs in
// one transaction that is rolled back. Skipped when Supabase isn't running locally.
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { backfillCatalogMatches } from './backfill-catalog-matches';

const databaseUrl = process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

async function reachable(): Promise<boolean> {
  const c = new pg.Client({ connectionString: databaseUrl, connectionTimeoutMillis: 2000 });
  try {
    await c.connect();
    await c.end();
    return true;
  } catch {
    return false;
  }
}
const local = await reachable();
if (!local && process.env.CI) throw new Error('Local Supabase must be running in CI for the backfill test');
if (!local) console.warn('backfill-catalog-matches.test.ts skipped: local Supabase is not running (pnpm dev starts it).');

describe.skipIf(!local)('the catalog backfill against local Supabase', () => {
  const db = new pg.Client({ connectionString: databaseUrl });
  const userId = randomUUID();
  const family = randomUUID();
  const other = randomUUID();
  const recipe = randomUUID();
  const lastWeek = '2026-11-05T10:00:00Z';

  const line = async (name: string) =>
    (await db.query('select catalog_key, size_word, weight_per_piece_g::float8 as weight, piece_noun_singular, piece_noun_plural from public.recipe_ingredients where recipe_id = $1 and name = $2', [recipe, name])).rows[0];
  const item = async (name: string) => (await db.query('select catalog_key, aisle from public.grocery_items where family_id = $1 and name = $2', [family, name])).rows[0];

  beforeAll(async () => {
    await db.connect();
    await db.query('begin');
    await db.query('insert into auth.users (id, email) values ($1, $2)', [userId, `backfill-${userId}@example.com`]);
    await db.query("insert into public.families (id, name, owner_id) values ($1, 'Backfill test', $3), ($2, 'Other family', $3)", [family, other, userId]);
    // The family moved "Yellowfin tuna" to Produce while it was unknown, and gave it a piece weight.
    await db.query("insert into public.family_ingredients (family_id, custom_name, name_norm, aisle, size_medium_g) values ($1, 'Yellowfin tuna', 'yellowfin tuna', 'produce', 150)", [family]);
    // The other family already has its own row for the entry: its custom "Ahi tuna" stays as it is.
    await db.query("insert into public.family_ingredients (family_id, catalog_key, aisle) values ($1, 'tuna_steak', 'frozen')", [other]);
    await db.query("insert into public.family_ingredients (family_id, custom_name, name_norm, aisle) values ($1, 'Ahi tuna', 'ahi tuna', 'drinks')", [other]);
    await db.query('insert into public.recipes (id, family_id, name) values ($1, $2, $3)', [recipe, family, 'Boeuf bourguignon']);
    await db.query(
      `insert into public.recipe_ingredients (family_id, recipe_id, position, name, quantity, unit, weight_per_piece_g) values
         ($1, $2, 0, 'Pearl onions', 12, 'piece', null),
         ($1, $2, 1, 'Lamb shoulder', 1.5, 'kg', null),
         ($1, $2, 2, 'Canadian bacon', 4, 'piece', 30),
         ($1, $2, 3, 'Sourdough starter', 100, 'g', null),
         ($1, $2, 4, 'Japanese short-grain rice', 300, 'g', null)`,
      [family, recipe],
    );
    // Last edited a week ago (the stamp would say now).
    await db.query('alter table public.recipes disable trigger recipes_stamp');
    await db.query('update public.recipes set updated_at = $2 where id = $1', [recipe, lastWeek]);
    await db.query('alter table public.recipes enable trigger recipes_stamp');
    await db.query(
      `insert into public.grocery_items (family_id, name, aisle) values
         ($1, 'Yellowfin tuna', 'other'), ($1, 'English muffins', 'dairy_eggs'),
         ($1, 'Shelled edamame', 'other'), ($1, 'Sourdough starter', 'other')`,
      [family],
    );
    await backfillCatalogMatches(db);
  });

  afterAll(async () => {
    await db.query('rollback');
    await db.end();
  });

  it('links recipe lines, with the piece snapshot when counted in pieces', async () => {
    expect(await line('Pearl onions')).toEqual({ catalog_key: 'pearl_onion', size_word: null, weight: 12, piece_noun_singular: 'pearl onion', piece_noun_plural: 'pearl onions' });
    expect(await line('Lamb shoulder')).toMatchObject({ catalog_key: 'lamb_shoulder', weight: null, piece_noun_singular: null });
    expect(await line('Japanese short-grain rice')).toMatchObject({ catalog_key: 'rice' });
  });

  it('keeps what the cook typed', async () => {
    expect(await line('Canadian bacon')).toMatchObject({ catalog_key: 'canadian_bacon', weight: 30, piece_noun_singular: 'slice of Canadian bacon' });
  });

  it('leaves what the catalog still does not know (Gabriel: sourdough starter stays in Other)', async () => {
    expect(await line('Sourdough starter')).toMatchObject({ catalog_key: null });
    expect(await item('Sourdough starter')).toEqual({ catalog_key: null, aisle: 'other' });
  });

  it("doesn't mark the recipe as edited", async () => {
    const { rows } = await db.query<{ updated_at: Date }>('select updated_at from public.recipes where id = $1', [recipe]);
    expect(rows[0]?.updated_at.toISOString()).toBe('2026-11-05T10:00:00.000Z');
  });

  it("links a custom ingredient the catalog now knows, keeping the family's aisle and size", async () => {
    const { rows } = await db.query('select catalog_key, custom_name, aisle, size_medium_g::float8 as medium from public.family_ingredients where family_id = $1', [family]);
    expect(rows).toEqual([{ catalog_key: 'tuna_steak', custom_name: null, aisle: 'produce', medium: 150 }]);
  });

  it('leaves a custom ingredient alone when the family already has a row for that entry', async () => {
    const { rows } = await db.query("select catalog_key, custom_name from public.family_ingredients where family_id = $1 order by custom_name nulls first", [other]);
    expect(rows).toEqual([{ catalog_key: 'tuna_steak', custom_name: null }, { catalog_key: null, custom_name: 'Ahi tuna' }]);
  });

  it("gives grocery items the entry and the family's aisle, unless someone moved them", async () => {
    expect(await item('Yellowfin tuna')).toEqual({ catalog_key: 'tuna_steak', aisle: 'produce' });
    expect(await item('Shelled edamame')).toEqual({ catalog_key: 'peas', aisle: 'frozen' });
    expect(await item('English muffins')).toEqual({ catalog_key: 'english_muffin', aisle: 'dairy_eggs' });
  });

  it('changes nothing when run again', async () => {
    expect(await backfillCatalogMatches(db)).toEqual({ family_ingredients: 0, recipe_ingredients: 0, grocery_items: 0 });
  });

  it("keeps any family's matcher away from people", async () => {
    await db.query('savepoint signed_in');
    await db.query('set local role authenticated');
    await expect(db.query("select * from public._match_ingredients(null, '[]'::jsonb)")).rejects.toThrow(/permission denied/);
    await db.query('rollback to savepoint signed_in');
  });
});
