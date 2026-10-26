import { combineAmounts, groceryIdentity, parseGroceryLine, parsePackSize, type GroceryAmount, type IngredientFactsInput, type PackPlan, type StorePack } from '@cocon/quantity';
import { familyIngredientRow, GroceryItemUpdate, type Aisle, type FamilySettings, type Unit } from '@cocon/schemas';
import * as data from '@cocon/data';
import type { AddResult, GroceryItem, GroceryRow, GroceryServings, PackData, RowAmounts } from '@cocon/data';
import { strings } from '../strings/en';
import { assistantName } from './recipe-format';
import { matchIngredients } from './recipe-ingredients';
import type { Member } from './session';
import type { Client } from './supabase';

// Shared with the MCP server's grocery tools (spec 024): reads, rows, packs and writes.
export {
  amountText,
  clearItems,
  combineRows,
  groupByAisle,
  loadGroceryList,
  loadGroceryServings,
  loadPacks,
  packKeys,
  recipeItems,
  restoreItems,
  rowIds,
  saveRecipeServings,
  setRecipeServings,
  type AddResult,
  type GroceryItem,
  type GroceryRecipe,
  type GroceryRow,
  type GroceryServings,
  type PackData,
  type RowAmounts,
} from '@cocon/data';

/**
 * The family's grocery list (spec 020). The key starts with `grocery_items`, so a live change from
 * anyone in the family refetches it (lib/sync.tsx).
 */
export const groceryListKey = (familyId: string) => ['grocery_items', familyId, 'list'] as const;

/**
 * The servings each recipe is on the list for (spec 022, `grocery_recipes`), by recipe id. Its own
 * key, starting with the table's name, so a change from anyone refetches it.
 */
export const groceryServingsKey = (familyId: string) => ['grocery_recipes', familyId] as const;

// --- What the screen shows -------------------------------------------------------------------

/** The header's count: rows not ticked yet (combineRows). */
export const toBuyCount = (rows: readonly Pick<GroceryRow, 'checked'>[]) => rows.filter((r) => !r.checked).length;

/**
 * FR-003: "For Leek & bacon quiche", "Added by Mia" or "Alex via ChatGPT". An item from a recipe
 * that's in Recently deleted, or gone for good, reads "From a deleted recipe" (spec 018).
 */
export function sourceLine(
  item: Pick<GroceryItem, 'recipes' | 'from_recipe' | 'created_by' | 'source'>,
  members: readonly Pick<Member, 'user_id' | 'display_name'>[],
): string {
  if (item.recipes && !item.recipes.deleted_at) return strings.groceries.forRecipe(item.recipes.name);
  if (item.recipes || item.from_recipe) return strings.groceries.fromDeletedRecipe;
  const name = members.find((m) => m.user_id === item.created_by)?.display_name ?? strings.recipe.formerMember;
  const assistant = assistantName(item.source);
  return assistant ? strings.groceries.via(name, assistant) : strings.groceries.addedBy(name);
}

/** The amount as a row shows it, beside the name: "300 ml", "2 pieces". Null with no quantity. */
export const rowText = (item: Pick<GroceryItem, 'id' | 'name' | 'quantity' | 'unit'>) => data.rowText(item, strings.groceries);

// --- What to buy (spec 021) ------------------------------------------------------------------

/**
 * Packs depend on the family's corrections, so the key starts with `family_ingredients` (a saved
 * correction refetches it).
 */
export const groceryPacksKey = (familyId: string, keys: readonly string[]) => ['family_ingredients', familyId, 'packs', [...keys].sort().join(',')] as const;

/** "1 pint carton", "2 × 20 cl", "1 dozen", "6 pieces", "1 kg loose" (spec 021 FR-003). */
export const buyText = (plan: PackPlan) => data.buyText(plan, strings.groceries);

/**
 * A row's sources, each once: "For Apple crumble + Leek & bacon quiche · Added by Gabriel",
 * "From a deleted recipe · Alex via ChatGPT", or "Added manually" when several people typed it in.
 */
export function rowSource(row: Pick<GroceryRow, 'items'>, members: readonly Pick<Member, 'user_id' | 'display_name'>[]): string {
  const recipes = [...new Set(row.items.flatMap((i) => (i.recipes && !i.recipes.deleted_at ? [i.recipes.name] : [])))];
  const rest = row.items.filter((i) => !(i.recipes && !i.recipes.deleted_at));
  // Typed in by more than one person: "Added manually" rather than naming only one of them.
  const byHand = rest.filter((i) => !i.recipes && !i.from_recipe && !assistantName(i.source));
  const several = new Set(byHand.map((i) => i.created_by)).size > 1;
  const others = [...new Set(rest.map((i) => (several && byHand.includes(i) ? strings.groceries.addedManually : sourceLine(i, members))))];
  return [...(recipes.length > 0 ? [strings.groceries.forRecipe(recipes.join(strings.groceries.sourcesJoin))] : []), ...others].join(strings.groceries.sourcePartsJoin);
}

const factsOf = (row: GroceryRow, packs: Record<string, PackData> | undefined) => {
  const key = row.items[0]?.catalog_key;
  return key ? (packs?.[key]?.facts ?? null) : null;
};

/**
 * The row's items as one amount, to start Edit from ("15 Apples"), when they add up to one; else
 * the first item as it is.
 */
export function rowItem(row: GroceryRow, packs: Record<string, PackData> | undefined): GroceryItem {
  const first = row.items[0] as GroceryItem;
  if (row.items.length === 1) return first;
  const { total } = combineAmounts(row.items, factsOf(row, packs));
  return total ? { ...first, quantity: total.quantity, unit: total.unit } : first;
}

/**
 * Amounts of one thing as one, from @cocon/quantity: "300 ml", "15 pieces", or "11 pieces + 600 g"
 * when they don't convert. Null when none has an amount.
 */
export const combinedText = (name: string, amounts: readonly GroceryAmount[], facts: IngredientFactsInput | null | undefined) =>
  data.combinedText(name, amounts, facts, strings.groceries);

/**
 * Each row's amounts, beside the name: "Heavy cream: 1 pint carton (need 300 ml)", or just
 * "Heavy cream: 300 ml" when there's no pack, round-up is off (spec 021 US3), or the amounts don't
 * add up to one. Nothing for a row with no quantity ("Salt").
 */
export const rowAmounts = (rows: readonly GroceryRow[], packs: Record<string, PackData> | undefined, settings: FamilySettings): Map<string, RowAmounts> =>
  data.rowAmounts(rows, packs, settings, strings.groceries);

/** FR-001 and spec 022: rows in each aisle in alphabetical order of the name shown, ticked or not. */
export function byName<T>(rows: readonly T[], nameOf: (row: T) => string): T[] {
  return [...rows].sort((a, b) => nameOf(a).localeCompare(nameOf(b), 'en', { sensitivity: 'base' }));
}

export interface RecipeCard {
  id: string;
  name: string;
  serves: number;
  photo_path: string | null;
  count: number;
}

/**
 * FR-004: one card per recipe the list has items for, in the order they were added, with the
 * servings it's on the list for (the recipe's own until it has some, spec 022).
 */
export function recipeCards(items: readonly GroceryItem[], servings: GroceryServings = {}): RecipeCard[] {
  const cards = new Map<string, RecipeCard>();
  for (const item of items) {
    const r = item.recipes;
    if (!r || r.deleted_at) continue;
    const card = cards.get(r.id);
    if (card) card.count += 1;
    else cards.set(r.id, { id: r.id, name: r.name, serves: servings[r.id] ?? r.serves, photo_path: r.photo_path, count: 1 });
  }
  return [...cards.values()];
}

/** US3: how long someone counts as shopping after their last tick. */
export const SHOPPING_MINUTES = 10;

/**
 * US3: who else ticked something in the last 10 minutes (the most recent one), for "Mia is
 * shopping". Never me: I know I'm shopping.
 */
export function shopper(
  items: readonly Pick<GroceryItem, 'checked' | 'checked_by' | 'checked_at'>[],
  me: string,
  members: readonly Pick<Member, 'user_id' | 'display_name'>[],
  now: number,
): string | null {
  let latest: { by: string; at: number } | null = null;
  for (const item of items) {
    if (!item.checked || !item.checked_by || !item.checked_at || item.checked_by === me) continue;
    const at = Date.parse(item.checked_at);
    if (now - at > SHOPPING_MINUTES * 60_000) continue;
    if (!latest || at > latest.at) latest = { by: item.checked_by, at };
  }
  return latest ? (members.find((m) => m.user_id === latest.by)?.display_name ?? null) : null;
}

// --- Writes ----------------------------------------------------------------------------------

/**
 * US2: "2 lemons" → Lemons, 2, in Produce, merged into my own item of the same thing (the shared
 * `addItem`, spec 024): "Already on the list. Updated to 15 pieces."
 */
export const addItem = (client: Pick<Client, 'from' | 'rpc'>, familyId: string, me: string, list: readonly GroceryItem[], text: string): Promise<AddResult> =>
  data.addItem(client, { familyId, userId: me, source: 'app' }, list, text, strings.groceries);

/** FR-005: tick or untick. The screen shows it at once (optimisticWrite) and reverts on failure. */
export const setChecked = (client: Pick<Client, 'from'>, id: string, checked: boolean) => data.setChecked(client, id, checked);

/** What the Edit field starts with: "2 Lemons", "300 ml Heavy cream", or just "Salt". */
export function editText(item: Pick<GroceryItem, 'id' | 'name' | 'quantity' | 'unit'>): string {
  const amount = data.amountText(item);
  return amount ? `${amount} ${item.name}` : item.name;
}

/** FR-006 Edit: the text is read again; a new name is matched again for its aisle. */
export async function editItem(client: Pick<Client, 'from' | 'rpc'>, item: GroceryItem, text: string): Promise<'saved' | 'empty' | 'failed'> {
  const parsed = parseGroceryLine(text.slice(0, 200));
  const name = parsed?.name.slice(0, 80).trim();
  if (!parsed || !name) return 'empty';
  try {
    const change: { name: string; quantity: number | null; unit: Unit | null; catalog_key?: string | null; aisle?: Aisle } = {
      name,
      quantity: parsed.quantity,
      unit: parsed.quantity == null ? null : parsed.unit,
    };
    if (groceryIdentity({ catalog_key: null, name }) !== groceryIdentity({ catalog_key: null, name: item.name })) {
      const [facts] = (await matchIngredients(client, [name])) ?? [undefined];
      if (facts === undefined) return 'failed';
      change.catalog_key = facts?.catalog_key ?? null;
      change.aisle = facts?.aisle ?? 'other';
    }
    const valid = GroceryItemUpdate.safeParse(change);
    if (!valid.success) return 'failed';
    const { error } = await client.from('grocery_items').update(valid.data).eq('id', item.id);
    return error ? 'failed' : 'saved';
  } catch {
    return 'failed';
  }
}

/**
 * FR-001 "Move to…": saved as the family's correction, so the item lands there from now on, and
 * every item of the same kind on the list moves now.
 */
export async function moveToAisle(
  client: Pick<Client, 'from'>,
  familyId: string,
  item: GroceryItem,
  list: readonly GroceryItem[],
  aisle: Aisle,
): Promise<boolean> {
  try {
    const row = familyIngredientRow(item.catalog_key ? { catalog_key: item.catalog_key, aisle } : { custom_name: item.name, aisle });
    const { error } = await client
      .from('family_ingredients')
      .upsert({ ...row, family_id: familyId }, { onConflict: item.catalog_key ? 'family_id,catalog_key' : 'family_id,name_norm' });
    if (error) return false;
    const identity = groceryIdentity(item);
    const ids = list.filter((i) => groceryIdentity(i) === identity).map((i) => i.id);
    const moved = await client.from('grocery_items').update({ aisle }).in('id', ids.length > 0 ? ids : [item.id]);
    return !moved.error;
  } catch {
    return false;
  }
}

/**
 * FR-004: the family's own pack size for a catalog item ("250 g", "20 cl", "6"), from Edit. It
 * replaces the catalog's packs, for both stores (spec 031). Null text puts the usual sizes back.
 */
export async function savePackSize(
  client: Pick<Client, 'from'>,
  familyId: string,
  item: Pick<GroceryItem, 'catalog_key'>,
  text: string | null,
): Promise<'saved' | 'invalid' | 'failed'> {
  if (!item.catalog_key) return 'failed';
  let packs: StorePack[] | null = null;
  if (text !== null) {
    const size = parsePackSize(text.slice(0, 40));
    if (!size) return 'invalid';
    const typed = text.trim().replace(/\s+/g, ' ');
    packs = [{ ...size, label: size.unit === 'piece' ? strings.groceries.storeSizePieces(typed) : typed, loose: false }];
  }
  try {
    const row = familyIngredientRow({ catalog_key: item.catalog_key, packs });
    const { error } = await client.from('family_ingredients').upsert({ ...row, family_id: familyId }, { onConflict: 'family_id,catalog_key' });
    return error ? 'failed' : 'saved';
  } catch {
    return 'invalid';
  }
}
