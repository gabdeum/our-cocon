import { planGroceryAdds, type GroceryAmount, type GroceryMerge } from '@cocon/quantity';
import { GroceryItemInput, GroceryItemUpdate, type Aisle, type Unit } from '@cocon/schemas';
import { strings } from '../strings/en';
import { amountText, clearItems, loadGroceryList, type GroceryItem } from './groceries';
import type { RecipeChoices } from './recipe-choices';
import type { RecipeDetail } from './recipe';
import { appliedIngredients, formatOf, ingredientLine, scaleRecipe, servingsText } from './recipe-view';
import { matchIngredients } from './recipe-ingredients';
import type { Client } from './supabase';

const a = strings.addGroceries;

/** One of the recipe's ingredients in the sheet (OC-AddGroceries), as the recipe page shows it now. */
export interface RecipeGroceryLine {
  /** The recipe ingredient's id (a variant's added one has its own). */
  id: string;
  /** "Large eggs", "Gruyère": the page's name without its prep note. */
  name: string;
  /** "300 ml", "2 · 300 g", "1 pinch", in the page's units; empty with no quantity ("Salt and pepper"). */
  shown: string;
  /** What goes on the list. */
  catalog_key: string | null;
  quantity: number | null;
  unit: Unit | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Edge case: the ingredients at the page's current servings (or scale by an ingredient), variants
 * and units, and the servings for the lead. The list gets
 * the scaled amount in the recipe's own unit; counts round up, since you can't buy ⅓ of a leek.
 */
export function recipeGroceryLines(recipe: RecipeDetail, choices: RecipeChoices): { servings: string; lines: RecipeGroceryLine[] } {
  const options = formatOf(choices);
  const scaled = scaleRecipe(recipe.serves, appliedIngredients(recipe, choices), choices);
  const lines = scaled.ingredients.map((ing) => {
    const line = ingredientLine(ing, options);
    const counted = ing.unit == null || ing.unit === 'piece';
    const quantity = ing.quantity == null ? null : counted ? Math.max(1, Math.ceil(round2(ing.quantity))) : round2(ing.quantity);
    return {
      id: ing.id,
      name: line.baseName.trim().slice(0, 80),
      // Counted items show their weight ("2 · 300 g"); a volume reads on its own here ("300 ml").
      shown: ing.quantity == null ? '' : [line.amount, counted ? line.sub : null].filter(Boolean).join(' · '),
      catalog_key: ing.catalog_key ?? null,
      quantity,
      unit: quantity == null ? null : (ing.unit ?? null),
    };
  });
  return { servings: servingsText(scaled.servings), lines };
}

const amountOf = (id: string, name: string, amount: GroceryAmount) => amountText({ id, name, ...amount }) ?? '';

/**
 * US2: "Already on the list (100 ml) → will be 400 ml" for each ticked line that goes into an item
 * already on the list, by line id. Lines merging with no amount on either side get no note.
 */
export function mergeNotes(list: readonly GroceryItem[], lines: readonly RecipeGroceryLine[], ticked: ReadonlySet<string>): Map<string, string> {
  const picked = lines.filter((l) => ticked.has(l.id));
  const plan = planGroceryAdds(list, picked);
  const out = new Map<string, string>();
  picked.forEach((line, n) => {
    const merge = plan.into[n];
    if (!merge) return;
    const before = amountOf(merge.id, line.name, merge.before);
    const after = amountOf(merge.id, line.name, merge.after);
    if (before && after) out.set(line.id, a.alreadyOnList(before, after));
  });
  return out;
}

/** What Undo needs (FR-004): the rows it made, and the items it changed with their amounts before. */
export interface AddedFromRecipe {
  addedIds: string[];
  merges: GroceryMerge[];
}

const revertMerges = async (client: Pick<Client, 'from'>, merges: readonly GroceryMerge[]) => {
  const results = await Promise.all(merges.map((m) => client.from('grocery_items').update(GroceryItemUpdate.parse(m.before)).eq('id', m.id)));
  return results.every((r) => !r.error);
};

/**
 * US1–US2: adds the ticked lines to the list, each carrying the recipe (FR-003). Something already
 * on the list is updated instead of added again (FR-002, SC-001), planned against the list as it
 * is now. Null when it failed; anything it had done by then is put back.
 */
export async function addFromRecipe(
  client: Pick<Client, 'from' | 'rpc'>,
  familyId: string,
  recipeId: string,
  lines: readonly RecipeGroceryLine[],
): Promise<AddedFromRecipe | null> {
  try {
    const list = await loadGroceryList(client);
    const plan = planGroceryAdds(list, lines);
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
    if (results.some((r) => r.error)) {
      await Promise.all([clearItems(client, addedIds), revertMerges(client, plan.merges.filter((_, n) => !results[n]?.error))]);
      return null;
    }
    return { addedIds, merges: plan.merges };
  } catch {
    return null;
  }
}

/** FR-004 Undo: removes exactly the rows it added and puts merged items back as they were. */
export async function undoAddFromRecipe(client: Pick<Client, 'from'>, added: AddedFromRecipe): Promise<boolean> {
  try {
    const [cleared, reverted] = await Promise.all([clearItems(client, added.addedIds), revertMerges(client, added.merges)]);
    return cleared && reverted;
  } catch {
    return false;
  }
}
