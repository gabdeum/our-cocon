// Spec 022: the sheet's lines follow the recipe page (servings, variants), and the merge notes (US2).
import { describe, expect, it } from 'vitest';
import { quicheIds } from '@cocon/schemas/quiche.fixture';
import { mergeNotes, recipeGroceryLines } from './add-from-recipe';
import { defaultPanelChoices, type RecipeChoices } from './recipe-choices';
import { groceryItem } from '../test/fakes';
import { quicheDetail } from '../test/quiche-detail';

const cream = 'c0c01000-0000-4000-8000-000000000006';
const leeks = 'c0c01000-0000-4000-8000-000000000003';
const choices: RecipeChoices = { servings: 6, version: null, options: [], ...defaultPanelChoices, scaledBy: null };

describe('recipeGroceryLines', () => {
  it('US1: the quiche for 6, every ingredient with its amount as the page shows it', () => {
    const { servings, lines } = recipeGroceryLines(quicheDetail, choices);
    expect(servings).toBe('6');
    expect(lines.map((l) => [l.name, l.shown])).toEqual([
      ['Shortcrust pastry', '1 · 230 g'],
      ['Butter', '20 g'],
      ['Leeks', '2 · 300 g'],
      ['Bacon lardons', '200 g'],
      ['Eggs', '3 · 150 g'],
      ['Heavy cream', '300 ml'],
      ['Gruyère', '100 g'],
      ['Nutmeg', '1 pinch'],
    ]);
    expect(lines.find((l) => l.id === cream)).toMatchObject({ name: 'Heavy cream', catalog_key: 'heavy_cream', quantity: 300, unit: 'ml' });
  });

  it('edge: follows the servings and the version, and counts round up', () => {
    const { servings, lines } = recipeGroceryLines(quicheDetail, { ...choices, servings: 4, version: quicheIds.vegetarian });
    expect(servings).toBe('4');
    expect(lines.find((l) => l.name === 'Mushrooms')).toMatchObject({ quantity: 166.67, unit: 'g' });
    expect(lines.find((l) => l.name === 'Bacon lardons')).toBeUndefined();
    // 2 leeks for 6 is 1⅓ for 4: you buy 2.
    expect(lines.find((l) => l.id === leeks)?.quantity).toBe(2);
  });

  it('edge: an ingredient with no quantity is listed with no amount', () => {
    const recipe = { ...quicheDetail, ingredients: [...quicheDetail.ingredients, { id: 'salt', name: 'Salt and pepper', catalog_key: null, quantity: null, unit: null }] };
    const salt = recipeGroceryLines(recipe, choices).lines.find((l) => l.id === 'salt');
    expect(salt).toMatchObject({ name: 'Salt and pepper', shown: '', quantity: null, unit: null });
  });
});

describe('mergeNotes (US2)', () => {
  const { lines } = recipeGroceryLines(quicheDetail, choices);
  const listed = [groceryItem({ id: 'cream', name: 'Heavy cream', catalog_key: 'heavy_cream', quantity: 100, unit: 'ml' })];

  it('says what is already on the list and what it will be', () => {
    const notes = mergeNotes(listed, lines, new Set(lines.map((l) => l.id)), quicheDetail.facts);
    expect([...notes]).toEqual([[cream, 'Already on the list (100 ml) → will be 400 ml']]);
  });

  it('reads as the list will: my eggs and the recipe’s in one row', () => {
    const eggs = [groceryItem({ id: 'eggs', name: 'Eggs', catalog_key: 'egg', quantity: 6, unit: 'piece' })];
    const notes = mergeNotes(eggs, lines, new Set(lines.map((l) => l.id)), quicheDetail.facts);
    expect(notes.get('c0c01000-0000-4000-8000-000000000005')).toBe('Already on the list (6 pieces) → will be 9 pieces');
  });

  it('says nothing for an unticked line', () => {
    expect(mergeNotes(listed, lines, new Set(lines.filter((l) => l.id !== cream).map((l) => l.id)), quicheDetail.facts).size).toBe(0);
  });
});
