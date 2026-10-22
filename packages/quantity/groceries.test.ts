import { describe, expect, it } from 'vitest';
import { groceryIdentity, planGroceryAdd, planGroceryAdds, type ListedGrocery } from './groceries';

const item = (over: Partial<ListedGrocery>): ListedGrocery => ({
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
    expect(planGroceryAdd([item({})], { name: 'Lemon', catalog_key: 'lemon', quantity: 1, unit: null })).toEqual({ kind: 'merge', id: 'i1', quantity: 3, unit: null });
  });

  it('sums weights in the listed unit', () => {
    const list = [item({ name: 'Gruyère', catalog_key: 'gruyere', quantity: 100, unit: 'g' })];
    expect(planGroceryAdd(list, { name: 'Gruyère', catalog_key: 'gruyere', quantity: 0.2, unit: 'kg' })).toEqual({ kind: 'merge', id: 'i1', quantity: 300, unit: 'g' });
  });

  it('sums volumes, rounded', () => {
    const list = [item({ name: 'Cream', catalog_key: 'heavy_cream', quantity: 300, unit: 'ml' })];
    expect(planGroceryAdd(list, { name: 'Cream', catalog_key: 'heavy_cream', quantity: 1, unit: 'cup' })).toEqual({ kind: 'merge', id: 'i1', quantity: 536.59, unit: 'ml' });
  });

  it('keeps an amount when the other side has none', () => {
    expect(planGroceryAdd([item({ quantity: null })], { name: 'Lemons', catalog_key: 'lemon', quantity: 3, unit: null })).toEqual({ kind: 'merge', id: 'i1', quantity: 3, unit: null });
    expect(planGroceryAdd([item({})], { name: 'Lemons', catalog_key: 'lemon', quantity: null, unit: null })).toEqual({ kind: 'merge', id: 'i1', quantity: 2, unit: null });
  });

  it('merges custom items by name', () => {
    const list = [item({ name: 'Birthday candles', catalog_key: null, quantity: null })];
    expect(planGroceryAdd(list, { name: 'Birthday candle', catalog_key: null, quantity: null, unit: null })).toMatchObject({ kind: 'merge', id: 'i1' });
  });

  it('adds a row when amounts do not add up, the item is ticked, or it is something else', () => {
    expect(planGroceryAdd([item({ quantity: 100, unit: 'g' })], { name: 'Lemons', catalog_key: 'lemon', quantity: 2, unit: null })).toEqual({ kind: 'insert' });
    expect(planGroceryAdd([item({ checked: true })], { name: 'Lemons', catalog_key: 'lemon', quantity: 2, unit: null })).toEqual({ kind: 'insert' });
    expect(planGroceryAdd([item({})], { name: 'Limes', catalog_key: 'lime', quantity: 2, unit: null })).toEqual({ kind: 'insert' });
    expect(planGroceryAdd([item({ quantity: 1, unit: 'pinch' })], { name: 'Lemons', catalog_key: 'lemon', quantity: 2, unit: 'g' })).toEqual({ kind: 'insert' });
  });

  it('adds pinches to pinches (spec 022)', () => {
    const list = [item({ name: 'Nutmeg', catalog_key: 'nutmeg', quantity: 1, unit: 'pinch' })];
    expect(planGroceryAdd(list, { name: 'Nutmeg', catalog_key: 'nutmeg', quantity: 1, unit: 'pinch' })).toEqual({ kind: 'merge', id: 'i1', quantity: 2, unit: 'pinch' });
  });

  it('merges into the item still to buy when a ticked one is listed first', () => {
    const list = [item({ id: 'done', checked: true }), item({ id: 'open' })];
    expect(planGroceryAdd(list, { name: 'Lemons', catalog_key: 'lemon', quantity: 1, unit: null })).toMatchObject({ kind: 'merge', id: 'open' });
  });
});

describe('planGroceryAdds (spec 022: a recipe at once)', () => {
  const cream = item({ id: 'cream', name: 'Heavy cream', catalog_key: 'heavy_cream', quantity: 100, unit: 'ml' });
  const add = (name: string, catalog_key: string | null, quantity: number | null, unit: ListedGrocery['unit']) => ({ name, catalog_key, quantity, unit });

  it('merges into what is listed and inserts the rest', () => {
    const plan = planGroceryAdds([cream], [add('Heavy cream', 'heavy_cream', 300, 'ml'), add('Butter', 'butter', 20, 'g'), add('Salt and pepper', null, null, null)]);
    expect(plan.merges).toEqual([{ id: 'cream', before: { quantity: 100, unit: 'ml' }, after: { quantity: 400, unit: 'ml' } }]);
    expect(plan.into[0]).toEqual(plan.merges[0]);
    expect(plan.into.slice(1)).toEqual([null, null]);
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
    expect(plan.into.map((m) => m?.after.quantity)).toEqual([200, 400]);
  });
});
