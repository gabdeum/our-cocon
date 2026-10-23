import { describe, expect, it } from 'vitest';
import { tokenizeIngredients } from './ingredient-tokens';

const leek = { id: 'leek', name: 'Leeks' };
const cream = { id: 'cream', name: 'Double cream' };
const gruyere = { id: 'gruy', name: 'Gruyère' };
const onion = { id: 'onion', name: 'Onion', plural: 'onions' };
const salt = { id: 'salt', name: 'Salt' };
const all = [leek, cream, gruyere, onion, salt];
const body = (text: string) => {
  const r = tokenizeIngredients(text, all);
  return r.ok ? r.body : `unknown ${r.unknown}`;
};

describe('tokenizeIngredients (spec 023 FR-004)', () => {
  it('turns the first mention of each ingredient into its token', () => {
    expect(body('Soften the leeks, then add the leeks again.')).toBe('Soften {ing:leek}, then add the leeks again.');
  });

  it('ignores accents and capitals, and prefers the longer name', () => {
    expect(body('Stir in DOUBLE CREAM and grate the gruyere.')).toBe('Stir in {ing:cream} and grate {ing:gruy}.');
  });

  it('matches singular and plural', () => {
    expect(body('Slice 2 onions.')).toBe('Slice {ing:onion}.');
    expect(body('Wash the leek.')).toBe('Wash {ing:leek}.');
  });

  it('drops a written amount the token will say itself', () => {
    expect(body('Add 200 ml double cream and a pinch of salt.')).toBe('Add {ing:cream} and {ing:salt}.');
    expect(body('Add 1½ large onions.')).toBe('Add {ing:onion}.');
  });

  it('only matches whole words', () => {
    expect(body('Salty water, saltine crackers.')).toBe('Salty water, saltine crackers.');
  });

  it('leaves unmatched text and other tokens alone', () => {
    expect(body('Bake at {temp:180} until golden.')).toBe('Bake at {temp:180} until golden.');
    expect(body('Add the butter.')).toBe('Add the butter.');
  });

  it('takes tokens an assistant wrote by name or id', () => {
    expect(body('Add {ing:Double cream} then {ing:leek}.')).toBe('Add {ing:cream} then {ing:leek}.');
  });

  it('refuses a token for an ingredient that is not in the list, with its text', () => {
    expect(body('Add {ing:butter} and the leeks.')).toBe('unknown {ing:butter}');
  });
});

describe('on any text', () => {
  it('stays fast however long the text before a mention is (no regex backtracking)', () => {
    const names = Array.from({ length: 30 }, (_, i) => ({ id: `i${i}`, name: `Spice${String.fromCharCode(97 + (i % 26))}${i}` }));
    const text = `${'9'.repeat(1900)} x ${names.map((n) => n.name).join(' ')}`;
    const started = performance.now();
    for (let k = 0; k < 10; k++) tokenizeIngredients(text, names);
    expect(performance.now() - started).toBeLessThan(500);
  });
});
