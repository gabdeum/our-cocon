import { describe, expect, it } from 'vitest';
import { combineAmounts, groceryIdentity, groceryQuantity, planGroceryAdd, planGroceryAdds, rescaleGroceryAmount, type ListedGrocery } from './groceries';

const me = { recipe_id: null, created_by: 'u-me', source: 'app' };
const item = (over: Partial<ListedGrocery>): ListedGrocery => ({
  ...me,
  id: 'i1',
  name: 'Lemons',
  catalog_key: 'lemon',
  quantity: 2,
  unit: null,
  checked: false,
  ...over,
});

describe('groceryIdentity', () => {
  it('is the catalog entry, or the normalised name', () => {
    expect(groceryIdentity({ catalog_key: 'lemon', name: 'Lemons' })).toBe('lemon');
    expect(groceryIdentity({ catalog_key: null, name: "Za'atar" })).toBe(groceryIdentity({ catalog_key: null, name: 'zaatar' }));
    expect(groceryIdentity({ catalog_key: null, name: 'Birthday candles' })).toBe(groceryIdentity({ catalog_key: null, name: 'birthday candle' }));
  });
});

describe('planGroceryAdd (spec 020: adding something already there merges)', () => {
  it('adds pieces to pieces', () => {
    expect(planGroceryAdd([item({})], { ...me, name: 'Lemon', catalog_key: 'lemon', quantity: 1, unit: null })).toEqual({ kind: 'merge', id: 'i1', quantity: 3, unit: null });
  });

  it('sums weights in the listed unit', () => {
    const list = [item({ name: 'Gruyère', catalog_key: 'gruyere', quantity: 100, unit: 'g' })];
    expect(planGroceryAdd(list, { ...me, name: 'Gruyère', catalog_key: 'gruyere', quantity: 0.2, unit: 'kg' })).toEqual({ kind: 'merge', id: 'i1', quantity: 300, unit: 'g' });
  });

  it('sums volumes, rounded', () => {
    const list = [item({ name: 'Cream', catalog_key: 'heavy_cream', quantity: 300, unit: 'ml' })];
    expect(planGroceryAdd(list, { ...me, name: 'Cream', catalog_key: 'heavy_cream', quantity: 1, unit: 'cup' })).toEqual({ kind: 'merge', id: 'i1', quantity: 536.59, unit: 'ml' });
  });

  it('keeps an amount when the other side has none', () => {
    expect(planGroceryAdd([item({ quantity: null })], { ...me, name: 'Lemons', catalog_key: 'lemon', quantity: 3, unit: null })).toEqual({ kind: 'merge', id: 'i1', quantity: 3, unit: null });
    expect(planGroceryAdd([item({})], { ...me, name: 'Lemons', catalog_key: 'lemon', quantity: null, unit: null })).toEqual({ kind: 'merge', id: 'i1', quantity: 2, unit: null });
  });

  it('merges custom items by name', () => {
    const list = [item({ name: 'Birthday candles', catalog_key: null, quantity: null })];
    expect(planGroceryAdd(list, { ...me, name: 'Birthday candle', catalog_key: null, quantity: null, unit: null })).toMatchObject({ kind: 'merge', id: 'i1' });
  });

  it('adds a row when amounts do not add up, the item is ticked, or it is something else', () => {
    expect(planGroceryAdd([item({ quantity: 100, unit: 'g' })], { ...me, name: 'Lemons', catalog_key: 'lemon', quantity: 2, unit: null })).toEqual({ kind: 'insert' });
    expect(planGroceryAdd([item({ checked: true })], { ...me, name: 'Lemons', catalog_key: 'lemon', quantity: 2, unit: null })).toEqual({ kind: 'insert' });
    expect(planGroceryAdd([item({})], { ...me, name: 'Limes', catalog_key: 'lime', quantity: 2, unit: null })).toEqual({ kind: 'insert' });
    expect(planGroceryAdd([item({ quantity: 1, unit: 'pinch' })], { ...me, name: 'Lemons', catalog_key: 'lemon', quantity: 2, unit: 'g' })).toEqual({ kind: 'insert' });
  });

  it('adds pinches to pinches (spec 022)', () => {
    const list = [item({ name: 'Nutmeg', catalog_key: 'nutmeg', quantity: 1, unit: 'pinch' })];
    expect(planGroceryAdd(list, { ...me, name: 'Nutmeg', catalog_key: 'nutmeg', quantity: 1, unit: 'pinch' })).toEqual({ kind: 'merge', id: 'i1', quantity: 2, unit: 'pinch' });
  });

  it('merges into the item still to buy when a ticked one is listed first', () => {
    const list = [item({ id: 'done', checked: true }), item({ id: 'open' })];
    expect(planGroceryAdd(list, { ...me, name: 'Lemons', catalog_key: 'lemon', quantity: 1, unit: null })).toMatchObject({ kind: 'merge', id: 'open' });
  });
});

describe('planGroceryAdd: origins (spec 022)', () => {
  const quiche = { recipe_id: 'r-quiche', created_by: 'u-mia', source: 'app' };
  it('merges only into the same recipe, or the same person the same way', () => {
    const lemons = { name: 'Lemons', catalog_key: 'lemon', quantity: 1, unit: null };
    expect(planGroceryAdd([item({})], { ...lemons, ...me, created_by: 'u-mia' })).toEqual({ kind: 'insert' });
    expect(planGroceryAdd([item({})], { ...lemons, ...me, source: 'claude' })).toEqual({ kind: 'insert' });
    expect(planGroceryAdd([item({})], { ...lemons, ...quiche })).toEqual({ kind: 'insert' });
    expect(planGroceryAdd([item(quiche)], { ...lemons, ...quiche, created_by: 'u-me' })).toMatchObject({ kind: 'merge' });
    expect(planGroceryAdd([item(quiche)], { ...lemons, ...me })).toEqual({ kind: 'insert' });
  });
});

describe('planGroceryAdds (spec 022: a recipe at once)', () => {
  const cream = item({ id: 'cream', name: 'Heavy cream', catalog_key: 'heavy_cream', quantity: 100, unit: 'ml' });
  const add = (name: string, catalog_key: string | null, quantity: number | null, unit: ListedGrocery['unit']) => ({ ...me, name, catalog_key, quantity, unit });

  it('merges into what is listed and inserts the rest', () => {
    const plan = planGroceryAdds([cream], [add('Heavy cream', 'heavy_cream', 300, 'ml'), add('Butter', 'butter', 20, 'g'), add('Salt and pepper', null, null, null)]);
    expect(plan.merges).toEqual([{ id: 'cream', before: { quantity: 100, unit: 'ml' }, after: { quantity: 400, unit: 'ml' } }]);
    expect(plan.inserts).toEqual([add('Butter', 'butter', 20, 'g'), add('Salt and pepper', null, null, null)]);
  });

  it('folds two lines of the same thing into one row', () => {
    const plan = planGroceryAdds([], [add('Butter', 'butter', 20, 'g'), add('Butter', 'butter', 30, 'g')]);
    expect(plan.inserts).toEqual([add('Butter', 'butter', 50, 'g')]);
    expect(plan.merges).toEqual([]);
  });

  it('keeps the first amount as before when two lines go into one listed item', () => {
    const plan = planGroceryAdds([cream], [add('Heavy cream', 'heavy_cream', 100, 'ml'), add('Heavy cream', 'heavy_cream', 200, 'ml')]);
    expect(plan.merges).toEqual([{ id: 'cream', before: { quantity: 100, unit: 'ml' }, after: { quantity: 400, unit: 'ml' } }]);
  });
});

describe('combineAmounts (spec 022: one row per thing)', () => {
  const apple = { size_small_g: 149, size_medium_g: 182, size_large_g: 223, default_size: 'medium' as const };

  it('sums through piece weights in the first kind; counts round up', () => {
    expect(combineAmounts([{ quantity: 11, unit: 'piece' }, { quantity: 600, unit: 'g' }], apple)).toEqual({ total: { quantity: 15, unit: 'piece' }, parts: [{ quantity: 15, unit: 'piece' }] });
    expect(combineAmounts([{ quantity: 600, unit: 'g' }, { quantity: 0.4, unit: 'kg' }], null).total).toEqual({ quantity: 1000, unit: 'g' });
  });

  it('keeps one part per kind when the facts cannot tell, and skips rows with no amount', () => {
    expect(combineAmounts([{ quantity: 11, unit: 'piece' }, { quantity: null, unit: null }, { quantity: 600, unit: 'g' }, { quantity: 0.2, unit: 'kg' }], null)).toEqual({
      total: null,
      parts: [
        { quantity: 11, unit: 'piece' },
        { quantity: 800, unit: 'g' },
      ],
    });
    expect(combineAmounts([{ quantity: null, unit: null }], null)).toEqual({ total: null, parts: [] });
  });

  it('keeps a single amount as it is', () => {
    expect(combineAmounts([{ quantity: 300, unit: 'ml' }], null).total).toEqual({ quantity: 300, unit: 'ml' });
  });
});

describe('groceryQuantity (spec 022)', () => {
  it('rounds counts up and other amounts to two decimals', () => {
    expect(groceryQuantity(1.2, null)).toBe(2);
    expect(groceryQuantity(2.001, 'piece')).toBe(2);
    expect(groceryQuantity(0.2, 'piece')).toBe(1);
    expect(groceryQuantity(112.5, 'g')).toBe(112.5);
    expect(groceryQuantity(1 / 3, 'cup')).toBe(0.33);
  });
});

describe('rescaleGroceryAmount (spec 022: servings changed on the list)', () => {
  it('scales by new / old servings, rounding as the list does', () => {
    expect(rescaleGroceryAmount({ quantity: 300, unit: 'ml' }, 4, 8)).toEqual({ quantity: 600, unit: 'ml' });
    expect(rescaleGroceryAmount({ quantity: 3, unit: null }, 6, 4)).toEqual({ quantity: 2, unit: null });
    // 3 onions for 4 is 2.25 for 3: counts round up.
    expect(rescaleGroceryAmount({ quantity: 3, unit: 'piece' }, 4, 3)).toEqual({ quantity: 3, unit: 'piece' });
  });

  it('leaves an item with no amount as it is', () => {
    expect(rescaleGroceryAmount({ quantity: null, unit: null }, 4, 8)).toEqual({ quantity: null, unit: null });
  });
});
