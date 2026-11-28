import { describe, expect, it } from 'vitest';
import { parseGroceryLine, parseIngredientLine, parsePastedList } from './parse-line';

// Spec 078 FR-005 and SC-002: pasted lines in French and Spanish.

describe('French', () => {
  it.each([
    ['2 c. à soupe d’huile d’olive', { quantity: 2, unit: 'tbsp', name: 'Huile d’olive' }],
    ['1 cuillère à café de sel', { quantity: 1, unit: 'tsp', name: 'Sel' }],
    ['200 g de farine', { quantity: 200, unit: 'g', name: 'Farine' }],
    ['3 gousses d’ail', { quantity: 3, unit: 'piece', name: 'Ail' }],
    ['1 gros oignon', { quantity: 1, unit: 'piece', size_word: 'large', name: 'Oignon' }],
    ['une pincée de sel', { quantity: 1, unit: 'pinch', name: 'Sel' }],
  ])('%s', (line, expected) => expect(parseIngredientLine(line)).toMatchObject(expected));
});

describe('Spanish', () => {
  it.each([
    ['1 cucharada de aceite', { quantity: 1, unit: 'tbsp', name: 'Aceite' }],
    ['2 dientes de ajo', { quantity: 2, unit: 'piece', name: 'Ajo', piece_noun: { singular: 'diente', plural: 'dientes' } }],
    ['500 gramos de harina', { quantity: 500, unit: 'g', name: 'Harina' }],
    ['una pizca de sal', { quantity: 1, unit: 'pinch', name: 'Sal' }],
    ['1 cebolla grande', { quantity: 1, unit: 'piece', name: 'Cebolla grande' }],
  ])('%s', (line, expected) => expect(parseIngredientLine(line)).toMatchObject(expected));
});

it('keeps English as it was', () => {
  expect(parseIngredientLine('2 cups of flour')).toMatchObject({ quantity: 2, unit: 'cup', name: 'Flour' });
  expect(parsePastedList('200 g lardons\n3 eggs')).toHaveLength(2);
  expect(parseGroceryLine('lait 1 l')).toMatchObject({ name: 'Lait', quantity: 1, unit: 'l' });
});
