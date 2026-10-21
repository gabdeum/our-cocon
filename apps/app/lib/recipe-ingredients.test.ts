// Spec 015: reading the ingredient rows on Save (US3 and the edge cases), the catalog's weight of
// one piece (US2), and which steps use an ingredient (the remove dialog).
import { describe, expect, it } from 'vitest';
import { applyMatch, draftsFromRows, emptyDraft, ingredientsChanged, quantityText, readIngredients, sizesOf, stepsUsing, withName, withUnit, type FormFacts, type IngredientDraft } from './recipe-ingredients';

const row = (over: Partial<IngredientDraft>): IngredientDraft => ({ ...emptyDraft(over.id ?? 'id-1'), ...over });
const leek: FormFacts = { catalog_key: 'leek', name: 'Leek', plural: 'Leeks', size_small_g: 100, size_medium_g: 150, size_large_g: 220, default_size: 'medium', noun_singular: null, noun_plural: null };

describe('readIngredients (US3)', () => {
  it('warns about a quantity with no unit, and saves nothing', () => {
    const r = row({ name: 'Heavy cream', quantity: '300' });
    expect(readIngredients([r])).toEqual({ warnings: { [r.key]: 'unitMissing' } });
  });

  it('allows "Salt and pepper to taste" with no quantity and no unit', () => {
    const r = readIngredients([row({ name: 'Salt and pepper to taste' })]);
    expect(r).toEqual({ rows: [expect.objectContaining({ name: 'Salt and pepper to taste', quantity: null, unit: null })] });
  });

  it('reads fractions, and gives pieces their nouns and weight', () => {
    const r = readIngredients([row({ id: 'a', name: 'Leeks', quantity: '1½', unit: 'piece', weight: '150' })]);
    expect(r).toEqual({
      rows: [expect.objectContaining({ id: 'a', quantity: 1.5, unit: 'piece', weight_per_piece_g: 150, piece_noun_singular: 'leek', piece_noun_plural: 'leeks' })],
    });
  });

  it('calls a piece what the pasted line said, else the catalog, else the name', () => {
    const garlic: FormFacts = { ...leek, catalog_key: 'garlic', name: 'Garlic', plural: 'Garlic', noun_singular: 'clove', noun_plural: 'cloves' };
    const pasted = row({ name: 'Garlic', quantity: '2', unit: 'piece', nounSingular: 'clove', nounPlural: 'cloves' });
    const linked = applyMatch(row({ name: 'Garlic', quantity: '2', unit: 'piece' }), garlic);
    const named = row({ name: 'Leeks', quantity: '2', unit: 'piece' });
    const r = readIngredients([pasted, linked, named]);
    expect('rows' in r && r.rows.map((x) => [x.piece_noun_singular, x.piece_noun_plural])).toEqual([
      ['clove', 'cloves'],
      ['clove', 'cloves'],
      ['leek', 'leeks'],
    ]);
  });

  it('forgets what a piece was called when the row is renamed', () => {
    const renamed = withName(row({ name: 'Garlic', quantity: '2', unit: 'piece', nounSingular: 'clove', nounPlural: 'cloves' }), 'Shallots');
    expect(readIngredients([renamed])).toEqual({ rows: [expect.objectContaining({ piece_noun_singular: 'shallot', piece_noun_plural: 'shallots' })] });
  });

  it('says what else is wrong, one warning per row', () => {
    const flour = row({ name: 'Flour', quantity: 'lots', unit: 'g' });
    const milk = row({ name: 'Milk', unit: 'ml' });
    const nameless = row({ quantity: '2', unit: 'piece' });
    const eggs = row({ name: 'Eggs', quantity: '2', unit: 'piece', weight: 'heavy' });
    expect(readIngredients([flour, milk, nameless, eggs])).toEqual({
      warnings: { [flour.key]: 'quantityInvalid', [milk.key]: 'amountMissing', [nameless.key]: 'nameMissing', [eggs.key]: 'weightInvalid' },
    });
  });

  it('drops rows left empty and saves the rest in order', () => {
    const r = readIngredients([row({ id: 'a', name: 'Salt' }), row({ id: 'b' }), row({ id: 'c', name: 'Pepper' })]);
    expect('rows' in r && r.rows.map((x) => x.id)).toEqual(['a', 'c']);
  });

  it('drops the size and weight when the unit is no longer pieces', () => {
    const r = readIngredients([row({ name: 'Onion', quantity: '200', unit: 'g', sizeWord: 'small', weight: '80' })]);
    expect(r).toEqual({ rows: [expect.objectContaining({ unit: 'g', size_word: null, weight_per_piece_g: null })] });
  });
});

describe('the catalog (US2)', () => {
  it('suggests the weight of a medium piece', () => {
    const r = applyMatch(row({ name: 'Leeks', quantity: '2', unit: 'piece' }), leek);
    expect(r).toMatchObject({ catalogKey: 'leek', weight: '150', isNew: false });
  });

  it('follows the size picked in the unit list, unless a weight was typed', () => {
    const linked = applyMatch(row({ name: 'Leeks', quantity: '2', unit: 'piece' }), leek);
    expect(withUnit(linked, 'piece', 'large').weight).toBe('220');
    expect(withUnit({ ...linked, weight: '170' }, 'piece', 'large').weight).toBe('170');
    expect(sizesOf(leek)).toEqual(['small', 'medium', 'large']);
  });

  it('marks a name the catalog doesn\'t know as new, and forgets the link when the name changes', () => {
    expect(applyMatch(row({ name: 'Grandma\'s spice mix' }), null).isNew).toBe(true);
    const linked = applyMatch(row({ name: 'Leeks' }), leek);
    expect(withName(linked, 'Leek tops')).toMatchObject({ catalogKey: null, facts: null, isNew: false });
  });

  it('takes the catalog name for a picked suggestion', () => {
    expect(applyMatch(row({ name: 'lee' }), leek, true).name).toBe('Leek');
  });
});

describe('loading and comparing', () => {
  it('shows saved amounts as people type them', () => {
    expect(quantityText(1.5)).toBe('1½');
    expect(quantityText(1 / 3)).toBe('⅓');
    expect(quantityText(200)).toBe('200');
    expect(quantityText(0.15)).toBe('0.15');
  });

  it('notices a change, a reorder and a removal, but not an empty row', () => {
    const [salt, eggs] = draftsFromRows(
      [
        { id: 'a', position: 1, name: 'Eggs', quantity: 3, unit: 'piece' },
        { id: 'b', position: 0, name: 'Salt' },
      ],
      {},
    );
    if (!salt || !eggs) throw new Error('two rows');
    const start = [salt, eggs];
    expect(start.map((d) => d.name)).toEqual(['Salt', 'Eggs']);
    expect(ingredientsChanged(start, [...start, emptyDraft('c')])).toBe(false);
    expect(ingredientsChanged(start, [eggs, salt])).toBe(true);
    expect(ingredientsChanged(start, [salt])).toBe(true);
    expect(ingredientsChanged(start, [salt, { ...eggs, quantity: '4' }])).toBe(true);
  });

  it('finds the steps that use an ingredient', () => {
    const steps = [
      { position: 1, body: 'Add {ing:a} and stir.' },
      { position: 0, body: 'Heat the pan.' },
      { position: 2, body: 'Top with {ing:a}.' },
    ];
    expect(stepsUsing('a', steps)).toEqual([2, 3]);
    expect(stepsUsing('b', steps)).toEqual([]);
  });
});
