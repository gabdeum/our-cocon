import { describe, expect, it } from 'vitest';
import { facts } from './catalog.fixture';
import { format } from './format';
import { scale, type ScalableRecipe } from './scale';
import type { QuantityIngredient } from './types';

const quiche: ScalableRecipe = {
  serves: 6,
  ingredients: [
    { id: 'leek', name: 'Leeks', quantity: 2, unit: 'piece', weight_per_piece_g: 150, piece_noun_singular: 'leek', piece_noun_plural: 'leeks', facts: facts('leek') },
    { id: 'lardons', name: 'Bacon lardons', quantity: 200, unit: 'g' },
    { id: 'eggs', name: 'Large eggs', quantity: 3, unit: 'piece', size_word: 'large', weight_per_piece_g: 50, piece_noun_singular: 'egg', piece_noun_plural: 'eggs', facts: facts('egg') },
    { id: 'cream', name: 'Heavy cream', quantity: 300, unit: 'ml' },
    { id: 'nutmeg', name: 'Nutmeg', quantity: 1, unit: 'pinch' },
    { id: 'salt', name: 'Salt and pepper' },
  ],
};
const metric = { system: 'metric', scale: true } as const;
const at = (list: QuantityIngredient[], i: number) => list[i] as QuantityIngredient;
const quantities = (r: ReturnType<typeof scale>) => Object.fromEntries(r.ingredients.map((i) => [i.id, i.quantity]));

describe('by servings', () => {
  it('US1: 6 → 9 servings gives 3 leeks (450 g)', () => {
    const r = scale(quiche, { servings: 9 });
    expect(r.factor).toBe(1.5);
    expect(r.servings).toBe(9);
    expect(format(at(r.ingredients, 0), metric).phrase).toBe('3 leeks (450 g)');
  });

  it('US1: eggs ×1.25 read 1½, and items without an amount stay as they are', () => {
    const one = { serves: 4, ingredients: [{ ...at(quiche.ingredients, 2), quantity: 1 }, at(quiche.ingredients, 5)] };
    const r = scale(one, { servings: 5 });
    expect(format(at(r.ingredients, 0), { system: 'metric', scale: false }).phrase).toBe('1½ eggs');
    expect(r.ingredients[1]).toBe(one.ingredients[1]);
  });

  it('never changes the recipe it was given', () => {
    scale(quiche, { servings: 12 });
    expect(at(quiche.ingredients, 0).quantity).toBe(2);
  });
});

describe('by an ingredient (spec 013)', () => {
  it('250 g of lardons is ×1.25, about 7½ servings, eggs rounded to whole', () => {
    const r = scale(quiche, { ingredientId: 'lardons', amount: 250, unit: 'g' });
    expect(r.factor).toBe(1.25);
    expect(r.servings).toBe(7.5);
    expect(quantities(r)).toMatchObject({ leek: 2.5, lardons: 250, eggs: 4, cream: 375, nutmeg: 1.25 });
  });

  it('converts what you have into the ingredient unit', () => {
    expect(scale(quiche, { ingredientId: 'lardons', amount: 0.5, unit: 'kg' }).factor).toBe(2.5);
    expect(scale(quiche, { ingredientId: 'cream', amount: 0.6, unit: 'l' }).factor).toBeCloseTo(2, 9);
    expect(scale(quiche, { ingredientId: 'leek', amount: 3, unit: 'piece' }).factor).toBe(1.5);
    // Pieces can be weighed through their saved piece weight.
    expect(scale(quiche, { ingredientId: 'leek', amount: 450, unit: 'g' }).factor).toBe(1.5);
    // Without a saved piece weight, the catalog size.
    const onion = { serves: 2, ingredients: [{ id: 'o', name: 'Onion', quantity: 1, unit: 'piece' as const, facts: facts('onion') }] };
    expect(scale(onion, { ingredientId: 'o', amount: 240, unit: 'g' }).factor).toBe(2);
    // A whole-only item never rounds below one.
    expect(quantities(scale(quiche, { ingredientId: 'lardons', amount: 20, unit: 'g' })).eggs).toBe(1);
  });

  it('weighs a volume with the catalog density', () => {
    const butter = { serves: 2, ingredients: [{ id: 'b', name: 'Butter', quantity: 100, unit: 'g' as const, facts: facts('butter') }] };
    expect(scale(butter, { ingredientId: 'b', amount: 1, unit: 'cup' }).factor).toBeCloseTo(2.271, 3);
  });

  it.each([
    [{ ingredientId: 'nope', amount: 1, unit: 'g' }, 'unknown_ingredient'],
    [{ ingredientId: 'salt', amount: 1, unit: 'g' }, 'invalid_quantity'],
    [{ ingredientId: 'lardons', amount: 0, unit: 'g' }, 'invalid_quantity'],
    [{ ingredientId: 'lardons', amount: -2, unit: 'g' }, 'invalid_quantity'],
    [{ ingredientId: 'lardons', amount: 250, unit: 'ml' }, 'incompatible_units'],
    [{ ingredientId: 'lardons', amount: 2, unit: 'piece' }, 'incompatible_units'],
    [{ ingredientId: 'nutmeg', amount: 2, unit: 'pinch' }, 'incompatible_units'],
    [{ ingredientId: 'leek', amount: 1, unit: 'cup' }, 'incompatible_units'],
    [{ servings: 0 }, 'invalid_quantity'],
    [{ servings: Number.NaN }, 'invalid_quantity'],
  ] as const)('%o throws %s', (by, code) => {
    expect(() => scale(quiche, by)).toThrow(expect.objectContaining({ code }));
  });

  it('needs a recipe that serves someone', () => {
    expect(() => scale({ ...quiche, serves: 0 }, { servings: 2 })).toThrow(expect.objectContaining({ code: 'invalid_quantity' }));
  });
});
