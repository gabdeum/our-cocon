import type { Unit } from '@cocon/schemas/recipes';
import type { IngredientFacts, MatchResult } from '@cocon/schemas/catalog';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { facts } from './catalog.fixture';
import { format } from './format';
import type { FormatOptions, IngredientFactsInput, QuantityIngredient } from './types';

const metric: FormatOptions = { system: 'metric', scale: true };
const imperial: FormatOptions = { system: 'imperial', scale: true };
const noScale: FormatOptions = { system: 'metric', scale: false };

const ing = (name: string, quantity: number | null, unit: Unit | null, extra: Partial<QuantityIngredient> = {}): QuantityIngredient => ({
  id: name,
  name,
  quantity,
  unit,
  ...extra,
});
const onion = (grams: number) => ing('Onion', grams, 'g', { facts: facts('onion') });
const phrase = (i: QuantityIngredient, o: FormatOptions = metric) => format(i, o).phrase;

it('takes the catalog view rows as they come', () => {
  expectTypeOf<IngredientFacts>().toExtend<IngredientFactsInput>();
  expectTypeOf<MatchResult>().toExtend<IngredientFactsInput>();
});

describe('US1: pieces at any serving size', () => {
  const leeks = ing('Leeks', 3, 'piece', { weight_per_piece_g: 150, piece_noun_singular: 'leek', piece_noun_plural: 'leeks', facts: facts('leek') });

  it('shows whole pieces with their weight', () => {
    expect(format(leeks, metric)).toEqual({ amount: '3', unit: '', sub: '450 g', phrase: '3 leeks (450 g)' });
  });

  it('rounds eggs to the nearest half and keeps their size', () => {
    const eggs = ing('Large eggs', 1.25, 'piece', { size_word: 'large', weight_per_piece_g: 50, piece_noun_singular: 'egg', piece_noun_plural: 'eggs', facts: facts('egg') });
    expect(format(eggs, metric)).toEqual({ amount: '1½', unit: 'large', sub: '63 g', phrase: '1½ large eggs (63 g)' });
    expect(phrase(eggs, noScale)).toBe('1½ large eggs');
  });

  it('shows singular up to one piece, never below ½', () => {
    expect(phrase(ing('Lemon', 0.2, 'piece'))).toBe('½ lemon');
    expect(phrase(ing('Lemons', 2, null))).toBe('2 lemons');
  });
});

describe('US2: units follow the person', () => {
  it.each([
    [ing('Heavy cream', 300, 'ml'), '1¼', 'cups'],
    [ing('Butter', 20, 'g', { facts: facts('butter') }), '0.7', 'oz'],
    [ing('Flour', 1.2, 'kg'), '2.6', 'lb'],
    [ing('Flour', 400, 'g'), '14.1', 'oz'],
    [ing('Milk', 60, 'ml'), '¼', 'cup'],
    [ing('Milk', 1, 'cup'), '1', 'cup'],
    [ing('Oil', 3, 'tbsp'), '3', 'tbsp'],
    [ing('Vanilla', 1, 'tsp'), '1', 'tsp'],
    [ing('Lemon juice', 10, 'ml'), '2', 'tsp'],
    [ing('Lemon juice', 14.5, 'ml'), '1', 'tbsp'],
    [ing('Lemon juice', 2.9, 'tsp'), '1', 'tbsp'],
    [ing('Milk', 58, 'ml'), '¼', 'cup'],
  ])('imperial: %o → %s %s', (i, amount, unit) => {
    expect(format(i, imperial)).toMatchObject({ amount, unit });
  });

  it.each([
    [ing('Flour', 250, 'g'), '250', 'g'],
    [ing('Flour', 999.7, 'g'), '1', 'kg'],
    [ing('Flour', 1.25, 'kg'), '1.3', 'kg'],
    [ing('Flour', 8, 'oz'), '227', 'g'],
    [ing('Heavy cream', 300, 'ml'), '300', 'ml'],
    [ing('Stock', 1.5, 'l'), '1.5', 'L'],
    [ing('Milk', 1, 'cup'), '237', 'ml'],
    [ing('Vanilla', 1, 'tsp'), '1', 'tsp'],
    [ing('Oil', 1.5, 'tbsp'), '1½', 'tbsp'],
    [ing('Oil', 6, 'tbsp'), '89', 'ml'],
  ])('metric: %o → %s %s', (i, amount, unit) => {
    expect(format(i, metric)).toMatchObject({ amount, unit });
  });

  it('shows cups and spoons without a kitchen scale', () => {
    expect(format(ing('Gruyère', 100, 'g', { facts: facts('gruyere') }), noScale)).toEqual({ amount: 'about 1', unit: 'cup', sub: null, phrase: 'about 1 cup gruyère' });
    expect(phrase(ing('Butter', 20, 'g', { facts: facts('butter') }), noScale)).toBe('about 1½ tbsp butter');
    expect(phrase(ing('Butter', 20, 'g', { facts: facts('butter') }), { system: 'imperial', scale: false })).toBe('about 1½ tbsp butter');
  });

  it('keeps the weight when there is no density', () => {
    expect(phrase(ing('Bacon lardons', 200, 'g'), noScale)).toBe('200 g bacon lardons');
  });
});

describe('US4: pieces read the way you cut them', () => {
  it.each([
    [onion(95), metric, '¾ onion (95 g)'],
    [onion(18), metric, '2 tbsp of onions (18 g)'],
    [ing('Onion', 0.5, 'piece', { size_word: 'small', weight_per_piece_g: 70, piece_noun_singular: 'onion', piece_noun_plural: 'onions', facts: facts('onion') }), metric, '¼ onion (35 g)'],
    [onion(250), metric, '2 medium onions (250 g)'],
    [onion(140), metric, '2 small onions (140 g)'],
    [onion(115), metric, '1 medium onion (115 g)'],
    [onion(180), metric, '1½ medium onions (180 g)'],
    [onion(400), metric, '2 large onions (400 g)'],
    [onion(7), metric, '2 tsp of onions (7 g)'],
    [onion(95), imperial, '¾ onion (3.4 oz)'],
    [onion(95), noScale, '¾ onion'],
    [onion(7), noScale, '2 tsp of onions'],
    [onion(0.2), metric, 'a pinch of onions'],
    // The tiny limit for onion is 27 g (90% of ¼ medium).
    [onion(26.9), metric, '2½ tbsp of onions (27 g)'],
    [onion(27), metric, '¼ onion (27 g)'],
    // Metric keeps spoons up to ¼ cup, then ml; imperial goes to cups.
    [ing('Pumpkin', 200, 'g', { facts: { size_medium_g: 1000, default_size: 'medium', plural: 'Pumpkins' } }), metric, '200 ml of pumpkins (200 g)'],
    [ing('Pumpkin', 200, 'g', { facts: { size_medium_g: 1000, default_size: 'medium', plural: 'Pumpkins' } }), imperial, '¾ cup of pumpkins (7.1 oz)'],
    // No density: spoons as if it were water.
    [ing('Leeks', 20, 'g', { facts: facts('leek') }), metric, '1½ tbsp of leeks (20 g)'],
    // A fraction of a piece after scaling.
    [ing('Leeks', 2.5, 'piece', { weight_per_piece_g: 150, piece_noun_singular: 'leek', piece_noun_plural: 'leeks', facts: facts('leek') }), metric, '2½ medium leeks (375 g)'],
  ])('%o → %s', (i, o, expected) => {
    expect(phrase(i, o)).toBe(expected);
  });

  it('fills the amount column with the count and the size word', () => {
    expect(format(onion(95), metric)).toEqual({ amount: '¾', unit: '', sub: '95 g', phrase: '¾ onion (95 g)' });
    expect(format(onion(250), metric)).toEqual({ amount: '2', unit: 'medium', sub: '250 g', phrase: '2 medium onions (250 g)' });
    expect(format(onion(7), metric)).toEqual({ amount: '2', unit: 'tsp', sub: '7 g', phrase: '2 tsp of onions (7 g)' });
  });

  it('uses the piece nouns', () => {
    expect(phrase(ing('Garlic', 2.5, 'piece', { weight_per_piece_g: 5, facts: facts('garlic') }))).toBe('2½ medium cloves (13 g)');
  });

  it('never cuts whole-only items', () => {
    expect(phrase(ing('Eggs', 100, 'g', { facts: facts('egg') }))).toBe('100 g eggs');
    expect(phrase(ing('Egg', 0.5, 'piece', { weight_per_piece_g: 50, piece_noun_singular: 'egg', piece_noun_plural: 'eggs', facts: facts('egg') }))).toBe('½ egg (25 g)');
  });

  it('leaves ingredients without sizes as they are', () => {
    expect(phrase(ing('Shallot', 1.5, 'piece', { weight_per_piece_g: 30 }))).toBe('1½ shallot (45 g)');
    const odd = { ...facts('onion'), default_size: 'large' as const, size_large_g: null };
    expect(phrase(ing('Onion', 95, 'g', { facts: odd }))).toBe('95 g onion');
  });

  it('works without a small size', () => {
    const noSmall = { ...facts('onion'), size_small_g: null };
    expect(phrase(ing('Onion', 30, 'g', { facts: noSmall }))).toBe('¼ onion (30 g)');
    expect(phrase(ing('Onion', 20, 'g', { facts: noSmall }))).toBe('2 tbsp of onions (20 g)');
  });
});

describe('edge cases', () => {
  it('shows the name only when there is no amount', () => {
    expect(format(ing('Salt and pepper', null, null), metric)).toEqual({ amount: '', unit: '', sub: null, phrase: 'Salt and pepper' });
    expect(phrase(ing('Salt', 0, 'g'))).toBe('Salt');
  });

  it('counts pinches and never weighs them', () => {
    expect(format(ing('Nutmeg', 1, 'pinch'), metric)).toEqual({ amount: '1', unit: 'pinch', sub: null, phrase: '1 pinch of nutmeg' });
    expect(phrase(ing('Nutmeg', 1.25, 'pinch'))).toBe('1 pinch of nutmeg');
    expect(phrase(ing('Nutmeg', 0.3, 'pinch'))).toBe('1 pinch of nutmeg');
    expect(phrase(ing('Nutmeg', 2, 'pinch'), imperial)).toBe('2 pinches of nutmeg');
    expect(phrase(ing('Nutmeg', 1.5, 'pinch'))).toBe('2 pinches of nutmeg');
  });

  it('never shows 0', () => {
    expect(format(ing('Salt', 0.2, 'g'), metric)).toEqual({ amount: 'a pinch', unit: '', sub: null, phrase: 'a pinch of salt' });
    expect(phrase(ing('Salt', 0.2, 'g'), imperial)).toBe('a pinch of salt');
    expect(phrase(ing('Vanilla', 0.3, 'ml'))).toBe('a pinch of vanilla');
    expect(phrase(ing('Vanilla', 0.3, 'ml'), imperial)).toBe('a pinch of vanilla');
    expect(phrase(ing('Salt', 0.1, 'g', { facts: facts('salt') }), noScale)).toBe('a pinch of salt');
  });

  it('throws typed errors for amounts that make no sense', () => {
    expect(() => format(ing('Flour', null, 'g'), metric)).toThrow(expect.objectContaining({ code: 'invalid_quantity' }));
    expect(() => format(ing('Flour', -1, 'g'), metric)).toThrow(expect.objectContaining({ code: 'invalid_quantity' }));
    expect(() => format(ing('Flour', Number.NaN, 'g'), metric)).toThrow(expect.objectContaining({ code: 'invalid_quantity' }));
  });
});
