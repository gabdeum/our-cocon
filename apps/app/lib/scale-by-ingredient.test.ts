import { describe, expect, it } from 'vitest';
import { quiche, quicheIds } from '@cocon/schemas/quiche.fixture';
import { noVariants } from '@cocon/schemas';
import { defaultPanelChoices, type RecipeChoices } from './recipe-choices';
import { defaultFormat, recipeView } from './recipe-view';
import { parseAmount, scaleCandidates, scalePreview } from './scale-by-ingredient';

/** The seed quiche with catalog facts: eggs are whole only, cream has a density. */
const recipe = {
  ...quiche,
  ingredients: quiche.ingredients.map((i) => ({ ...i, catalog_key: ({ Eggs: 'egg', 'Heavy cream': 'heavy_cream' } as Record<string, string>)[i.name] ?? null })),
  facts: {
    egg: { default_size: 'large' as const, size_small_g: 38, size_medium_g: 44, size_large_g: 50, whole_only: true },
    heavy_cream: { density_g_per_ml: 1 },
  },
};
const choices: RecipeChoices = { servings: 6, ...noVariants, ...defaultPanelChoices, scaledBy: null };
const lardons = { ingredientId: quicheIds.lardons, amount: 250, unit: 'g' as const };

describe('scaleCandidates (FR-003)', () => {
  it('lists every ingredient with an amount, never a pinch, with what the page shows now', () => {
    const list = scaleCandidates(recipe, choices, defaultFormat);
    expect(list.map((c) => [c.name, c.current])).toEqual([
      ['Shortcrust pastry', '1 (230 g)'],
      ['Butter', '20 g'],
      ['Leeks', '2 (300 g)'],
      ['Bacon lardons', '200 g'],
      ['Eggs', '3 (150 g)'],
      ['Heavy cream', '300 ml (300 g)'],
      ['Gruyère', '100 g'],
    ]);
  });

  it('only offers units that match: no ml for lardons, weights for pieces with a weight', () => {
    const byName = Object.fromEntries(scaleCandidates(recipe, choices, defaultFormat).map((c) => [c.name, c]));
    expect(byName['Bacon lardons']).toMatchObject({ unit: 'g', units: ['g', 'kg', 'oz', 'lb'] });
    expect(byName['Heavy cream']?.units).toEqual(['ml', 'l', 'tsp', 'tbsp', 'cup']);
    expect(byName['Leeks']).toMatchObject({ unit: 'piece', units: ['piece', 'g', 'kg', 'oz', 'lb'] });
  });

  it('follows the variants: Vegetarian lists mushrooms, not lardons', () => {
    const names = scaleCandidates(recipe, { ...choices, version: quicheIds.vegetarian }, defaultFormat).map((c) => c.name);
    expect(names).toContain('Mushrooms');
    expect(names).not.toContain('Bacon lardons');
  });
});

describe('scalePreview (US2)', () => {
  it('250 g of lardons: Recipe × 1.25 → about 7½ servings, eggs rounded', () => {
    const preview = scalePreview(recipe, noVariants, lardons, defaultFormat);
    expect(preview).toEqual({
      factor: '1.25',
      result: 'Recipe × 1.25 → about 7½ servings',
      amounts: 'Shortcrust pastry 1½ (288 g) · Butter 25 g · Leeks 2½ (375 g) · Eggs 4 (200 g)',
      note: 'Eggs are rounded to whole numbers. Cooking times stay the same.',
      warning: null,
    });
  });

  it('without whole items, only says cooking times stay the same', () => {
    const plain = { ...recipe, facts: {} };
    expect(scalePreview(plain, noVariants, lardons, defaultFormat)?.note).toBe('Cooking times stay the same.');
  });

  it('warns about a big change under ¼ or over 4', () => {
    expect(scalePreview(recipe, noVariants, { ...lardons, amount: 40 }, defaultFormat)?.warning).toBe("That's a big change. Check cooking times.");
    expect(scalePreview(recipe, noVariants, { ...lardons, amount: 1, unit: 'kg' }, defaultFormat)?.warning).toBe("That's a big change. Check cooking times.");
    expect(scalePreview(recipe, noVariants, { ...lardons, amount: 800 }, defaultFormat)?.warning).toBeNull();
  });

  it('nothing to show for 0 or a unit that does not fit', () => {
    expect(scalePreview(recipe, noVariants, { ...lardons, amount: 0 }, defaultFormat)).toBeNull();
    expect(scalePreview(recipe, noVariants, { ...lardons, unit: 'ml' }, defaultFormat)).toBeNull();
  });

  it('Apply: the page then uses factor 1.25 and shows 7½ servings', () => {
    const view = recipeView(recipe, { servings: 6, scaledBy: lardons }, noVariants);
    expect(view.servings).toBe(7.5);
    expect(view.scaledBy?.baseName).toBe('Bacon lardons');
    expect(view.ingredients.find((i) => i.name === 'Bacon lardons')?.amount).toBe('250 g');
    expect(view.ingredients.find((i) => i.name === 'Eggs')?.amount).toBe('4');
  });

  it('falls back to the servings when the ingredient is gone (Vegetarian)', () => {
    const view = recipeView(recipe, { servings: 6, scaledBy: lardons }, { version: quicheIds.vegetarian, options: [] });
    expect(view.servings).toBe(6);
    expect(view.scaledBy).toBeNull();
  });
});

describe('parseAmount', () => {
  it('reads dots and commas, and refuses the rest', () => {
    expect(['250', '1,5', ' 2.5 ', '.5', '3.'].map(parseAmount)).toEqual([250, 1.5, 2.5, 0.5, 3]);
    expect(['', 'abc', '-1', '1e3', '1.2.3'].map(parseAmount)).toEqual([null, null, null, null, null]);
  });
});
