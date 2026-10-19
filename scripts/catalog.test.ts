import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { IngredientFacts, MatchResult, familyIngredientRow, normaliseName, parseIngredientText, pieceSnapshot } from '../packages/schemas';
import { run } from './catalog';

// Spec 031 against local Supabase's database (`supabase start`), as in CI: the TypeScript
// normaliser and the SQL matcher together, as the app and MCP server use them. Everything runs in
// one transaction that is rolled back.
const url = process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const gabriel = '00000000-0000-4000-8000-0000000310aa';
const sam = '00000000-0000-4000-8000-0000000310ff';
const client = new pg.Client({ connectionString: url });

async function login(uid: string) {
  await client.query('reset role');
  await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: uid, role: 'authenticated' })]);
  await client.query('set local role authenticated');
}

async function match(lines: string[]): Promise<(MatchResult & { prep: string | null; size_word: string | null })[]> {
  const parsed = lines.map(parseIngredientText);
  const { rows } = await client.query('select * from public.match_ingredients($1::jsonb)', [
    JSON.stringify(parsed.map(({ full, core }) => ({ full, core }))),
  ]);
  return rows.map((row: Record<string, unknown>, i) => ({
    ...MatchResult.parse(normaliseRow(row)),
    prep: parsed[i]?.prep ?? null,
    size_word: parsed[i]?.size_word ?? null,
  }));
}

/** pg returns numeric as strings. */
function normaliseRow(row: Record<string, unknown>) {
  const numeric = ['density_g_per_ml', 'size_small_g', 'size_medium_g', 'size_large_g'];
  return Object.fromEntries(Object.entries(row).map(([k, v]) => [k, numeric.includes(k) && v != null ? Number(v) : v]));
}

beforeAll(async () => {
  await client.connect();
  await client.query('begin');
  await client.query('insert into auth.users (id, email) values ($1, $2), ($3, $4)', [gabriel, 'gabriel-031@example.com', sam, 'sam-031@example.com']);
  await login(gabriel);
  await client.query("select public.create_family('The Demanges', 'Gabriel')");
  await login(sam);
  await client.query("select public.create_family('The Others', 'Sam')");
  await login(gabriel);
});

afterAll(async () => {
  await client.query('rollback');
  await client.end();
});

describe('US1: typing an ingredient just works', () => {
  it('suggests Onion with its three sizes for "onion"', async () => {
    const { rows } = await client.query('select * from public.suggest_ingredients($1)', [normaliseName('onion')]);
    const [first] = rows.map((r: Record<string, unknown>) => IngredientFacts.parse(normaliseRow(r)));
    expect(first).toMatchObject({ catalog_key: 'onion', name: 'Onion', size_small_g: 70, size_medium_g: 120, size_large_g: 200 });
  });

  it('stores the size and weight when "1 small onion" is picked', async () => {
    const [onion] = await match(['1 small onion']);
    if (!onion) throw new Error('no match');
    expect(onion.size_word).toBe('small');
    expect(pieceSnapshot(onion, 'small')).toMatchObject({ catalog_key: 'onion', size_word: 'small', weight_per_piece_g: 70 });
  });
});

describe('US2: groceries land in the right aisle', () => {
  it('puts the quiche ingredients in their aisles with no setup', async () => {
    const results = await match(['Leeks', 'Gruyère', 'Nutmeg']);
    expect(results.map((r) => [r.catalog_key, r.aisle])).toEqual([
      ['leek', 'produce'],
      ['gruyere', 'dairy_eggs'],
      ['nutmeg', 'spices_baking'],
    ]);
  });
});

describe('US3: unknown items are learned once', () => {
  it("puts Za'atar in Other, then where the family moved it, for that family only", async () => {
    expect((await match(["Za'atar"]))[0]).toMatchObject({ how: 'none', aisle: 'other', catalog_key: null });

    const row = familyIngredientRow({ custom_name: "Za'atar", aisle: 'spices_baking' });
    await client.query('insert into public.family_ingredients (custom_name, name_norm, aisle) values ($1, $2, $3)', [
      row.custom_name,
      row.name_norm,
      row.aisle,
    ]);
    expect((await match(['za’atar']))[0]).toMatchObject({ how: 'exact', aisle: 'spices_baking', name: "Za'atar" });

    await login(sam);
    expect((await match(["Za'atar"]))[0]).toMatchObject({ how: 'none', aisle: 'other' });
    await login(gabriel);
  });
});

describe('edge cases', () => {
  it('matches "finely chopped red onions" to Red onion and keeps the note', async () => {
    expect((await match(['finely chopped red onions']))[0]).toMatchObject({ catalog_key: 'red_onion', prep: 'finely chopped' });
  });

  it('matches plurals and missing accents', async () => {
    expect((await match(['Leeks', 'gruyere'])).map((r) => r.catalog_key)).toEqual(['leek', 'gruyere']);
  });

  it('matches close spellings with pg_trgm', async () => {
    expect((await match(['mozarella', 'brocoli'])).map((r) => [r.catalog_key, r.how])).toEqual([
      ['mozzarella', 'fuzzy'],
      ['broccoli', 'fuzzy'],
    ]);
  });

  it('refuses more than 100 lines at once', async () => {
    await client.query('savepoint too_many');
    await expect(match(Array.from({ length: 101 }, () => 'onion'))).rejects.toThrow(/at most 100/);
    await client.query('rollback to savepoint too_many');
  });
});

describe('SC-001: real recipes match the catalog', () => {
  it('matches at least 95% of 200 ingredient lines', async () => {
    const set = JSON.parse(readFileSync(new URL('../data/catalog/test-lines.json', import.meta.url), 'utf8')) as {
      recipes: { lines: string[] }[];
    };
    const lines = set.recipes.flatMap((r) => r.lines);
    expect(lines).toHaveLength(200);
    const results = (await Promise.all([match(lines.slice(0, 100)), match(lines.slice(100))])).flat();
    const unmatched = lines.filter((_, i) => results[i]?.how === 'none');
    expect(unmatched.length, `Unmatched: ${unmatched.join(', ')}`).toBeLessThanOrEqual(10);
  });
});

describe('pnpm catalog --check', () => {
  it('finds a migration that loads the current data', () => {
    expect(run(true)).toEqual({ ok: true, message: '' });
  });
});
