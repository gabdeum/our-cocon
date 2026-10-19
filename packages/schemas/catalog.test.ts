import { readFileSync } from 'node:fs';
import { describe, expect, expectTypeOf, it } from 'vitest';
import type { Database } from './database.types';
import { CatalogFile, DietFlag, FamilyIngredientInput, StoreProfile, familyIngredientRow, matchNames, pieceSnapshot, type IngredientFacts } from './catalog';

const file = JSON.parse(readFileSync(new URL('../../data/catalog/ingredients.json', import.meta.url), 'utf8')) as {
  version: number;
  ingredients: Record<string, unknown>[];
};
const onion = file.ingredients.find((e) => e.key === 'onion') as Record<string, unknown>;
const withEntry = (entry: Record<string, unknown>) => ({ version: 1, ingredients: [entry] });

describe('data/catalog/ingredients.json', () => {
  it('passes the schema (SC-002)', () => {
    const parsed = CatalogFile.safeParse(file);
    expect(parsed.error?.issues ?? []).toEqual([]);
  });

  it('ships about 200 common ingredients (FR-003)', () => {
    expect(file.ingredients.length).toBeGreaterThanOrEqual(200);
  });

  it('has the sizes US1 names for onions', () => {
    expect(onion.sizes).toEqual({ small: 70, medium: 120, large: 200 });
  });

  // Groceries sum recipe pieces before picking packs (spec 021), so a piece pack's size is how many
  // of the recipe's pieces it holds: a head of garlic is about 10 cloves, not 1.
  it('counts piece packs in the pieces recipes use', () => {
    const counted = (label: string) => {
      const notWeight = String.raw`\b(?!\s*(?:g|kg|ml|cl|l|oz|lb)\b)`;
      const about = new RegExp(String.raw`about (\d+)${notWeight}`).exec(label);
      const of = new RegExp(String.raw`(?:of (\d+)|^(\d+)-pack)${notWeight}`).exec(label);
      return Number(about?.[1] ?? of?.[1] ?? of?.[2] ?? Number.NaN);
    };
    const wrong = CatalogFile.parse(file).ingredients.flatMap((e) =>
      Object.values(e.packs ?? {})
        .flat()
        .filter((p) => p.unit === 'piece' && Number.isFinite(counted(p.label)) && counted(p.label) !== p.size)
        .map((p) => `${e.key}: "${p.label}" has size ${p.size}`),
    );
    expect(wrong).toEqual([]);
    expect(counted('net of 3 bulbs (about 30 cloves)')).toBe(30);
    expect(counted('pack of 2 fillets (about 250 g)')).toBe(2);
    expect(counted('18-pack')).toBe(18);
  });
});

describe('CatalogFile', () => {
  it('refuses sizes without a medium one (SC-002)', () => {
    expect(CatalogFile.safeParse(withEntry({ ...onion, sizes: { small: 70, large: 200 } })).success).toBe(false);
  });

  it('refuses a default size that is not one of the sizes', () => {
    expect(CatalogFile.safeParse(withEntry({ ...onion, sizes: { medium: 120 }, default_size: 'small' })).success).toBe(false);
  });

  it('refuses an unknown aisle or diet flag', () => {
    expect(CatalogFile.safeParse(withEntry({ ...onion, aisle: 'garden' })).success).toBe(false);
    expect(CatalogFile.safeParse(withEntry({ ...onion, diet: ['vegan'] })).success).toBe(false);
  });

  it('refuses a name two entries answer to', () => {
    const twin = { ...onion, key: 'onion_two', synonyms: { en: ['Onions'] } };
    const result = CatalogFile.safeParse({ version: 1, ingredients: [onion, twin] });
    expect(result.error?.issues[0]?.message).toMatch(/belongs to both onion and onion_two/);
  });

  it('refuses a duplicate key', () => {
    expect(CatalogFile.safeParse({ version: 1, ingredients: [onion, onion] }).success).toBe(false);
  });
});

describe('matchNames', () => {
  it('normalises names and synonyms once each', () => {
    const [entry] = CatalogFile.parse(withEntry(onion)).ingredients;
    if (!entry) throw new Error('no entry');
    const names = matchNames(entry).map((n) => n.name_norm);
    expect(names).toContain('onion');
    expect(names).toContain('yellow onion');
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('familyIngredientRow', () => {
  it('normalises a custom name for matching (US3)', () => {
    expect(familyIngredientRow({ custom_name: "Za'atar", aisle: 'spices_baking' })).toMatchObject({ name_norm: 'zaatar' });
    expect(familyIngredientRow({ catalog_key: 'leek', aisle: 'other' }).name_norm).toBeNull();
  });

  it('is a correction or a custom ingredient, not both', () => {
    expect(FamilyIngredientInput.safeParse({ catalog_key: 'onion', custom_name: 'Onion' }).success).toBe(false);
    expect(FamilyIngredientInput.safeParse({}).success).toBe(false);
  });
});

describe('pieceSnapshot', () => {
  const facts: IngredientFacts = {
    catalog_key: 'onion',
    family_ingredient_id: null,
    name: 'Onion',
    plural: 'Onions',
    aisle: 'produce',
    density_g_per_ml: 0.68,
    size_small_g: 70,
    size_medium_g: 120,
    size_large_g: 200,
    default_size: 'medium',
    noun_singular: null,
    noun_plural: null,
    whole_only: false,
    diet: [],
  };

  it('stores the size and weight picked (US1: "1 small onion")', () => {
    expect(pieceSnapshot(facts, 'small')).toEqual({
      catalog_key: 'onion',
      size_word: 'small',
      weight_per_piece_g: 70,
      piece_noun_singular: 'onion',
      piece_noun_plural: 'onions',
    });
  });

  it('uses the default weight without a size word', () => {
    expect(pieceSnapshot(facts)).toMatchObject({ size_word: null, weight_per_piece_g: 120 });
  });

  it('uses the piece nouns when the catalog has them', () => {
    expect(pieceSnapshot({ ...facts, noun_singular: 'clove', noun_plural: 'cloves' })).toMatchObject({ piece_noun_singular: 'clove' });
  });
});

describe('enums match the database', () => {
  it('has the same values as the migrations', () => {
    expectTypeOf<StoreProfile>().toEqualTypeOf<Database['public']['Enums']['store_profile']>();
    expect(DietFlag.options).toEqual(['meat', 'fish', 'dairy', 'gluten']);
  });
});
