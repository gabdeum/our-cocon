// Spec 020: what the grocery list shows (aisles, source lines, Need, recipe cards, who's shopping).
import { describe, expect, it } from 'vitest';
import { amountText, editText, groupByAisle, needText, recipeCards, shopper, sourceLine, toBuyCount } from './groceries';
import { alex, gabriel, groceryItem, mia } from '../test/fakes';

const members = [gabriel, alex, mia];
const quiche = { id: 'r-quiche', name: 'Leek & bacon quiche', serves: 6, photo_path: null, deleted_at: null };

describe('groupByAisle (FR-001)', () => {
  it('follows the catalog order, leaves out empty aisles, and puts unknown items in Other', () => {
    const items = [
      groceryItem({ id: 'a', aisle: 'bakery' }),
      groceryItem({ id: 'b', aisle: null }),
      groceryItem({ id: 'c', aisle: 'produce' }),
      groceryItem({ id: 'd', aisle: 'dairy_eggs' }),
      groceryItem({ id: 'e', aisle: 'produce' }),
    ];
    expect(groupByAisle(items).map((g) => [g.aisle, g.items.map((i) => i.id)])).toEqual([
      ['produce', ['c', 'e']],
      ['bakery', ['a']],
      ['dairy_eggs', ['d']],
      ['other', ['b']],
    ]);
  });
});

describe('toBuyCount', () => {
  it('counts what is not ticked', () => {
    expect(toBuyCount([groceryItem({}), groceryItem({ checked: true }), groceryItem({})])).toBe(2);
  });
});

describe('sourceLine (FR-003)', () => {
  it('names the recipe, the person, or the person and their assistant', () => {
    expect(sourceLine(groceryItem({ recipes: quiche }), members)).toBe('For Leek & bacon quiche');
    expect(sourceLine(groceryItem({ created_by: mia.user_id }), members)).toBe('Added by Mia');
    expect(sourceLine(groceryItem({ created_by: alex.user_id, source: 'chatgpt' }), members)).toBe('Alex via ChatGPT');
    expect(sourceLine(groceryItem({ created_by: 'u-gone' }), members)).toBe('Added by Former member');
  });
});

describe('Need', () => {
  it('reads amounts through @cocon/quantity; a count stands alone', () => {
    expect(needText(groceryItem({}))).toBe('Need 2');
    expect(needText(groceryItem({ quantity: 300, unit: 'ml' }))).toBe('Need 300 ml');
    expect(needText(groceryItem({ quantity: 1, unit: 'kg' }))).toBe('Need 1 kg');
    expect(needText(groceryItem({ quantity: 6, unit: 'piece' }))).toBe('Need 6');
    expect(needText(groceryItem({ quantity: null }))).toBeNull();
  });

  it('starts the Edit field from the amount and name', () => {
    expect(editText(groceryItem({}))).toBe('2 Lemons');
    expect(editText(groceryItem({ name: 'Heavy cream', quantity: 300, unit: 'ml' }))).toBe('300 ml Heavy cream');
    expect(editText(groceryItem({ name: 'Salt', quantity: null }))).toBe('Salt');
    expect(amountText(groceryItem({ quantity: 1.5, unit: 'l' }))).toMatch(/l$/i);
  });
});

describe('recipeCards (FR-004)', () => {
  it('counts each recipe’s items, in the order they came, skipping deleted recipes', () => {
    const soup = { ...quiche, id: 'r-soup', name: 'Pumpkin soup', serves: 4 };
    const items = [
      groceryItem({ id: 'a', recipes: quiche }),
      groceryItem({ id: 'b', recipes: soup }),
      groceryItem({ id: 'c', recipes: quiche }),
      groceryItem({ id: 'd' }),
      groceryItem({ id: 'e', recipes: { ...quiche, id: 'r-gone', deleted_at: '2026-10-20T00:00:00Z' } }),
    ];
    expect(recipeCards(items)).toEqual([
      { id: 'r-quiche', name: 'Leek & bacon quiche', serves: 6, photo_path: null, count: 2 },
      { id: 'r-soup', name: 'Pumpkin soup', serves: 4, photo_path: null, count: 1 },
    ]);
  });
});

describe('shopper (US3)', () => {
  const now = Date.parse('2026-10-21T12:00:00Z');
  const tickedBy = (by: string, minutesAgo: number) =>
    groceryItem({ checked: true, checked_by: by, checked_at: new Date(now - minutesAgo * 60_000).toISOString() });

  it('shows Mia for 10 minutes after her last tick', () => {
    expect(shopper([tickedBy(mia.user_id, 9)], gabriel.user_id, members, now)).toBe('Mia');
    expect(shopper([tickedBy(mia.user_id, 11)], gabriel.user_id, members, now)).toBeNull();
    expect(shopper([tickedBy(mia.user_id, 11), tickedBy(mia.user_id, 2)], gabriel.user_id, members, now)).toBe('Mia');
  });

  it('never shows me, and shows the latest of two shoppers', () => {
    expect(shopper([tickedBy(gabriel.user_id, 1)], gabriel.user_id, members, now)).toBeNull();
    expect(shopper([tickedBy(mia.user_id, 5), tickedBy(alex.user_id, 1)], gabriel.user_id, members, now)).toBe('Alex');
  });
});
