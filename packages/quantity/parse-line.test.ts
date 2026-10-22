import { describe, expect, it } from 'vitest';
import { amountInput, parseAmount } from './parse-amount';
import { lines } from './parse-line.fixture';
import { parseGroceryLine, parseIngredientLine, parsePastedList, pieceNouns, splitPastedList } from './parse-line';

describe('amountInput (FR-001)', () => {
  it('keeps only what makes an amount', () => {
    expect(amountInput('2 eggs')).toBe('2 ');
    expect(amountInput('abc')).toBe('');
    expect(amountInput('1 1/2')).toBe('1 1/2');
    expect(amountInput('1½')).toBe('1½');
    expect(amountInput('1,5')).toBe('1.5');
    expect(amountInput('2-3')).toBe('2-3');
  });

  it('keeps only digits and a point for a weight', () => {
    expect(amountInput('150 g', { fractions: false })).toBe('150');
    expect(amountInput('1/2', { fractions: false })).toBe('12');
    expect(amountInput('12,5', { fractions: false })).toBe('12.5');
  });
});

describe('parseAmount (FR-001)', () => {
  it.each([
    ['2', 2],
    ['1.5', 1.5],
    ['1½', 1.5],
    ['½', 0.5],
    ['1/2', 0.5],
    ['1 1/2', 1.5],
    [' 3 ', 3],
    ['2-3', 2],
  ])('reads "%s"', (text, value) => {
    expect(parseAmount(text)).toBeCloseTo(value);
  });

  it('is empty for nothing and invalid for anything else', () => {
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('  ')).toBeNull();
    expect(parseAmount('abc')).toBe('invalid');
    expect(parseAmount('2 eggs')).toBe('invalid');
    expect(parseAmount('0')).toBe('invalid');
    expect(parseAmount('1/0')).toBe('invalid');
    expect(parseAmount('100000')).toBe('invalid');
  });
});

describe('the paste parser (FR-003)', () => {
  it('US1: "200 g lardons, 3 eggs, 300 ml cream" makes 3 rows', () => {
    expect(parsePastedList('200 g lardons, 3 eggs, 300 ml cream')).toEqual([
      { name: 'Lardons', quantity: 200, unit: 'g', size_word: null, piece_noun: null },
      { name: 'Eggs', quantity: 3, unit: 'piece', size_word: null, piece_noun: null },
      { name: 'Cream', quantity: 300, unit: 'ml', size_word: null, piece_noun: null },
    ]);
  });

  it('splits on new lines too, and keeps preparation with its line', () => {
    expect(splitPastedList('1 onion, finely chopped\n2 carrots\n\nsalt, to taste')).toEqual(['1 onion, finely chopped', '2 carrots', 'salt, to taste']);
    expect(splitPastedList('salt, pepper')).toEqual(['salt', 'pepper']);
    expect(splitPastedList('chopped\nparsley')).toEqual(['chopped', 'parsley']);
  });

  it('keeps commas in brackets and decimal commas', () => {
    expect(splitPastedList('1 can (400 g, drained) beans, 1,5 kg flour')).toEqual(['1 can (400 g, drained) beans', '1,5 kg flour']);
  });

  it('understands the four FR-003 shapes', () => {
    expect(parseIngredientLine('1½ cups flour')).toMatchObject({ name: 'Flour', quantity: 1.5, unit: 'cup' });
    expect(parseIngredientLine('2 small onions')).toMatchObject({ name: 'Onions', quantity: 2, unit: 'piece', size_word: 'small' });
  });

  it('"Salt and pepper to taste" has no quantity and no unit', () => {
    expect(parseIngredientLine('Salt and pepper to taste')).toMatchObject({ quantity: null, unit: null });
  });

  it('keeps what a counted piece is called', () => {
    expect(parseIngredientLine('2 cloves garlic')).toMatchObject({ name: 'Garlic', unit: 'piece', piece_noun: { singular: 'clove', plural: 'cloves' } });
  });

  it('SC-001: splits at least 90 of 100 real-world lines right', () => {
    expect(lines).toHaveLength(100);
    const wrong = lines.filter(([line, name, quantity, unit, size]) => {
      const p = parseIngredientLine(line);
      return !p || p.name !== name || (quantity === null ? p.quantity !== null : Math.abs((p.quantity ?? 0) - quantity) > 1e-6) || p.unit !== unit || p.size_word !== (size ?? null);
    });
    expect(100 - wrong.length, `Wrong: ${wrong.map((w) => w[0]).join(' | ')}`).toBeGreaterThanOrEqual(90);
  });
});

describe('pieceNouns', () => {
  it.each([
    ['Leeks', 'leek', 'leeks'],
    ['Egg', 'egg', 'eggs'],
    ['Tomatoes', 'tomato', 'tomatoes'],
    ['Cherry', 'cherry', 'cherries'],
    ['Red onions, finely chopped', 'red onion', 'red onions'],
    ['Peach', 'peach', 'peaches'],
  ])('%s → %s / %s', (name, singular, plural) => {
    expect(pieceNouns(name)).toEqual({ singular, plural });
  });
});

describe('parseGroceryLine (spec 020 FR-002)', () => {
  const read = (line: string) => {
    const p = parseGroceryLine(line);
    return p && [p.quantity, p.unit, p.name];
  };

  it('reads the amount after the name, as lists are often written', () => {
    expect(read('Gruyere 120g')).toEqual([120, 'g', 'Gruyere']);
    expect(read('Lemon 12')).toEqual([12, 'piece', 'Lemon']);
    expect(read('heavy cream 240 ml')).toEqual([240, 'ml', 'Heavy cream']);
    expect(read('Flour 1.5 kg')).toEqual([1.5, 'kg', 'Flour']);
    expect(read('Butter ½ lb')).toEqual([0.5, 'lb', 'Butter']);
  });

  it('still reads it first, and leaves numbers that are part of the name', () => {
    expect(read('2 lemons')).toEqual([2, 'piece', 'Lemons']);
    expect(read('120 g Gruyère')).toEqual([120, 'g', 'Gruyère']);
    expect(read('Size 4 nappies')).toEqual([null, null, 'Size 4 nappies']);
    expect(read('Salt')).toEqual([null, null, 'Salt']);
    expect(read('12')).toBeNull();
  });
});
