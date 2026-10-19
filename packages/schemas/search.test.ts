import { describe, expect, it } from 'vitest';
import { normalizeText, recipeMatches, type SearchableRecipe } from './search';

const quiche: SearchableRecipe = {
  name: 'Leek & bacon quiche',
  description: 'Silky custard, sweet leeks and a crisp, buttery crust.',
  ingredientNames: ['Shortcrust pastry', 'Leeks', 'Gruyère', 'Heavy cream'],
};
const tart: SearchableRecipe = { name: 'Grandma’s apple tart', description: null, ingredientNames: ['Apples', 'Butter'] };

describe('normalizeText', () => {
  it('strips accents and case, and straightens apostrophes', () => {
    expect(normalizeText('Gruyère CRÈME brûlée')).toBe('gruyere creme brulee');
    expect(normalizeText('Grandma’s')).toBe("grandma's");
  });
});

describe('recipeMatches (spec 006 FR-004)', () => {
  it('finds a recipe by an ingredient, ignoring accents and case', () => {
    expect(recipeMatches({ ...quiche, name: 'Quiche' }, 'leek')).toBe(true);
    expect(recipeMatches(quiche, 'gruyere')).toBe(true);
    expect(recipeMatches(quiche, 'LEEK')).toBe(true);
  });

  it('searches the name and the description', () => {
    expect(recipeMatches(quiche, 'quiche')).toBe(true);
    expect(recipeMatches(quiche, 'buttery')).toBe(true);
  });

  it('needs every word to match somewhere', () => {
    expect(recipeMatches(quiche, 'leek cream')).toBe(true);
    expect(recipeMatches(quiche, 'leek apple')).toBe(false);
  });

  it("treats ' and ’ the same", () => {
    expect(recipeMatches(tart, "grandma's")).toBe(true);
  });

  it('matches everything for an empty query, nothing for an unknown word', () => {
    expect(recipeMatches(tart, '   ')).toBe(true);
    expect(recipeMatches(tart, 'xyz')).toBe(false);
  });

  it('SC-001: filters 500 recipes in well under 200 ms', () => {
    const list = Array.from({ length: 500 }, (_, i) => ({
      name: `Recipe ${i} with a fairly long name`,
      description: 'A description of about the length people write, with a few words.',
      ingredientNames: Array.from({ length: 10 }, (_, j) => `Ingrédient ${i}-${j}`),
    }));
    const times = Array.from({ length: 5 }, () => {
      const start = performance.now();
      list.filter((r) => recipeMatches(r, 'ingredient 42'));
      return performance.now() - start;
    }).sort((a, b) => a - b);
    expect(times[2]).toBeLessThan(200);
  });
});
