import {
  combineAmounts,
  format,
  groceryIdentity,
  groceryQuantity,
  groupSameIngredient,
  kindOf,
  parseGroceryLine,
  pickPacks,
  planGroceryAdd,
  planGroceryAdds,
  rescaleGroceryAmount,
  sumIngredients,
  sumNeeds,
  type FormatOptions,
  type GroceryAmount,
  type GroceryMerge,
  type IngredientFactsInput,
  type PackPlan,
  type StorePack,
} from '@cocon/quantity';
import {
  AISLE_ORDER,
  normaliseName,
  GroceryItemInput,
  GroceryItemUpdate,
  GroceryRecipeInput,
  type Aisle,
  type FamilySettings,
  type StoreProfile,
  type Unit,
  type VariantChoice,
} from '@cocon/schemas';
import type { Db } from './client';
import { matchIngredients } from './match';
import type { RecipeDetail } from './recipe-detail';
import { appliedIngredients, ingredientLine, mergedLine, scaleRecipe, servingsText, type PageScale } from './recipe-lines';

/**
 * The family's grocery list (specs 020–022), read and written the same way by the app and the MCP
 * server's grocery tools (spec 024). Words shown to people come in as `GroceryWords`: the app's
 * from its strings file, the MCP server's its own.
 */

/** How amounts and packs read. The app passes `strings.groceries`. */
export interface GroceryWords {
  /** "2 pieces", "1 piece". */
  pieces: (amount: string) => string;
  /** "2 × 20 cl". */
  packCount: (count: number, label: string) => string;
  /** "1 pint carton". */
  onePack: (label: string) => string;
  /** Between amounts or packs that don't add up: " + ". */
  packsJoin: string;
  /** "1 kg loose". */
  loose: (amount: string) => string;
  /** "(need 300 ml)". */
  needNote: (amount: string) => string;
}

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
export async function loadGroceryList(client: Pick<Db, 'from'>): Promise<GroceryItem[]> {
  const { data, error } = await client.from('grocery_items').select(columns).is('deleted_at', null).order('created_at').order('id');
  if (error) throw error;
  return data as GroceryItem[];
}

export type GroceryServings = Readonly<Record<string, number>>;

/** The servings each recipe is on the list for (spec 022, `grocery_recipes`), by recipe id. */
export async function loadGroceryServings(client: Pick<Db, 'from'>): Promise<GroceryServings> {
  const { data, error } = await client.from('grocery_recipes').select('recipe_id, servings');
  if (error) throw error;
  return Object.fromEntries(data.map((r) => [r.recipe_id, r.servings]));
}

/** FR-001: the aisles in the catalog's fixed order, each with its items; empty aisles are left out. */
export function groupByAisle<T extends Pick<GroceryItem, 'aisle'>>(items: readonly T[]): { aisle: Aisle; items: T[] }[] {
  return AISLE_ORDER.map((aisle) => ({ aisle, items: items.filter((i) => (i.aisle ?? 'other') === aisle) })).filter((g) => g.items.length > 0);
}

/** A recipe's items on the list, ticked or not (the card's menu, spec 022). */
export const recipeItems = <T extends Pick<GroceryItem, 'recipe_id'>>(items: readonly T[], recipeId: string): T[] => items.filter((i) => i.recipe_id === recipeId);

/** The amount, from @cocon/quantity: "300 ml", "1 kg", or "2" for pieces. Null with no quantity. */
export function amountText(item: Pick<GroceryItem, 'id' | 'name' | 'quantity' | 'unit'>): string | null {
  if (item.quantity == null) return null;
  const f = format({ id: item.id, name: item.name, quantity: item.quantity, unit: item.unit }, { system: 'metric', scale: true });
  // A count reads on its own ("Updated to 3", the Edit field's "2 Lemons"); rows say pieces (rowText).
  return item.unit == null || item.unit === 'piece' ? f.amount : `${f.amount} ${f.unit}`.trim();
}

/** The amount as a row shows it, beside the name: "300 ml", "2 pieces". Null with no quantity. */
export function rowText(item: Pick<GroceryItem, 'id' | 'name' | 'quantity' | 'unit'>, words: Pick<GroceryWords, 'pieces'>): string | null {
  const amount = amountText(item);
  if (amount === null) return null;
  return item.unit == null || item.unit === 'piece' ? words.pieces(amount) : amount;
}

// --- What to buy (spec 021) ------------------------------------------------------------------

/** One catalog entry's packs per store (the family's correction replacing the catalog's) and facts. */
export interface PackData {
  packs: Record<StoreProfile, StorePack[]>;
  facts: IngredientFactsInput;
  /** The family's own pack size (FR-004), as typed: "250 g", "6". Null when it uses the catalog's. */
  corrected: string | null;
}

/** The list's catalog entries, each once. */
export const packKeys = (items: readonly Pick<GroceryItem, 'catalog_key'>[]) => [...new Set(items.flatMap((i) => (i.catalog_key ? [i.catalog_key] : [])))].sort();

/** FR-002: packs and facts for the list's catalog entries, from spec 031's views. */
export async function loadPacks(client: Pick<Db, 'from'>, keys: readonly string[]): Promise<Record<string, PackData>> {
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
export function buyText(plan: PackPlan, words: GroceryWords): string {
  if (plan.loose) {
    const { pack, amount, kind } = plan.loose;
    const imperial = pack.unit === 'lb' || pack.unit === 'oz';
    const f = format({ id: 'buy', name: '', quantity: amount, unit: kind === 'weight' ? 'g' : 'ml' }, { system: imperial ? 'imperial' : 'metric', scale: true });
    return words.loose(`${f.amount} ${f.unit}`.trim());
  }
  const [only] = plan.picks;
  // Sold one by one: "6 pieces".
  if (plan.picks.length === 1 && only && only.pack.loose && only.pack.size === 1) return words.pieces(String(only.count));
  const parts = plan.picks.map(({ pack, count }) => (count > 1 ? words.packCount(count, pack.label) : /^\d/.test(pack.label) ? pack.label : words.onePack(pack.label)));
  return parts.join(words.packsJoin);
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
 * Amounts of one thing as one, from @cocon/quantity: "300 ml", "15 pieces", or "11 pieces + 600 g"
 * when they don't convert. Null when none has an amount. The list's rows and Add to groceries'
 * notes (spec 022) both read it.
 */
export function combinedText(name: string, amounts: readonly GroceryAmount[], facts: IngredientFactsInput | null | undefined, words: GroceryWords): string | null {
  const { parts } = combineAmounts(amounts, facts);
  const texts = parts.flatMap((p) => rowText({ id: name, name, quantity: p.quantity, unit: p.unit }, words) ?? []);
  return texts.length > 0 ? texts.join(words.packsJoin) : null;
}

/**
 * Each row's amounts, beside the name: "Heavy cream: 1 pint carton (need 300 ml)", or just
 * "Heavy cream: 300 ml" when there's no pack, round-up is off (spec 021 US3), or the amounts don't
 * add up to one. Nothing for a row with no quantity ("Salt").
 */
export function rowAmounts(rows: readonly GroceryRow[], packs: Record<string, PackData> | undefined, settings: FamilySettings, words: GroceryWords): Map<string, RowAmounts> {
  const out = new Map<string, RowAmounts>();
  for (const row of rows) {
    const first = row.items[0] as GroceryItem;
    const data = first.catalog_key ? packs?.[first.catalog_key] : undefined;
    const catalogName = data?.facts.name;
    // "Lemon: 2 pieces" reads as a label; a name the matcher only got close to ("Meyer lemons") stays as typed.
    const name = catalogName && normaliseName(catalogName) === normaliseName(first.name) ? catalogName : undefined;
    const need = combinedText(first.name, row.items, data?.facts ?? null, words);
    const shown: RowAmounts = { ...(name ? { name } : {}), ...(need ? { detail: need } : {}) };
    out.set(row.id, shown);
    if (!settings.round_to_packs || !need || !data) continue;
    const { total } = combineAmounts(row.items, data.facts);
    const sum = total?.quantity == null ? null : sumNeeds([{ quantity: total.quantity, unit: total.unit === 'piece' ? null : total.unit }], data.facts);
    const plan = sum ? pickPacks(sum, data.packs[settings.store_profile], data.facts, settings.store_profile) : null;
    if (!plan) continue;
    // Exactly what's needed (loose by weight, one by one, 2 × 1 l for 2 L): no need to say it twice.
    const exact = plan.leftover <= plan.need * 0.01 && !plan.approximate;
    out.set(row.id, exact ? { ...shown, detail: buyText(plan, words) } : { ...shown, detail: buyText(plan, words), note: words.needNote(need) });
  }
  return out;
}

// --- Writes ----------------------------------------------------------------------------------

/** Who is adding: the member, and how ('app' or the assistant's name), for merging (spec 022). */
export interface GroceryWriter {
  familyId: string;
  userId: string;
  source: string;
}

export type AddResult =
  | { status: 'added'; unmatched: boolean }
  | { status: 'merged'; total: string | null }
  | { status: 'empty' }
  | { status: 'failed' };

/**
 * Spec 020 US2: "2 lemons" → Lemons, 2, in Produce. FR-002 reads the text with spec 015's parser;
 * the aisle is the catalog matcher's (family correction, then catalog, then Other). It merges into
 * the writer's own item of the same thing (planGroceryAdd: same person, and same app or assistant);
 * someone else's, or a recipe's, keeps its own item, so the row can say who it's for (spec 022).
 * Either way, something already on the list says what the row now comes to: "Updated to 15 pieces".
 */
export async function addItem(client: Pick<Db, 'from' | 'rpc'>, writer: GroceryWriter, list: readonly GroceryItem[], text: string, words: GroceryWords): Promise<AddResult> {
  const parsed = parseGroceryLine(text.slice(0, 200));
  if (!parsed) return { status: 'empty' };
  const name = parsed.name.slice(0, 80).trim();
  if (!name) return { status: 'empty' };
  try {
    const [facts] = (await matchIngredients(client, [name])) ?? [undefined];
    const add = { name, catalog_key: facts?.catalog_key ?? null, quantity: parsed.quantity, unit: parsed.quantity == null ? null : parsed.unit };
    const plan = planGroceryAdd(list, { ...add, recipe_id: null, created_by: writer.userId, source: writer.source });
    const identity = groceryIdentity(add);
    const listed = list.filter((i) => !i.checked && groceryIdentity(i) === identity);
    if (plan.kind === 'merge') {
      const change = GroceryItemUpdate.safeParse({ quantity: plan.quantity, unit: plan.unit });
      if (!change.success) return { status: 'failed' };
      const { error } = await client.from('grocery_items').update(change.data).eq('id', plan.id);
      if (error) return { status: 'failed' };
      const now = listed.map((i) => (i.id === plan.id ? { quantity: plan.quantity, unit: plan.unit } : i));
      return { status: 'merged', total: combinedText(name, now, facts, words) };
    }
    const row = GroceryItemInput.parse({ ...add, aisle: facts?.aisle ?? 'other' });
    const { error } = await client.from('grocery_items').insert({ ...row, family_id: writer.familyId });
    if (error) return { status: 'failed' };
    if (listed.length > 0) return { status: 'merged', total: combinedText(name, [...listed, add], facts, words) };
    // A failed lookup isn't a miss: only count names the catalog really doesn't know.
    return { status: 'added', unmatched: facts === null };
  } catch {
    return { status: 'failed' };
  }
}

/** Spec 020 FR-005: tick or untick. The database stamps who and when. */
export const setChecked = (client: Pick<Db, 'from'>, ids: string | readonly string[], checked: boolean) =>
  typeof ids === 'string' ? client.from('grocery_items').update({ checked }).eq('id', ids) : client.from('grocery_items').update({ checked }).in('id', [...ids]);

/** "Clear done items" and "Remove": hidden at once, kept a day for Undo (then the nightly purge). Never deleted. */
export async function clearItems(client: Pick<Db, 'from'>, ids: readonly string[]): Promise<boolean> {
  if (ids.length === 0) return true;
  // Any time will do: the database stamps its own, and who cleared it.
  const { error } = await client.from('grocery_items').update({ deleted_at: new Date().toISOString() }).in('id', ids);
  return !error;
}

/** Undo: the items come back as they were, with who added and ticked them. */
export async function restoreItems(client: Pick<Db, 'from'>, ids: readonly string[]): Promise<boolean> {
  if (ids.length === 0) return true;
  const { error } = await client.from('grocery_items').update({ deleted_at: null }).in('id', ids);
  return !error;
}

/** The servings a recipe is on the list for: one row per recipe, made or changed. */
export async function saveRecipeServings(client: Pick<Db, 'from'>, familyId: string, recipeId: string, servings: number): Promise<boolean> {
  const row = GroceryRecipeInput.safeParse({ recipe_id: recipeId, servings });
  if (!row.success) return false;
  const { error } = await client.from('grocery_recipes').upsert({ ...row.data, family_id: familyId }, { onConflict: 'family_id,recipe_id' });
  return !error;
}

/**
 * The card menu's servings (spec 022): the recipe's items still to buy are rescaled by `to / from`
 * (counts round up); ticked ones are bought already and stay. Then the new servings are saved. On a
 * failure, what had changed is put back.
 */
export async function setRecipeServings(
  client: Pick<Db, 'from'>,
  familyId: string,
  recipeId: string,
  from: number,
  to: number,
  items: readonly GroceryItem[],
): Promise<boolean> {
  if (from === to) return true;
  const changes = recipeItems(items, recipeId).flatMap((item) => {
    if (item.checked || item.quantity == null) return [];
    const after = rescaleGroceryAmount(item, from, to);
    const change = GroceryItemUpdate.safeParse({ quantity: after.quantity, unit: after.unit });
    return change.success && after.quantity !== item.quantity ? [{ item, change: change.data }] : [];
  });
  try {
    const results = await Promise.all(changes.map((c) => client.from('grocery_items').update(c.change).eq('id', c.item.id)));
    const saved = results.every((r) => !r.error) && (await saveRecipeServings(client, familyId, recipeId, to));
    if (saved) return true;
    await Promise.all(
      changes.filter((_, n) => !results[n]?.error).map((c) => client.from('grocery_items').update({ quantity: c.item.quantity, unit: c.item.unit }).eq('id', c.item.id)),
    );
    return false;
  } catch {
    return false;
  }
}

// --- From a recipe (spec 022) ----------------------------------------------------------------

/** One of the recipe's ingredients for the list (OC-AddGroceries), as the recipe page shows it. */
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
 * The ingredients at the given servings (or scale by an ingredient), variants and units, and the
 * servings for the lead. The list gets the scaled amount in the recipe's own unit; counts round
 * up, since you can't buy ⅓ of a leek.
 */
export function recipeGroceryLines(
  recipe: RecipeDetail,
  choices: VariantChoice & PageScale,
  options: FormatOptions,
): { servings: string; serves: number; lines: RecipeGroceryLine[] } {
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

const revertMerges = async (client: Pick<Db, 'from'>, merges: readonly GroceryMerge[]) => {
  const results = await Promise.all(merges.map((m) => client.from('grocery_items').update(GroceryItemUpdate.parse(m.before)).eq('id', m.id)));
  return results.every((r) => !r.error);
};

/**
 * Spec 022 US1–US2: adds the lines to the list, each carrying the recipe (FR-003; the database
 * sets `from_recipe` from it, so `recipe_id` is never changed after). What this recipe already has
 * on the list is updated instead of added again (FR-002, SC-001), planned against the list as it
 * is now; anything else of the same thing keeps its own item, and the list shows them as one row.
 * Null when it failed; anything it had done by then is put back.
 *
 * The list records the servings it's for. With the recipe already on the list (the new amounts
 * merged into its items), they add up: 4 then 2 more is 6. Otherwise they start again.
 */
export async function addFromRecipe(
  client: Pick<Db, 'from' | 'rpc'>,
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
    // Only into this recipe's own items (same recipe_id, whoever added them): someone's own apples
    // keep their item, and the row says both.
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

/** Spec 022 FR-004 Undo: removes exactly the rows it added and puts merged items back as they were. */
export async function undoAddFromRecipe(client: Pick<Db, 'from'>, added: AddedFromRecipe): Promise<boolean> {
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
