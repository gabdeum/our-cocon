import { groceryIdentity, groceryQuantity, groupSameIngredient, kindOf, planGroceryAdds, sumIngredients, type GroceryAmount, type GroceryMerge, type IngredientFactsInput } from '@cocon/quantity';
import { GroceryItemInput, GroceryItemUpdate, type Aisle, type Unit } from '@cocon/schemas';
import { strings } from '../strings/en';
import { clearItems, combinedText, combineRows, loadGroceryList, recipeItems, saveRecipeServings, type GroceryItem } from './groceries';
import type { RecipeChoices } from './recipe-choices';
import type { RecipeDetail } from './recipe';
import { appliedIngredients, formatOf, ingredientLine, mergedLine, scaleRecipe, servingsText } from './recipe-view';
import { matchIngredients } from './recipe-ingredients';
import type { Client } from './supabase';

const a = strings.addGroceries;

/** One of the recipe's ingredients in the sheet (OC-AddGroceries), as the recipe page shows it now. */
export interface RecipeGroceryLine {
  /** The recipe ingredient's id (a variant's added one has its own); a line of several rows has the first one's. */
  id: string;
  /** "Large eggs", "Gruyère": the name as the page's list shows it. */
  name: string;
  /** "300 ml", "2 · 300 g", "1 pinch", in the page's units; empty with no quantity ("Salt and pepper"). */
  shown: string;
  /** What goes on the list. */
  catalog_key: string | null;
  quantity: number | null;
  unit: Unit | null;
}

/**
 * Edge case: the ingredients at the page's current servings (or scale by an ingredient), variants
 * and units, and the servings for the lead. The list gets
 * the scaled amount in the recipe's own unit; counts round up, since you can't buy ⅓ of a leek.
 */
export function recipeGroceryLines(recipe: RecipeDetail, choices: RecipeChoices): { servings: string; serves: number; lines: RecipeGroceryLine[] } {
  const options = formatOf(choices);
  const scaled = scaleRecipe(recipe.serves, appliedIngredients(recipe, choices), choices);
  // Rows of one ingredient ("Onion (sauce)", "Onion (topping)") are one line, as on the page;
  // when their amounts don't add up, each keeps its own.
  const lines = groupSameIngredient(scaled.ingredients).flatMap((rows) => {
    const sum = rows.length > 1 ? sumIngredients(rows) : null;
    const items = sum ? [{ ing: { ...sum, id: rows[0]?.id ?? sum.id }, line: mergedLine(rows, options) }] : rows.map((ing) => ({ ing, line: ingredientLine(ing, options) }));
    return items.map(({ ing, line }) => {
      const quantity = ing.quantity == null ? null : groceryQuantity(ing.quantity, ing.unit ?? null);
      return {
        id: ing.id,
        name: line.name.trim().slice(0, 80),
        // Counted items show their weight ("2 · 300 g", "3½ · 600 g" for apples saved in grams); a
        // volume reads on its own here ("300 ml").
        shown: ing.quantity == null ? '' : [line.amount, ing.unit && kindOf(ing.unit) === 'volume' ? null : line.sub].filter(Boolean).join(' · '),
        catalog_key: ing.catalog_key ?? null,
        quantity,
        unit: quantity == null ? null : (ing.unit ?? null),
      };
    });
  });
  // What the list records (grocery_recipes): whole servings, 1–50 ("7½" after a scale is 8).
  const serves = Math.min(50, Math.max(1, Math.round(scaled.servings)));
  return { servings: servingsText(scaled.servings), serves, lines };
}

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

/**
 * What Undo needs (FR-004): the rows it made, the items it changed with their amounts before, and
 * the servings the list had for the recipe before (null when it had none).
 */
export interface AddedFromRecipe {
  addedIds: string[];
  merges: GroceryMerge[];
  recipeId: string;
  familyId: string;
  servingsBefore: number | null;
}

const revertMerges = async (client: Pick<Client, 'from'>, merges: readonly GroceryMerge[]) => {
  const results = await Promise.all(merges.map((m) => client.from('grocery_items').update(GroceryItemUpdate.parse(m.before)).eq('id', m.id)));
  return results.every((r) => !r.error);
};

/**
 * US1–US2: adds the ticked lines to the list, each carrying the recipe (FR-003). What this recipe
 * already has on the list is updated instead of added again (FR-002, SC-001), planned against the
 * list as it is now; anything else of the same thing keeps its own item, and the list shows them
 * as one row. Null when it failed; anything it had done by then is put back.
 *
 * Spec 022: the list records the servings it's for. With the recipe already on the list (the new
 * amounts merged into its items), they add up: 4 then 2 more is 6. Otherwise they start again.
 */
export async function addFromRecipe(
  client: Pick<Client, 'from' | 'rpc'>,
  familyId: string,
  recipeId: string,
  lines: readonly RecipeGroceryLine[],
  serves: number,
): Promise<AddedFromRecipe | null> {
  try {
    const list = await loadGroceryList(client);
    const stored = await client.from('grocery_recipes').select('servings').eq('recipe_id', recipeId).maybeSingle();
    if (stored.error) return null;
    const servingsBefore = stored.data?.servings ?? null;
    const onList = recipeItems(list, recipeId).length > 0;
    // Only into this recipe's own items: someone's own apples keep their item, and the row says both.
    const plan = planGroceryAdds(
      list,
      lines.map((l) => ({ ...l, recipe_id: recipeId, created_by: null, source: 'app' })),
    );
    // Catalog items get their aisle from the database (the family's correction, then the catalog);
    // a custom one may have a family aisle by name, which only the matcher knows.
    const custom = plan.inserts.filter((i) => !i.catalog_key);
    const facts = (await matchIngredients(client, custom.map((i) => i.name))) ?? [];
    const aisles = new Map<string, Aisle | null>(custom.map((i, n) => [i.name, facts[n]?.aisle ?? null]));
    const rows = plan.inserts.map((i) =>
      GroceryItemInput.parse({ name: i.name, catalog_key: i.catalog_key, quantity: i.quantity, unit: i.unit, aisle: aisles.get(i.name) ?? null, recipe_id: recipeId }),
    );
    const updates = plan.merges.map((m) => ({ id: m.id, change: GroceryItemUpdate.parse(m.after) }));

    let addedIds: string[] = [];
    if (rows.length > 0) {
      const { data, error } = await client
        .from('grocery_items')
        .insert(rows.map((r) => ({ ...r, family_id: familyId })))
        .select('id');
      if (error) return null;
      addedIds = data.map((r) => r.id);
    }
    const results = await Promise.all(updates.map((u) => client.from('grocery_items').update(u.change).eq('id', u.id)));
    const servings = Math.min(50, onList && servingsBefore !== null ? servingsBefore + serves : serves);
    const saved = !results.some((r) => r.error) && (await saveRecipeServings(client, familyId, recipeId, servings));
    if (!saved) {
      await Promise.all([clearItems(client, addedIds), revertMerges(client, plan.merges.filter((_, n) => !results[n]?.error))]);
      return null;
    }
    return { addedIds, merges: plan.merges, recipeId, familyId, servingsBefore };
  } catch {
    return null;
  }
}

/** FR-004 Undo: removes exactly the rows it added and puts merged items back as they were. */
export async function undoAddFromRecipe(client: Pick<Client, 'from'>, added: AddedFromRecipe): Promise<boolean> {
  try {
    const [cleared, reverted, servings] = await Promise.all([
      clearItems(client, added.addedIds),
      revertMerges(client, added.merges),
      // With none before, the row stays: unused once the recipe has no items on the list.
      added.servingsBefore === null ? true : saveRecipeServings(client, added.familyId, added.recipeId, added.servingsBefore),
    ]);
    return cleared && reverted && servings;
  } catch {
    return false;
  }
}
