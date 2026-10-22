import {
  format,
  groceryIdentity,
  parseIngredientLine,
  parsePackSize,
  pickPacks,
  planGroceryAdd,
  sumNeeds,
  type IngredientFactsInput,
  type PackPlan,
  type StorePack,
} from '@cocon/quantity';
import {
  AISLE_ORDER,
  familyIngredientRow,
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
  created_by: string | null;
  source: string;
  created_at: string;
  recipes: GroceryRecipe | null;
}

const columns =
  'id, name, catalog_key, quantity, unit, aisle, checked, checked_by, checked_at, recipe_id, created_by, source, created_at, recipes(id, name, serves, photo_path, deleted_at)';

/** The list as it stands (RLS returns only the family's), without cleared or removed items, oldest first. */
export async function loadGroceryList(client: Pick<Client, 'from'>): Promise<GroceryItem[]> {
  const { data, error } = await client.from('grocery_items').select(columns).is('deleted_at', null).order('created_at').order('id');
  if (error) throw error;
  return data as GroceryItem[];
}

// --- What the screen shows -------------------------------------------------------------------

/** The header's count: what's not ticked yet. */
export const toBuyCount = (items: readonly GroceryItem[]) => items.filter((i) => !i.checked).length;

/** FR-001: the aisles in the catalog's fixed order, each with its items; empty aisles are left out. */
export function groupByAisle<T extends Pick<GroceryItem, 'aisle'>>(items: readonly T[]): { aisle: Aisle; items: T[] }[] {
  return AISLE_ORDER.map((aisle) => ({ aisle, items: items.filter((i) => (i.aisle ?? 'other') === aisle) })).filter((g) => g.items.length > 0);
}

/** FR-003: "For Leek & bacon quiche", "Added by Mia" or "Alex via ChatGPT". */
export function sourceLine(item: Pick<GroceryItem, 'recipes' | 'created_by' | 'source'>, members: readonly Pick<Member, 'user_id' | 'display_name'>[]): string {
  if (item.recipes) return strings.groceries.forRecipe(item.recipes.name);
  const name = members.find((m) => m.user_id === item.created_by)?.display_name ?? strings.recipe.formerMember;
  const assistant = assistantName(item.source);
  return assistant ? strings.groceries.via(name, assistant) : strings.groceries.addedBy(name);
}

/** The amount, from @cocon/quantity: "300 ml", "1 kg", or "2" for pieces. Null with no quantity. */
export function amountText(item: Pick<GroceryItem, 'id' | 'name' | 'quantity' | 'unit'>): string | null {
  if (item.quantity == null) return null;
  const f = format({ id: item.id, name: item.name, quantity: item.quantity, unit: item.unit }, { system: 'metric', scale: true });
  // A count reads on its own beside the name ("Lemons: 2").
  return item.unit == null || item.unit === 'piece' ? f.amount : `${f.amount} ${f.unit}`.trim();
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
    client.from('ingredient_facts').select('catalog_key, density_g_per_ml, size_small_g, size_medium_g, size_large_g, default_size').in('catalog_key', keys),
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

const baseUnit = (kind: PackPlan['kind']): Unit | null => (kind === 'weight' ? 'g' : kind === 'volume' ? 'ml' : null);

/** "1 pint carton", "2 × 20 cl", "1 dozen", "6", "1 piece", "1 kg loose" (spec 021 FR-003). */
export function buyText(plan: PackPlan): string {
  const g = strings.groceries;
  if (plan.loose) {
    const { pack, amount, kind } = plan.loose;
    const imperial = pack.unit === 'lb' || pack.unit === 'oz';
    const f = format({ id: 'buy', name: '', quantity: amount, unit: kind === 'weight' ? 'g' : 'ml' }, { system: imperial ? 'imperial' : 'metric', scale: true });
    return g.loose(`${f.amount} ${f.unit}`.trim());
  }
  const [only] = plan.picks;
  // Sold one by one: a count reads on its own beside a count ("Apples: 6"), else as pieces ("1 piece").
  if (plan.picks.length === 1 && only && only.pack.loose && only.pack.size === 1) return plan.kind === 'piece' ? String(only.count) : g.pieces(only.count);
  const parts = plan.picks.map(({ pack, count }) => (count > 1 ? g.packCount(count, pack.label) : /^\d/.test(pack.label) ? pack.label : g.onePack(pack.label)));
  return parts.join(g.packsJoin);
}

export interface RowAmounts {
  /** After the name: what to buy ("1 pint carton"), or what's needed when there's no pack ("300 ml"). */
  detail?: string;
  /** "(need 300 ml)", when what to buy isn't simply what's needed. */
  note?: string;
}

/**
 * Each row's amounts, beside the name: "Heavy cream: 1 pint carton (need 300 ml)", or just
 * "Heavy cream: 300 ml" when there's no pack, round-up is off (US3), or it's another row of
 * something already counted. Rows of the same catalog entry still to buy are summed (FR-002): the
 * first carries the packs for all of them. Nothing for an item with no quantity ("Salt").
 */
export function rowAmounts(items: readonly GroceryItem[], packs: Record<string, PackData> | undefined, settings: FamilySettings): Map<string, RowAmounts> {
  const out = new Map<string, RowAmounts>();
  const groups = new Map<string, GroceryItem[]>();
  for (const item of items) {
    const amount = amountText(item);
    out.set(item.id, amount ? { detail: amount } : {});
    if (!settings.round_to_packs || !amount || !item.catalog_key || !packs?.[item.catalog_key]) continue;
    const key = item.checked ? `done:${item.id}` : item.catalog_key;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  for (const rows of groups.values()) {
    const first = rows[0] as GroceryItem;
    const data = packs?.[first.catalog_key as string] as PackData;
    const total = sumNeeds(
      rows.map((r) => ({ quantity: r.quantity as number, unit: r.unit === 'piece' ? null : r.unit })),
      data.facts,
    );
    const plan = total ? pickPacks(total, data.packs[settings.store_profile], data.facts, settings.store_profile) : null;
    if (!total || !plan) continue;
    const amount = rows.length === 1 ? amountText(first) : amountText({ id: first.id, name: first.name, quantity: Math.round(total.quantity * 100) / 100, unit: baseUnit(total.kind) });
    if (!amount) continue;
    // Exactly what's needed (loose by weight, one by one, 2 × 1 l for 2 L): no need to say it twice.
    const exact = plan.leftover <= plan.need * 0.01 && !plan.approximate;
    out.set(first.id, exact ? { detail: buyText(plan) } : { detail: buyText(plan), note: strings.groceries.needNote(amount) });
  }
  return out;
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
 * is the catalog matcher's (family correction, then catalog, then Other). Something already on the
 * list is merged into (planGroceryAdd).
 */
export async function addItem(
  client: Pick<Client, 'from' | 'rpc'>,
  familyId: string,
  list: readonly GroceryItem[],
  text: string,
): Promise<AddResult> {
  const parsed = parseIngredientLine(text.slice(0, 200));
  if (!parsed) return { status: 'empty' };
  const name = parsed.name.slice(0, 80).trim();
  if (!name) return { status: 'empty' };
  try {
    const [facts] = (await matchIngredients(client, [name])) ?? [undefined];
    const add = { name, catalog_key: facts?.catalog_key ?? null, quantity: parsed.quantity, unit: parsed.quantity == null ? null : parsed.unit };
    const plan = planGroceryAdd(list, add);
    if (plan.kind === 'merge') {
      const change = GroceryItemUpdate.safeParse({ quantity: plan.quantity, unit: plan.unit });
      if (!change.success) return { status: 'failed' };
      const { error } = await client.from('grocery_items').update(change.data).eq('id', plan.id);
      if (error) return { status: 'failed' };
      const total = amountText({ id: plan.id, name, quantity: plan.quantity, unit: plan.unit });
      return { status: 'merged', total };
    }
    const row = GroceryItemInput.parse({ ...add, aisle: facts?.aisle ?? 'other' });
    const { error } = await client.from('grocery_items').insert({ ...row, family_id: familyId });
    if (error) return { status: 'failed' };
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
  const parsed = parseIngredientLine(text.slice(0, 200));
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
