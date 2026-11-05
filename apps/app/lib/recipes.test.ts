// Spec 006 FR-004: search over the loaded list.
import { describe, expect, it } from 'vitest';
import { searchRecipes } from './recipes';

const recipes = [
  { name: 'Pumpkin soup', description: null, ingredientNames: ['Pumpkin'], best_months: [10, 11] },
  { name: 'Quiche', description: null, ingredientNames: ['Leeks', 'Gruyère'], best_months: [10] },
  { name: 'Apple tart', description: 'Grandma’s', ingredientNames: ['Apples'], best_months: [] },
  { name: 'Gazpacho', description: null, ingredientNames: ['Tomatoes'], best_months: [7, 8] },
];

describe('searchRecipes', () => {
  it('keeps the list order and ignores accents and case', () => {
    expect(searchRecipes(recipes, 'GRUYERE').map((r) => r.name)).toEqual(['Quiche']);
    expect(searchRecipes(recipes, 'p').map((r) => r.name)).toEqual(['Pumpkin soup', 'Apple tart', 'Gazpacho']);
    expect(searchRecipes(recipes, '')).toHaveLength(4);
  });
});
