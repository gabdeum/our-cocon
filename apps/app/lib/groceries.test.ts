// Spec 020: what the grocery list shows (aisles, source lines, Need, recipe cards, who's shopping).
// Spec 021: what to buy (Buy over Need, summed per catalog entry) and the family's own pack size.
import { describe, expect, it, vi } from 'vitest';
import { amountText, buyText, editText, groupByAisle, leftoverText, needText, recipeCards, rowAmounts, savePackSize, shopper, sourceLine, toBuyCount } from './groceries';
import { alex, gabriel, groceryItem, mia, packData } from '../test/fakes';

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

describe('rowAmounts (spec 021)', () => {
  const us = { store_profile: 'us', round_to_packs: true } as const;
  const eu = { store_profile: 'eu', round_to_packs: true } as const;
  const cream = (over = {}) => groceryItem({ id: 'cream', name: 'Heavy cream', catalog_key: 'heavy_cream', quantity: 300, unit: 'ml', ...over });

  it('US1: Buy over Need with the leftover, per store', async () => {
    const packs = await packData(['heavy_cream']);
    expect(rowAmounts([cream()], packs, us).get('cream')).toEqual({ buy: 'Buy 1 pint carton', need: 'Need 300 ml · ~170 ml left over' });
    expect(rowAmounts([cream()], packs, eu).get('cream')).toEqual({ buy: 'Buy 2 × 20 cl', need: 'Need 300 ml · 100 ml left over' });
  });

  it('US3: Need only with round-up off, or before packs load', async () => {
    const packs = await packData(['heavy_cream']);
    expect(rowAmounts([cream()], packs, { ...us, round_to_packs: false }).get('cream')).toEqual({ need: 'Need 300 ml' });
    expect(rowAmounts([cream()], undefined, us).get('cream')).toEqual({ need: 'Need 300 ml' });
  });

  it('FR-002: sums rows of the same item still to buy; the first one carries the packs', async () => {
    const packs = await packData(['heavy_cream']);
    const rows = [cream(), cream({ id: 'cream2', quantity: 200 }), cream({ id: 'done', checked: true, quantity: 100 })];
    const out = rowAmounts(rows, packs, eu);
    expect(out.get('cream')).toEqual({ buy: 'Buy 50 cl', need: 'Need 500 ml' });
    expect(out.get('cream2')).toEqual({ need: 'Need 200 ml' });
    // A ticked one is already in the trolley: counted on its own.
    expect(out.get('done')).toEqual({ buy: 'Buy 20 cl', need: 'Need 100 ml · 100 ml left over' });
  });

  it('edge cases: no quantity, no catalog entry, loose', async () => {
    const packs = await packData(['salt', 'pumpkin']);
    const rows = [
      groceryItem({ id: 'salt', name: 'Salt', catalog_key: 'salt', quantity: null }),
      groceryItem({ id: 'z', name: "Za'atar", catalog_key: null, quantity: 50, unit: 'g' }),
      groceryItem({ id: 'p', name: 'Pumpkin', catalog_key: 'pumpkin', quantity: 1, unit: 'kg' }),
    ];
    const out = rowAmounts(rows, packs, eu);
    expect(out.get('salt')).toEqual({});
    expect(out.get('z')).toEqual({ need: 'Need 50 g' });
    expect(out.get('p')).toEqual({ buy: 'Buy 1 kg loose', need: 'Need 1 kg' });
    expect(rowAmounts(rows, packs, us).get('p')).toEqual({ buy: 'Buy 1', need: 'Need 1 kg · ~500 g left over' });
  });
});

describe('buyText and leftoverText (spec 021)', () => {
  const plan = (over: Partial<Parameters<typeof buyText>[0]>) => ({ picks: [], loose: null, kind: 'volume' as const, need: 700, bought: 700, leftover: 0, approximate: false, ...over });
  const pack = (label: string, size = 1) => ({ size, unit: 'piece' as const, label, loose: false });

  it('joins mixed packs, names a single one, counts several', () => {
    expect(buyText(plan({ picks: [{ pack: pack('50 cl'), count: 1 }, { pack: pack('20 cl'), count: 1 }] }))).toBe('Buy 50 cl + 20 cl');
    expect(buyText(plan({ picks: [{ pack: pack('dozen', 12), count: 1 }] }))).toBe('Buy 1 dozen');
    expect(buyText(plan({ picks: [{ pack: pack('box of 6', 6), count: 2 }] }))).toBe('Buy 2 × box of 6');
  });

  it('buys loose by the pound in US stores', () => {
    const lb = { size: 1, unit: 'lb' as const, label: 'per lb', loose: true };
    expect(buyText(plan({ loose: { pack: lb, amount: 1000, kind: 'weight' } }))).toBe('Buy 2.2 lb loose');
  });

  it('says nothing about a leftover that rounds away', () => {
    expect(leftoverText(plan({ leftover: 0 }))).toBeNull();
    expect(leftoverText(plan({ leftover: 3, need: 700 }))).toBeNull();
    expect(leftoverText(plan({ kind: 'piece', need: 6, leftover: 2, approximate: true }))).toBe('~2 left over');
  });
});

describe('savePackSize (spec 021 FR-004)', () => {
  const upsert = () => {
    const call = vi.fn(async () => ({ error: null }));
    return { client: { from: vi.fn(() => ({ upsert: call })) } as never, call };
  };

  it('saves what was typed as the family’s one pack, for both stores', async () => {
    const { client, call } = upsert();
    expect(await savePackSize(client, 'fam', { catalog_key: 'heavy_cream' }, ' 25  cl ')).toBe('saved');
    expect(call).toHaveBeenCalledWith(
      expect.objectContaining({ catalog_key: 'heavy_cream', family_id: 'fam', packs: [{ size: 250, unit: 'ml', label: '25 cl', loose: false }] }),
      { onConflict: 'family_id,catalog_key' },
    );
    await savePackSize(client, 'fam', { catalog_key: 'egg' }, '6');
    expect(call).toHaveBeenLastCalledWith(expect.objectContaining({ packs: [{ size: 6, unit: 'piece', label: 'pack of 6', loose: false }] }), expect.anything());
  });

  it('puts the usual sizes back, and refuses what it can’t read', async () => {
    const { client, call } = upsert();
    expect(await savePackSize(client, 'fam', { catalog_key: 'heavy_cream' }, null)).toBe('saved');
    expect(call).toHaveBeenLastCalledWith(expect.objectContaining({ packs: null }), expect.anything());
    expect(await savePackSize(client, 'fam', { catalog_key: 'heavy_cream' }, 'a bag')).toBe('invalid');
    expect(await savePackSize(client, 'fam', { catalog_key: null }, '25 cl')).toBe('failed');
  });
});
