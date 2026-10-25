import { z } from 'zod';
import { addItem, clearItems, rowIds, setChecked } from '@cocon/data';
import { defineTool, ToolError } from '../../src/tools.js';
import { groceriesLink, groceryWords, listRows, rowById, rowByName, rowName } from './shared.js';

const ItemId = z.uuid({ error: 'Use an item id from list_groceries.' }).describe('The item’s id, from list_groceries.');

export const addGroceries = defineTool({
  name: 'add_groceries',
  title: 'Add to the grocery list',
  access: 'write',
  needs: 'groceries',
  description: [
    'Add items to the family’s shared grocery list, one line each, as the member would type them: "milk", "2 lemons", "500 g minced beef", "1 l oat milk".',
    'Each line lands in its aisle. Something you already added that’s still to buy is topped up rather than added twice, and the result says what it now comes to. To add a recipe’s ingredients, use add_recipe_to_groceries instead.',
  ].join('\n'),
  input: z.strictObject({
    items: z.array(z.string().max(200)).min(1).max(50).describe('One item per line, with its amount when the member gave one.'),
  }),
  async run(args, ctx) {
    const writer = { familyId: ctx.familyId, userId: ctx.userId, source: ctx.assistant };
    const results = [];
    // One at a time against the list as it now is, so two lines of the same thing add up.
    for (const text of args.items) {
      const { items } = await listRows(ctx);
      const result = await addItem(ctx.db, writer, items, text, groceryWords);
      if (result.status === 'added' || result.status === 'merged') ctx.tracker.track('grocery_item_added', { from: 'ai' });
      results.push(
        result.status === 'added'
          ? { item: text, added: true }
          : result.status === 'merged'
            ? { item: text, added: true, already_on_list: true, ...(result.total ? { now: result.total } : {}) }
            : { item: text, added: false, why: result.status === 'empty' ? 'No item name in this line.' : 'Couldn’t add it. Try again in a moment.' },
      );
    }
    if (results.every((r) => !r.added && r.why !== 'No item name in this line.')) throw new Error('No grocery item could be added');
    return { link: groceriesLink(ctx), results };
  },
});

export const checkGrocery = defineTool({
  name: 'check_grocery',
  title: 'Tick off a grocery item',
  access: 'write',
  needs: 'groceries',
  description:
    'Tick an item off the grocery list (bought, in the trolley), or untick it with ticked: false. Give its id from list_groceries, or its name ("bread"); a name that matches several items asks which.',
  input: z.strictObject({
    id: ItemId.optional(),
    name: z.string().max(80).optional().describe('The item’s name, when you don’t have its id.'),
    ticked: z.boolean().default(true).describe('true to tick it off (default), false to put it back on the list.'),
  }),
  async run(args, ctx) {
    if (!args.id && !args.name?.trim()) throw new ToolError('Send the item’s id from list_groceries, or its name.');
    const { rows } = await listRows(ctx);
    const row = args.id ? rowById(rows, args.id) : rowByName(rows, args.name as string, { checked: !args.ticked });
    if (row.checked !== args.ticked) {
      const { error } = await setChecked(ctx.db, row.items.map((i) => i.id), args.ticked);
      if (error) throw error;
      if (args.ticked) ctx.tracker.track('grocery_item_ticked', {});
    }
    return { item: rowName(row), ticked: args.ticked, link: groceriesLink(ctx) };
  },
});

export const removeGrocery = defineTool({
  name: 'remove_grocery',
  title: 'Remove a grocery item',
  access: 'delete',
  needs: 'groceries',
  description: 'Remove an item from the grocery list, whoever added it. Give its id from list_groceries. The member can undo it in the app for a day.',
  input: z.strictObject({ id: ItemId }),
  async run(args, ctx) {
    const { rows } = await listRows(ctx);
    const row = rowById(rows, args.id);
    if (!(await clearItems(ctx.db, rowIds([row])))) throw new Error('Could not remove the item');
    return { removed: rowName(row), link: groceriesLink(ctx) };
  },
});

export const clearDoneGroceries = defineTool({
  name: 'clear_done_groceries',
  title: 'Clear ticked grocery items',
  access: 'delete',
  needs: 'groceries',
  description: 'Clear every ticked item from the grocery list, as "Clear done items" does in the app (after shopping). Items still to buy stay. The member can undo it in the app for a day.',
  input: z.strictObject({}),
  async run(_args, ctx) {
    const { rows } = await listRows(ctx);
    const done = rows.filter((r) => r.checked);
    if (!(await clearItems(ctx.db, rowIds(done)))) throw new Error('Could not clear the ticked items');
    if (done.length > 0) ctx.tracker.track('done_items_cleared', { count: done.length });
    return { cleared: done.map(rowName), link: groceriesLink(ctx) };
  },
});
