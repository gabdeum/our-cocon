import { combineRows, loadGroceryList, type GroceryItem, type GroceryRow, type GroceryWords } from '@cocon/data';
import { normaliseName, type Aisle } from '@cocon/schemas';
import { ToolError, type ToolContext } from '../../src/tools.js';

/** How amounts and packs read for assistants (the app's wording, spec 021). */
export const groceryWords: GroceryWords = {
  pieces: (amount) => (amount === '1' || amount === '½' || amount === '¼' || amount === '¾' ? `${amount} piece` : `${amount} pieces`),
  packCount: (count, label) => `${count} × ${label}`,
  onePack: (label) => `1 ${label}`,
  packsJoin: ' + ',
  loose: (amount) => `${amount} loose`,
  needNote: (amount) => `need ${amount}`,
};

/** The aisles as the app names them (OC-Groceries › Aisles). */
export const aisleNames: Record<Aisle, string> = {
  produce: 'Produce',
  bakery: 'Bakery',
  dairy_eggs: 'Dairy & eggs',
  meat_fish: 'Meat & fish',
  dry_goods: 'Dry goods',
  spices_baking: 'Spices & baking',
  frozen: 'Frozen',
  drinks: 'Drinks',
  household: 'Household',
  other: 'Other',
};

/** The grocery list in the app. */
export const groceriesLink = (ctx: Pick<ToolContext, 'appUrl'>) => `${ctx.appUrl}/groceries`;

/** The list as rows (one per thing and tick, as the app shows it), with its items. */
export async function listRows(ctx: Pick<ToolContext, 'db'>): Promise<{ items: GroceryItem[]; rows: GroceryRow[] }> {
  const items = await loadGroceryList(ctx.db);
  return { items, rows: combineRows(items) };
}

const notOnList = 'That item isn’t on the grocery list any more. Use list_groceries to see what’s there.';

/** The row an item id from list_groceries belongs to. */
export function rowById(rows: readonly GroceryRow[], id: string): GroceryRow {
  const row = rows.find((r) => r.items.some((i) => i.id === id));
  if (!row) throw new ToolError(notOnList);
  return row;
}

/**
 * The row a name means: the same thing ("eggs" for "Eggs"), else rows whose name contains it.
 * `prefer` picks between a ticked and an unticked row of the same thing. Several left: the
 * assistant is asked which, by id.
 */
export function rowByName(rows: readonly GroceryRow[], name: string, prefer: { checked: boolean }): GroceryRow {
  const wanted = normaliseName(name);
  const named = (r: GroceryRow) => normaliseName((r.items[0] as GroceryItem).name);
  let found = rows.filter((r) => named(r) === wanted);
  if (found.length === 0) found = rows.filter((r) => wanted.length > 0 && named(r).includes(wanted));
  if (found.length > 1) {
    const preferred = found.filter((r) => r.checked === prefer.checked);
    if (preferred.length > 0) found = preferred;
  }
  const [only] = found;
  if (!only) throw new ToolError(`Nothing called '${name}' is on the grocery list. Use list_groceries to see what’s there.`);
  if (found.length > 1) {
    const which = found.map((r) => `${(r.items[0] as GroceryItem).name}${r.checked ? ' (ticked)' : ''} (id ${r.id})`).join(', ');
    throw new ToolError(`Several items match '${name}': ${which}. Ask the member which one, then send its id.`);
  }
  return only;
}

/** A row's name as the list shows it. */
export const rowName = (row: GroceryRow) => (row.items[0] as GroceryItem).name;
