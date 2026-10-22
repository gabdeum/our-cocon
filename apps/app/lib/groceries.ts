import {
  combineAmounts,
  format,
  groceryIdentity,
  parseGroceryLine,
  parsePackSize,
  pickPacks,
  planGroceryAdd,
  sumNeeds,
  type GroceryAmount,
  type IngredientFactsInput,
  type PackPlan,
  type StorePack,
} from '@cocon/quantity';
import {
  AISLE_ORDER,
  familyIngredientRow,
  normaliseName,
  GroceryItemInput,
  GroceryItemUpdate,
  type Aisle,
  type FamilySettings,
  type StoreProfile,
  type Unit,
} from '@cocon/schemas';
import { strings } from '../strings/en';
import { assistantName } from './recipe-format';
import { matchIngredients } from './recipe-ingredients';
import type { Member } from './session';
import type { Client } from './supabase';

/**
 * The family's grocery list (spec 020). The key starts with `grocery_items`, so a live change from
 * anyone in the family refetches it (lib/sync.tsx).
 */
export const groceryListKey = (familyId: string) => ['grocery_items', familyId, 'list'] as const;

export interface GroceryRecipe {
  id: string;
  name: string;
  serves: number;
  photo_path: string | null;
  deleted_at: string | null;
}

export interface GroceryItem {
  id: string;
  name: string;
  catalog_key: string | null;
  quantity: number | null;
  unit: Unit | null;
  aisle: Aisle | null;
  checked: boolean;
  checked_by: string | null;
  checked_at: string | null;
  recipe_id: string | null;
  /** Added from a recipe, even once that recipe is gone (spec 022, set by the database). */
  from_recipe: boolean;
  created_by: string | null;
  source: string;
  created_at: string;
  recipes: GroceryRecipe | null;
}

const columns =
  'id, name, catalog_key, quantity, unit, aisle, checked, checked_by, checked_at, recipe_id, from_recipe, created_by, source, created_at, recipes(id, name, serves, photo_path, deleted_at)';

/** The list as it stands (RLS returns only the family's), without cleared or removed items, oldest first. */
export async function loadGroceryList(client: Pick<Client, 'from'>): Promise<GroceryItem[]> {
  const { data, error } = await client.from('grocery_items').select(columns).is('deleted_at', null).order('created_at').order('id');
  if (error) throw error;
  return data as GroceryItem[];
}

// --- What the screen shows -------------------------------------------------------------------

/** The header's count: rows not ticked yet (combineRows). */
export const toBuyCount = (rows: readonly Pick<GroceryRow, 'checked'>[]) => rows.filter((r) => !r.checked).length;

/** FR-001: the aisles in the catalog's fixed order, each with its items; empty aisles are left out. */
export function groupByAisle<T extends Pick<GroceryItem, 'aisle'>>(items: readonly T[]): { aisle: Aisle; items: T[] }[] {
  return AISLE_ORDER.map((aisle) => ({ aisle, items: items.filter((i) => (i.aisle ?? 'other') === aisle) })).filter((g) => g.items.length > 0);
}

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

/** The amount, from @cocon/quantity: "300 ml", "1 kg", or "2" for pieces. Null with no quantity. */
export function amountText(item: Pick<GroceryItem, 'id' | 'name' | 'quantity' | 'unit'>): string | null {
  if (item.quantity == null) return null;
  const f = format({ id: item.id, name: item.name, quantity: item.quantity, unit: item.unit }, { system: 'metric', scale: true });
  // A count reads on its own ("Updated to 3", the Edit field's "2 Lemons"); rows say pieces (rowText).
  return item.unit == null || item.unit === 'piece' ? f.amount : `${f.amount} ${f.unit}`.trim();
}

/** The amount as a row shows it, beside the name: "300 ml", "2 pieces". Null with no quantity. */
export function rowText(item: Pick<GroceryItem, 'id' | 'name' | 'quantity' | 'unit'>): string | null {
  const amount = amountText(item);
  if (amount === null) return null;
  return item.unit == null || item.unit === 'piece' ? strings.groceries.pieces(amount) : amount;
}

// --- What to buy (spec 021) ------------------------------------------------------------------

/** One catalog entry's packs per store (the family's correction replacing the catalog's) and facts. */
export interface PackData {
  packs: Record<StoreProfile, StorePack[]>;
  facts: IngredientFactsInput;
  /** The family's own pack size (FR-004), as typed: "250 g", "6". Null when it uses the catalog's. */
  corrected: string | null;
}

/**
 * Packs depend on the family's corrections, so the key starts with `family_ingredients` (a saved
 * correction refetches it).
 */
export const groceryPacksKey = (familyId: string, keys: readonly string[]) => ['family_ingredients', familyId, 'packs', [...keys].sort().join(',')] as const;

/** The list's catalog entries, each once. */
export const packKeys = (items: readonly Pick<GroceryItem, 'catalog_key'>[]) => [...new Set(items.flatMap((i) => (i.catalog_key ? [i.catalog_key] : [])))].sort();

/** FR-002: packs and facts for the list's catalog entries, from spec 031's views. */
export async function loadPacks(client: Pick<Client, 'from'>, keys: readonly string[]): Promise<Record<string, PackData>> {
  if (keys.length === 0) return {};
  const [packs, facts] = await Promise.all([
    client.from('ingredient_packs').select('catalog_key, family_ingredient_id, profile, position, size, unit, label, loose').in('catalog_key', keys).order('position'),
    client.from('ingredient_facts').select('catalog_key, name, density_g_per_ml, size_small_g, size_medium_g, size_large_g, default_size').in('catalog_key', keys),
  ]);
  if (packs.error) throw packs.error;
  if (facts.error) throw facts.error;
  const out: Record<string, PackData> = {};
  for (const f of facts.data) {
    if (f.catalog_key) out[f.catalog_key] = { packs: { us: [], eu: [] }, facts: f as IngredientFactsInput, corrected: null };
  }
  for (const p of packs.data) {
    const entry = p.catalog_key ? out[p.catalog_key] : undefined;
    if (!entry || !p.profile || p.size == null || !p.unit || !p.label || p.loose == null) continue;
    entry.packs[p.profile].push({ size: p.size, unit: p.unit, label: p.label, loose: p.loose });
    if (p.family_ingredient_id && entry.corrected === null) entry.corrected = p.unit === 'piece' ? String(p.size) : p.label;
  }
  return out;
}

/** "1 pint carton", "2 × 20 cl", "1 dozen", "6 pieces", "1 kg loose" (spec 021 FR-003). */
export function buyText(plan: PackPlan): string {
  const g = strings.groceries;
  if (plan.loose) {
    const { pack, amount, kind } = plan.loose;
    const imperial = pack.unit === 'lb' || pack.unit === 'oz';
    const f = format({ id: 'buy', name: '', quantity: amount, unit: kind === 'weight' ? 'g' : 'ml' }, { system: imperial ? 'imperial' : 'metric', scale: true });
    return g.loose(`${f.amount} ${f.unit}`.trim());
  }
  const [only] = plan.picks;
  // Sold one by one: "6 pieces".
  if (plan.picks.length === 1 && only && only.pack.loose && only.pack.size === 1) return g.pieces(String(only.count));
  const parts = plan.picks.map(({ pack, count }) => (count > 1 ? g.packCount(count, pack.label) : /^\d/.test(pack.label) ? pack.label : g.onePack(pack.label)));
  return parts.join(g.packsJoin);
}

export interface RowAmounts {
  /** The name to show: the catalog's singular when it's the same word ("Lemons" → "Lemon"). */
  name?: string;
  /** After the name: what to buy ("1 pint carton"), or what's needed when there's no pack ("300 ml"). */
  detail?: string;
  /** "(need 300 ml)", when what to buy isn't simply what's needed. */
  note?: string;
}

/**
 * One row on the list (spec 022): every item of the same thing still to buy, whoever or whatever
 * recipe added it, read as one ("Apple: 15 pieces · For Apple crumble · Added by Gabriel"). Ticked
 * items make their own row: they're in the trolley. The items stay separate underneath, each with
 * its source, so recipe cards and Undo still know where they came from.
 */
export interface GroceryRow {
  /** The first item's id: the row's key, and the item its menu edits. */
  id: string;
  items: GroceryItem[];
  checked: boolean;
  aisle: Aisle | null;
}

/** The list's items as rows, one per thing (groceryIdentity) and tick, in the order they first came. */
export function combineRows(items: readonly GroceryItem[]): GroceryRow[] {
  const rows = new Map<string, GroceryRow>();
  for (const item of items) {
    const key = `${item.checked ? 'done' : 'open'}:${groceryIdentity(item)}`;
    const row = rows.get(key);
    if (row) row.items.push(item);
    else rows.set(key, { id: item.id, items: [item], checked: item.checked, aisle: item.aisle });
  }
  return [...rows.values()];
}

/** The ids of every item in these rows. */
export const rowIds = (rows: readonly GroceryRow[]) => rows.flatMap((r) => r.items.map((i) => i.id));

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
 * when they don't convert. Null when none has an amount. The list's rows and Add to groceries'
 * notes (spec 022) both read it.
 */
export function combinedText(name: string, amounts: readonly GroceryAmount[], facts: IngredientFactsInput | null | undefined): string | null {
  const { parts } = combineAmounts(amounts, facts);
  const texts = parts.flatMap((p) => rowText({ id: name, name, quantity: p.quantity, unit: p.unit }) ?? []);
  return texts.length > 0 ? texts.join(strings.groceries.packsJoin) : null;
}

const needText = (row: GroceryRow, facts: IngredientFactsInput | null) => combinedText((row.items[0] as GroceryItem).name, row.items, facts);

/**
 * Each row's amounts, beside the name: "Heavy cream: 1 pint carton (need 300 ml)", or just
 * "Heavy cream: 300 ml" when there's no pack, round-up is off (spec 021 US3), or the amounts don't
 * add up to one. Nothing for a row with no quantity ("Salt").
 */
export function rowAmounts(rows: readonly GroceryRow[], packs: Record<string, PackData> | undefined, settings: FamilySettings): Map<string, RowAmounts> {
  const out = new Map<string, RowAmounts>();
  for (const row of rows) {
    const first = row.items[0] as GroceryItem;
    const data = first.catalog_key ? packs?.[first.catalog_key] : undefined;
    const catalogName = data?.facts.name;
    // "Lemon: 2 pieces" reads as a label; a name the matcher only got close to ("Meyer lemons") stays as typed.
    const name = catalogName && normaliseName(catalogName) === normaliseName(first.name) ? catalogName : undefined;
    const need = needText(row, data?.facts ?? null);
    const shown: RowAmounts = { ...(name ? { name } : {}), ...(need ? { detail: need } : {}) };
    out.set(row.id, shown);
    if (!settings.round_to_packs || !need || !data) continue;
    const { total } = combineAmounts(row.items, data.facts);
    const sum = total?.quantity == null ? null : sumNeeds([{ quantity: total.quantity, unit: total.unit === 'piece' ? null : total.unit }], data.facts);
    const plan = sum ? pickPacks(sum, data.packs[settings.store_profile], data.facts, settings.store_profile) : null;
    if (!plan) continue;
    // Exactly what's needed (loose by weight, one by one, 2 × 1 l for 2 L): no need to say it twice.
    const exact = plan.leftover <= plan.need * 0.01 && !plan.approximate;
    out.set(row.id, exact ? { ...shown, detail: buyText(plan) } : { ...shown, detail: buyText(plan), note: strings.groceries.needNote(need) });
  }
  return out;
}

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

/** FR-004: one card per recipe the list has items for, in the order they were added. */
export function recipeCards(items: readonly GroceryItem[]): RecipeCard[] {
  const cards = new Map<string, RecipeCard>();
  for (const item of items) {
    const r = item.recipes;
    if (!r || r.deleted_at) continue;
    const card = cards.get(r.id);
    if (card) card.count += 1;
    else cards.set(r.id, { id: r.id, name: r.name, serves: r.serves, photo_path: r.photo_path, count: 1 });
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

export type AddResult =
  | { status: 'added'; unmatched: boolean }
  | { status: 'merged'; total: string | null }
  | { status: 'empty' }
  | { status: 'failed' };

/**
 * US2: "2 lemons" → Lemons, 2, in Produce. FR-002 reads the text with spec 015's parser; the aisle
 * is the catalog matcher's (family correction, then catalog, then Other). It merges into my own
 * item of the same thing (planGroceryAdd); someone else's, or a recipe's, keeps its own item, so the
 * row can say who it's for (spec 022). Either way, something already on the list says what the
 * row now comes to: "Already on the list. Updated to 15 pieces."
 */
export async function addItem(
  client: Pick<Client, 'from' | 'rpc'>,
  familyId: string,
  me: string,
  list: readonly GroceryItem[],
  text: string,
): Promise<AddResult> {
  const parsed = parseGroceryLine(text.slice(0, 200));
  if (!parsed) return { status: 'empty' };
  const name = parsed.name.slice(0, 80).trim();
  if (!name) return { status: 'empty' };
  try {
    const [facts] = (await matchIngredients(client, [name])) ?? [undefined];
    const add = { name, catalog_key: facts?.catalog_key ?? null, quantity: parsed.quantity, unit: parsed.quantity == null ? null : parsed.unit };
    const plan = planGroceryAdd(list, { ...add, recipe_id: null, created_by: me, source: 'app' });
    const identity = groceryIdentity(add);
    const listed = list.filter((i) => !i.checked && groceryIdentity(i) === identity);
    if (plan.kind === 'merge') {
      const change = GroceryItemUpdate.safeParse({ quantity: plan.quantity, unit: plan.unit });
      if (!change.success) return { status: 'failed' };
      const { error } = await client.from('grocery_items').update(change.data).eq('id', plan.id);
      if (error) return { status: 'failed' };
      const now = listed.map((i) => (i.id === plan.id ? { quantity: plan.quantity, unit: plan.unit } : i));
      return { status: 'merged', total: combinedText(name, now, facts) };
    }
    const row = GroceryItemInput.parse({ ...add, aisle: facts?.aisle ?? 'other' });
    const { error } = await client.from('grocery_items').insert({ ...row, family_id: familyId });
    if (error) return { status: 'failed' };
    if (listed.length > 0) return { status: 'merged', total: combinedText(name, [...listed, add], facts) };
    // A failed lookup isn't a miss: only count names the catalog really doesn't know.
    return { status: 'added', unmatched: facts === null };
  } catch {
    return { status: 'failed' };
  }
}

/** FR-005: tick or untick. The screen shows it at once (optimisticWrite) and reverts on failure. */
export const setChecked = (client: Pick<Client, 'from'>, id: string, checked: boolean) =>
  client.from('grocery_items').update({ checked }).eq('id', id);

/** "Clear done items" and "Remove": hidden at once, kept a day for Undo (then the nightly purge). Never deleted. */
export async function clearItems(client: Pick<Client, 'from'>, ids: readonly string[]): Promise<boolean> {
  if (ids.length === 0) return true;
  // Any time will do: the database stamps its own, and who cleared it.
  const { error } = await client.from('grocery_items').update({ deleted_at: new Date().toISOString() }).in('id', ids);
  return !error;
}

/** Undo: the items come back as they were, with who added and ticked them. */
export async function restoreItems(client: Pick<Client, 'from'>, ids: readonly string[]): Promise<boolean> {
  if (ids.length === 0) return true;
  const { error } = await client.from('grocery_items').update({ deleted_at: null }).in('id', ids);
  return !error;
}

/** What the Edit field starts with: "2 Lemons", "300 ml Heavy cream", or just "Salt". */
export function editText(item: Pick<GroceryItem, 'id' | 'name' | 'quantity' | 'unit'>): string {
  const amount = amountText(item);
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
