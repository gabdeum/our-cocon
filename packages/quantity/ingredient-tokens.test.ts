import { describe, expect, it } from 'vitest';
import { tokenizeIngredients } from './ingredient-tokens';

const leek = { id: 'leek', name: 'Leeks' };
const cream = { id: 'cream', name: 'Double cream' };
const gruyere = { id: 'gruy', name: 'Gruyère' };
const onion = { id: 'onion', name: 'Onion', plural: 'onions' };
const salt = { id: 'salt', name: 'Salt' };
const all = [leek, cream, gruyere, onion, salt];
const body = (text: string, rows = all, used: ReadonlySet<string> = new Set()) => {
  const r = tokenizeIngredients(text, rows, used);
  if (r.ok) return r.body;
  return r.reason === 'ambiguous' ? `ambiguous ${r.token}: ${r.names.join(', ')}` : `${r.reason} ${r.token}`;
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

describe('rows of one ingredient', () => {
  const sauce = { id: 'sauce', name: 'Onion (sauce)', plural: 'onions' };
  const topping = { id: 'topping', name: 'Onion (topping)', plural: 'onions' };
  const cooked = { id: 'cooked', name: 'Onion, cooked', plural: 'onions' };

  it('takes a token by its full name first', () => {
    expect(body('Soften {ing:Onion (sauce)}.', [sauce, topping])).toBe('Soften {ing:sauce}.');
    expect(body('Scatter {ing:onion (Topping)} over.', [sauce, topping])).toBe('Scatter {ing:topping} over.');
  });

  it('takes the short name when only one row has it', () => {
    expect(body('Add {ing:onion}.', [cooked, leek])).toBe('Add {ing:cooked}.');
    expect(body('Add the onions.', [cooked, leek])).toBe('Add {ing:cooked}.');
  });

  it('refuses a short name several rows have, naming them; plain text stays text', () => {
    expect(body('Add {ing:onion}.', [sauce, topping])).toBe('ambiguous {ing:onion}: Onion (sauce), Onion (topping)');
    expect(body('Add the onion.', [sauce, topping])).toBe('Add the onion.');
  });

  it('a full name matching exactly wins over a shared short name', () => {
    expect(body('Add {ing:onion}.', [onion, sauce])).toBe('Add {ing:onion}.');
  });
});

describe('one step per ingredient', () => {
  it('leaves plain mentions of what an earlier step uses as text', () => {
    expect(body('Add the leeks and the double cream.', all, new Set(['leek']))).toBe('Add the leeks and {ing:cream}.');
  });

  it('refuses a token for what an earlier step, or this one, already uses', () => {
    expect(body('Add {ing:Leeks}.', all, new Set(['leek']))).toBe('repeated {ing:Leeks}');
    expect(body('Add {ing:Leeks}, then {ing:leek}.')).toBe('repeated {ing:leek}');
  });

  it('says which ingredients the step mentions', () => {
    const r = tokenizeIngredients('Add {ing:Double cream} and the leeks.', all);
    expect(r.ok && r.ids.sort()).toEqual(['cream', 'leek']);
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
