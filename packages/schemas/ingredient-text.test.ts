import { describe, expect, it } from 'vitest';
import { foldText, normaliseName, parseIngredientText, singularWord } from './ingredient-text';

describe('foldText', () => {
  it('lower-cases and drops accents and punctuation', () => {
    expect(foldText('Gruyère')).toBe('gruyere');
    expect(foldText('Za’atar')).toBe('zaatar');
    expect(foldText("Za'atar")).toBe('zaatar');
    expect(foldText('All-Purpose  Flour')).toBe('all purpose flour');
  });
});

describe('singularWord', () => {
  it.each([
    ['leeks', 'leek'],
    ['tomatoes', 'tomato'],
    ['berries', 'berry'],
    ['radishes', 'radish'],
    ['peaches', 'peach'],
    ['leaves', 'leaf'],
    ['asparagus', 'asparagus'],
    ['couscous', 'couscous'],
    ['swiss', 'swiss'],
    ['egg', 'egg'],
    ['peas', 'pea'],
  ])('%s → %s', (plural, singular) => {
    expect(singularWord(plural)).toBe(singular);
  });
});

describe('normaliseName', () => {
  it('makes plurals, accents and case agree (edge case: "Leeks", "gruyere")', () => {
    expect(normaliseName('Leeks')).toBe(normaliseName('Leek'));
    expect(normaliseName('gruyere')).toBe(normaliseName('Gruyère'));
    expect(normaliseName('Cherry Tomatoes')).toBe('cherry tomato');
  });
});

describe('parseIngredientText', () => {
  it('keeps descriptors as a preparation note (edge case)', () => {
    expect(parseIngredientText('finely chopped red onions')).toEqual({
      full: 'finely chopped red onion',
      core: 'red onion',
      size_word: null,
      prep: 'finely chopped',
    });
  });

  it('takes the size word out (US1: "1 small onion")', () => {
    expect(parseIngredientText('1 small onion')).toEqual({ full: 'onion', core: 'onion', size_word: 'small', prep: null });
    expect(parseIngredientText('large eggs').size_word).toBe('large');
  });

  it('puts what follows a comma and brackets in the note', () => {
    expect(parseIngredientText('Unsalted butter, softened')).toEqual({
      full: 'unsalted butter',
      core: 'butter',
      size_word: null,
      prep: 'Unsalted, softened',
    });
    expect(parseIngredientText('garlic cloves (peeled)').prep).toBe('peeled');
  });

  it('keeps the whole name when only descriptors are left', () => {
    expect(parseIngredientText('ground beef')).toMatchObject({ full: 'ground beef', core: 'beef' });
    expect(parseIngredientText('fresh')).toMatchObject({ full: 'fresh', core: 'fresh' });
  });

  it('trims connecting words and caps the note at 80 characters', () => {
    expect(parseIngredientText('chopped and toasted walnuts').core).toBe('walnut');
    const long = parseIngredientText(`onion, ${'very '.repeat(30)}finely chopped`);
    expect(long.prep?.length).toBeLessThanOrEqual(80);
  });
});
