// Spec 020: what the grocery list shows (aisles, source lines, Need, recipe cards, who's shopping).
// Spec 021: what to buy beside the name (summed per catalog entry) and the family's own pack size.
import { describe, expect, it, vi } from 'vitest';
import { amountText, buyText, byName, combineRows, editText, groupByAisle, recipeCards, rowAmounts, rowItem, rowSource, savePackSize, shopper, sourceLine, toBuyCount } from './groceries';
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
  it('counts rows not ticked: one per thing', () => {
    expect(toBuyCount(combineRows([groceryItem({ id: 'a' }), groceryItem({ id: 'b', checked: true }), groceryItem({ id: 'c' }), groceryItem({ id: 'd', name: 'Milk', catalog_key: 'milk' })]))).toBe(2);
  });
});

describe('rowSource and byName (spec 022)', () => {
  it('names every recipe and person a row came from, each once', () => {
    const soup = { ...quiche, id: 'r-soup', name: 'Pumpkin soup' };
    const [row] = combineRows([
      groceryItem({ id: 'a', recipes: quiche }),
      groceryItem({ id: 'b', created_by: gabriel.user_id }),
      groceryItem({ id: 'c', recipes: soup }),
      groceryItem({ id: 'd', created_by: gabriel.user_id }),
      groceryItem({ id: 'e', created_by: alex.user_id, source: 'chatgpt' }),
    ]);
    expect(rowSource(row as never, members)).toBe('For Leek & bacon quiche + Pumpkin soup · Added by Gabriel · Alex via ChatGPT');
  });

  it('says "Added manually" when more than one person typed it in', () => {
    const [row] = combineRows([
      groceryItem({ id: 'a', created_by: mia.user_id }),
      groceryItem({ id: 'b', created_by: gabriel.user_id }),
      groceryItem({ id: 'c', recipes: quiche }),
      groceryItem({ id: 'd', created_by: alex.user_id, source: 'chatgpt' }),
    ]);
    expect(rowSource(row as never, members)).toBe('For Leek & bacon quiche · Added manually · Alex via ChatGPT');
    const [mine] = combineRows([groceryItem({ id: 'a' }), groceryItem({ id: 'b' })]);
    expect(rowSource(mine as never, members)).toBe('Added by Gabriel');
  });

  it('sorts by the name shown, ignoring case and accents', () => {
    expect(byName(['croissants', 'Apple', 'Émmental', 'butter'], (n) => n)).toEqual(['Apple', 'butter', 'croissants', 'Émmental']);
  });
});

describe('sourceLine (FR-003)', () => {
  it('names the recipe, the person, or the person and their assistant', () => {
    expect(sourceLine(groceryItem({ recipes: quiche }), members)).toBe('For Leek & bacon quiche');
    expect(sourceLine(groceryItem({ created_by: mia.user_id }), members)).toBe('Added by Mia');
    expect(sourceLine(groceryItem({ created_by: alex.user_id, source: 'chatgpt' }), members)).toBe('Alex via ChatGPT');
    expect(sourceLine(groceryItem({ created_by: 'u-gone' }), members)).toBe('Added by Former member');
  });

  it('says when the recipe was deleted, or is gone for good (spec 018, 032-later L39)', () => {
    expect(sourceLine(groceryItem({ recipes: { ...quiche, deleted_at: '2026-10-21T10:00:00Z' }, from_recipe: true }), members)).toBe('From a deleted recipe');
    expect(sourceLine(groceryItem({ recipes: null, from_recipe: true }), members)).toBe('From a deleted recipe');
  });
});

describe('amounts', () => {
  it('reads amounts through @cocon/quantity; a count stands alone', () => {
    expect(amountText(groceryItem({}))).toBe('2');
    expect(amountText(groceryItem({ quantity: 300, unit: 'ml' }))).toBe('300 ml');
    expect(amountText(groceryItem({ quantity: 1, unit: 'kg' }))).toBe('1 kg');
    expect(amountText(groceryItem({ quantity: 6, unit: 'piece' }))).toBe('6');
    expect(amountText(groceryItem({ quantity: null }))).toBeNull();
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

  it('US1: what to buy, then what recipes need, per store', async () => {
    const packs = await packData(['heavy_cream']);
    expect(rowAmounts(combineRows([cream()]), packs, us).get('cream')).toEqual({ name: 'Heavy cream', detail: '1 pint carton', note: '(need 300 ml)' });
    expect(rowAmounts(combineRows([cream()]), packs, eu).get('cream')).toEqual({ name: 'Heavy cream', detail: '2 × 20 cl', note: '(need 300 ml)' });
  });

  it('US3: Need only with round-up off, or before packs load', async () => {
    const packs = await packData(['heavy_cream']);
    expect(rowAmounts(combineRows([cream()]), packs, { ...us, round_to_packs: false }).get('cream')).toEqual({ name: 'Heavy cream', detail: '300 ml' });
    expect(rowAmounts(combineRows([cream()]), undefined, us).get('cream')).toEqual({ detail: '300 ml' });
  });

  it('FR-002, spec 022: items of the same thing still to buy are one row, with packs for them all', async () => {
    const packs = await packData(['heavy_cream']);
    const rows = combineRows([cream(), cream({ id: 'cream2', quantity: 200 }), cream({ id: 'done', checked: true, quantity: 100 })]);
    expect(rows.map((r) => [r.id, r.items.length])).toEqual([
      ['cream', 2],
      ['done', 1],
    ]);
    const out = rowAmounts(rows, packs, eu);
    expect(out.get('cream')).toEqual({ name: 'Heavy cream', detail: '50 cl' });
    // A ticked one is already in the trolley: a row of its own.
    expect(out.get('done')).toEqual({ name: 'Heavy cream', detail: '20 cl', note: '(need 100 ml)' });
  });

  it('spec 022: pieces and grams of apples are one amount through the catalog; without it, both are said', async () => {
    const packs = await packData(['apple']);
    const rows = combineRows([
      groceryItem({ id: 'mine', name: 'Apples', catalog_key: 'apple', quantity: 11, unit: 'piece' }),
      groceryItem({ id: 'crumble', name: 'Apples', catalog_key: 'apple', quantity: 600, unit: 'g', recipes: quiche }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rowAmounts(rows, packs, { ...eu, round_to_packs: false }).get('mine')).toEqual({ name: 'Apple', detail: '15 pieces' });
    expect(rowAmounts(rows, undefined, eu).get('mine')).toEqual({ detail: '11 pieces + 600 g' });
    expect(rowItem(rows[0] as never, packs)).toMatchObject({ id: 'mine', quantity: 15, unit: 'piece' });
  });

  it('"2 lemons" reads "Lemon: 2 pieces"; a name the matcher only got close to stays as typed', async () => {
    const packs = await packData(['lemon']);
    const lemons = groceryItem({ id: 'l', name: 'Lemons', catalog_key: 'lemon', quantity: 2, unit: 'piece' });
    const meyer = groceryItem({ id: 'm', name: 'Meyer lemons', catalog_key: 'lemon', quantity: 3, unit: 'piece', checked: true });
    expect(rowAmounts(combineRows([lemons]), packs, eu).get('l')).toEqual({ name: 'Lemon', detail: '2 pieces' });
    expect(rowAmounts(combineRows([lemons]), packs, { ...eu, round_to_packs: false }).get('l')).toEqual({ name: 'Lemon', detail: '2 pieces' });
    expect(rowAmounts(combineRows([meyer]), packs, eu).get('m')?.name).toBeUndefined();
    // Before packs load: the name as typed, still in pieces.
    expect(rowAmounts(combineRows([lemons]), undefined, eu).get('l')).toEqual({ detail: '2 pieces' });
  });

  it('edge cases: no quantity, no catalog entry, loose', async () => {
    const packs = await packData(['salt', 'pumpkin']);
    const rows = [
      groceryItem({ id: 'salt', name: 'Salt', catalog_key: 'salt', quantity: null }),
      groceryItem({ id: 'z', name: "Za'atar", catalog_key: null, quantity: 50, unit: 'g' }),
      groceryItem({ id: 'p', name: 'Pumpkin', catalog_key: 'pumpkin', quantity: 1, unit: 'kg' }),
    ];
    const out = rowAmounts(combineRows(rows), packs, eu);
    expect(out.get('salt')).toEqual({ name: 'Salt' });
    expect(out.get('z')).toEqual({ detail: '50 g' });
    // Exactly what's needed: said once.
    expect(out.get('p')).toEqual({ name: 'Pumpkin', detail: '1 kg loose' });
    expect(rowAmounts(combineRows(rows), packs, us).get('p')).toEqual({ name: 'Pumpkin', detail: '1 piece', note: '(need 1 kg)' });
  });
});

describe('buyText (spec 021)', () => {
  const plan = (over: Partial<Parameters<typeof buyText>[0]>) => ({ picks: [], loose: null, kind: 'volume' as const, need: 700, bought: 700, leftover: 0, approximate: false, ...over });
  const pack = (label: string, size = 1) => ({ size, unit: 'piece' as const, label, loose: false });

  it('joins mixed packs, names a single one, counts several', () => {
    expect(buyText(plan({ picks: [{ pack: pack('50 cl'), count: 1 }, { pack: pack('20 cl'), count: 1 }] }))).toBe('50 cl + 20 cl');
    expect(buyText(plan({ picks: [{ pack: pack('dozen', 12), count: 1 }] }))).toBe('1 dozen');
    expect(buyText(plan({ picks: [{ pack: pack('box of 6', 6), count: 2 }] }))).toBe('2 × box of 6');
  });

  it('buys loose by the pound in US stores', () => {
    const lb = { size: 1, unit: 'lb' as const, label: 'per lb', loose: true };
    expect(buyText(plan({ loose: { pack: lb, amount: 1000, kind: 'weight' } }))).toBe('2.2 lb loose');
  });

  it('counts pieces bought one by one', () => {
    const each = { size: 1, unit: 'piece' as const, label: 'each', loose: true };
    expect(buyText(plan({ kind: 'piece', picks: [{ pack: each, count: 6 }] }))).toBe('6 pieces');
    expect(buyText(plan({ kind: 'weight', picks: [{ pack: each, count: 1 }] }))).toBe('1 piece');
    expect(buyText(plan({ kind: 'weight', picks: [{ pack: each, count: 2 }] }))).toBe('2 pieces');
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
