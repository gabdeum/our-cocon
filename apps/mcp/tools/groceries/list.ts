import { z } from 'zod';
import { groupByAisle, loadFamilySettings, loadGroceryServings, loadPacks, packKeys, rowAmounts, type GroceryItem } from '@cocon/data';
import { defineTool, type ToolContext } from '../../src/tools.js';
import { addedBy, loadMembers, recipeLink } from '../recipes/shared.js';
import { aisleNames, groceriesLink, groceryWords, listRows } from './shared.js';

/**
 * The list as the app shows it (specs 020–022): one row per thing by aisle, what to buy in the
 * family's store sizes (spec 021) and what it's for, then the recipes it's for.
 */
export async function readGroceries(ctx: Pick<ToolContext, 'db' | 'appUrl'>) {
  const [{ items, rows }, members, settings, servings] = await Promise.all([listRows(ctx), loadMembers(ctx), loadFamilySettings(ctx.db), loadGroceryServings(ctx.db)]);
  const packs = await loadPacks(ctx.db, packKeys(items));
  const amounts = rowAmounts(rows, packs, settings, groceryWords);
  const live = (i: GroceryItem) => i.recipes && !i.recipes.deleted_at;

  const shown = rows.map((row) => {
    const first = row.items[0] as GroceryItem;
    const a = amounts.get(row.id) ?? {};
    const recipes = [...new Set(row.items.flatMap((i) => (live(i) ? [(i.recipes as NonNullable<GroceryItem['recipes']>).name] : [])))];
    const others = [...new Set(row.items.filter((i) => !live(i)).map((i) => (i.from_recipe || i.recipes ? 'a deleted recipe' : addedBy(i.created_by, i.source, members))))];
    return {
      aisle: row.aisle,
      entry: {
        id: row.id,
        ...(row.items.length > 1 ? { item_ids: row.items.map((i) => i.id) } : {}),
        name: a.name ?? first.name,
        amount: a.detail ?? null,
        ...(a.note ? { note: a.note } : {}),
        ticked: row.checked,
        ...(recipes.length > 0 ? { for_recipes: recipes } : {}),
        ...(others.length > 0 ? { added_by: others } : {}),
      },
    };
  });

  const recipes = new Map<string, { id: string; name: string; servings: number; link: string }>();
  for (const item of items) {
    const r = item.recipes;
    if (r && !r.deleted_at && !recipes.has(r.id)) recipes.set(r.id, { id: r.id, name: r.name, servings: servings[r.id] ?? r.serves, link: recipeLink(ctx, r.id) });
  }

  return {
    link: groceriesLink(ctx),
    to_buy: rows.filter((r) => !r.checked).length,
    store: settings.store_profile === 'us' ? 'US store sizes' : 'EU store sizes',
    aisles: groupByAisle(shown).map((g) => ({
      aisle: aisleNames[g.aisle],
      items: g.items.map((s) => s.entry).sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' })),
    })),
    recipes: [...recipes.values()],
  };
}

export const listGroceries = defineTool({
  name: 'list_groceries',
  title: 'Read the grocery list',
  access: 'read',
  description: [
    'Read the family’s shared grocery list, by aisle, as the app shows it.',
    '- Each item has an id (for check_grocery and remove_grocery), its name and amount: what to buy in the family’s store sizes ("1 pint carton"), or what’s needed when there’s no pack. A note says what’s needed when that differs ("need 300 ml").',
    '- ticked items are in the trolley already. for_recipes and added_by say where an item comes from.',
    '- recipes lists the recipes on the list, with the servings they’re on it for.',
    'Quote amounts as given; never work them out yourself. Link to the list when it helps.',
  ].join('\n'),
  input: z.strictObject({}),
  run: (_args, ctx) => readGroceries(ctx),
});
