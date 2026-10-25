import { groceryIdentity, type GroceryAmount, type IngredientFactsInput } from '@cocon/quantity';
import * as data from '@cocon/data';
import type { RecipeGroceryLine } from '@cocon/data';
import { strings } from '../strings/en';
import { combinedText, combineRows, type GroceryItem } from './groceries';
import type { RecipeChoices } from './recipe-choices';
import type { RecipeDetail } from './recipe';
import { formatOf } from './recipe-view';

// Shared with the MCP server's add_recipe_to_groceries (spec 024).
export { addFromRecipe, undoAddFromRecipe, type AddedFromRecipe, type RecipeGroceryLine } from '@cocon/data';

const a = strings.addGroceries;

/**
 * Edge case: the ingredients at the page's current servings (or scale by an ingredient), variants
 * and units (the shared `recipeGroceryLines`, spec 024).
 */
export const recipeGroceryLines = (recipe: RecipeDetail, choices: RecipeChoices) => data.recipeGroceryLines(recipe, choices, formatOf(choices));

/**
 * US2: "Already on the list (100 ml) → will be 400 ml" for each ticked line of something the list
 * already has still to buy, by line id. Amounts read as the list will show them, one row per
 * thing (combineRows): "Already on the list (11 pieces) → will be 15 pieces". Two lines of the same
 * thing count up line by line.
 */
export function mergeNotes(
  list: readonly GroceryItem[],
  lines: readonly RecipeGroceryLine[],
  ticked: ReadonlySet<string>,
  facts: Readonly<Record<string, IngredientFactsInput>>,
): Map<string, string> {
  const open = new Map(combineRows(list).flatMap((r) => (r.checked ? [] : [[groceryIdentity(r.items[0] as GroceryItem), r] as const])));
  const adding = new Map<string, GroceryAmount[]>();
  const out = new Map<string, string>();
  for (const line of lines) {
    if (!ticked.has(line.id)) continue;
    const identity = groceryIdentity(line);
    const running = [...(adding.get(identity) ?? []), { quantity: line.quantity, unit: line.unit }];
    adding.set(identity, running);
    const row = open.get(identity);
    if (!row) continue;
    const f = line.catalog_key ? facts[line.catalog_key] : null;
    const name = (row.items[0] as GroceryItem).name;
    const before = combinedText(name, row.items, f);
    const after = combinedText(name, [...row.items, ...running], f);
    if (before && after) out.set(line.id, a.alreadyOnList(before, after));
  }
  return out;
}
