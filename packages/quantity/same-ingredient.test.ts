import { describe, expect, it } from 'vitest';
import { facts } from './catalog.fixture';
import { firstRowShare, groupSameIngredient, sumIngredients } from './same-ingredient';
import type { QuantityIngredient } from './types';

const row = (id: string, name: string, quantity: number | null, unit: QuantityIngredient['unit'], more: Partial<QuantityIngredient & { catalog_key: string | null }> = {}) => ({
  id,
  name,
  quantity,
  unit,
  catalog_key: null as string | null,
  ...more,
});

describe('groupSameIngredient', () => {
  it('groups by catalog item, else by the name cooks read, where each first appears', () => {
    const rows = [
      row('a', 'Onion (sauce)', 1, 'piece', { catalog_key: 'onion' }),
      row('b', 'Butter', 20, 'g'),
      row('c', 'Onion (topping)', 1, 'piece', { catalog_key: 'onion' }),
      row('d', 'butter, softened', 10, 'g'),
      row('e', 'Water', 100, 'ml'),
    ];
    expect(groupSameIngredient(rows).map((g) => g.map((r) => r.id))).toEqual([['a', 'c'], ['b', 'd'], ['e']]);
  });
});

describe('sumIngredients', () => {
  it('adds amounts in the same unit', () => {
    expect(sumIngredients([row('a', 'Onion (sauce)', 1, 'piece'), row('b', 'Onion (topping)', 2, 'piece')])).toMatchObject({ id: 'a', quantity: 3, unit: 'piece' });
  });

  it('converts to the first amount’s unit', () => {
    expect(sumIngredients([row('a', 'Butter', 1, 'tbsp'), row('b', 'Butter', 1, 'tsp')])?.quantity).toBeCloseTo(4 / 3);
    expect(sumIngredients([row('a', 'Butter', 1, 'kg'), row('b', 'Butter', 250, 'g')])).toMatchObject({ quantity: 1.25, unit: 'kg' });
  });

  it('goes through the density and piece weights', () => {
    const onion = facts('onion');
    const s = sumIngredients([row('a', 'Onion', 1, 'piece', { facts: onion }), row('b', 'Onion', 2 * (onion.size_medium_g as number), 'g', { facts: onion })]);
    expect(s?.unit).toBe('piece');
    expect(s?.quantity).toBeCloseTo(3);
  });

  it('skips rows with no amount, and keeps one with none when all have none', () => {
    expect(sumIngredients([row('a', 'Salt', null, null), row('b', 'Salt', 1, 'pinch')])).toMatchObject({ id: 'b', quantity: 1 });
    expect(sumIngredients([row('a', 'Salt', null, null), row('b', 'Salt', null, null)])).toMatchObject({ id: 'a', quantity: null });
  });

  it('is null when the amounts don’t add up', () => {
    expect(sumIngredients([row('a', 'Mystery', 100, 'g'), row('b', 'Mystery', 1, 'cup')])).toBeNull();
  });
});

describe('firstRowShare', () => {
  it('is the first row’s part of the total', () => {
    expect(firstRowShare([row('a', 'Onion (sauce)', 1, 'piece'), row('b', 'Onion (topping)', 3, 'piece')])).toBe(0.25);
    expect(firstRowShare([row('a', 'Butter', 1, 'tbsp'), row('b', 'Butter', 1, 'tbsp')])).toBe(0.5);
  });

  it('is null when the first row has no amount or they don’t add up', () => {
    expect(firstRowShare([row('a', 'Salt', null, null), row('b', 'Salt', 1, 'g')])).toBeNull();
    expect(firstRowShare([row('a', 'Mystery', 100, 'g'), row('b', 'Mystery', 1, 'cup')])).toBeNull();
  });
});
