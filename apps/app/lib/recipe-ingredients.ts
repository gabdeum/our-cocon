import { ingredientToken, parseAmount, pieceNouns, type IngredientFactsInput, type ParsedLine, type QuantityIngredient } from '@cocon/quantity';
import {
  familyIngredientRow,
  IngredientInput,
  normaliseName,
  parseIngredientText,
  pieceSnapshot,
  type Aisle,
  type IngredientFacts,
  type IngredientRow,
  type SizeWord,
  type Unit,
} from '@cocon/schemas';
import type { Client } from './supabase';

/** Facts the form needs about a linked ingredient: its sizes and what one piece is called. */
export type FormFacts = IngredientFactsInput & { catalog_key?: string | null };

/** One ingredient row while it's being typed (spec 015 FR-001). Amounts stay text until Save reads them. */
export interface IngredientDraft {
  /** Stable while editing, for React and warnings. */
  key: string;
  /** The row's id: kept for saved rows (steps point at it), new for added ones. */
  id: string;
  name: string;
  quantity: string;
  unit: Unit | null;
  /** Pieces only: "1 small onion". */
  sizeWord: SizeWord | null;
  /** The weight of one piece, in grams (pieces only). */
  weight: string;
  /** What one piece is called, when the pasted line or the saved row said ("clove"); else the catalog's, else from the name. */
  nounSingular: string;
  nounPlural: string;
  catalogKey: string | null;
  facts: FormFacts | null;
  /** The catalog has no such name: Save adds it to the family's ingredients with this aisle. */
  isNew: boolean;
  newAisle: Aisle | null;
  /** Kept as saved: the form doesn't edit it. */
  prepNote: string | null;
}

/** A saved row as the form loads it. */
export type SavedIngredient = IngredientRow & { position: number };

const VULGAR_THIRDS: Record<number, string> = { 1: '⅓', 2: '⅔' };
const VULGAR_QUARTERS: Record<number, string> = { 1: '¼', 2: '½', 3: '¾' };

/** How a stored amount shows in the field: "1½", "⅓", "200", "0.15". */
export function quantityText(value: number | null | undefined): string {
  if (value == null) return '';
  const whole = Math.floor(value + 1e-9);
  const rest = value - whole;
  const head = whole > 0 ? String(whole) : '';
  if (Math.abs(rest) < 1e-9) return String(whole);
  for (const [den, table] of [
    [4, VULGAR_QUARTERS],
    [3, VULGAR_THIRDS],
  ] as const) {
    const n = Math.round(rest * den);
    if (Math.abs(rest * den - n) < 1e-6 && table[n]) return `${head}${table[n]}`;
  }
  return String(Math.round(value * 1000) / 1000);
}

let seq = 0;
const nextKey = () => `ing-${(seq += 1)}`;

export function emptyDraft(id: string): IngredientDraft {
  return {
    key: nextKey(),
    id,
    name: '',
    quantity: '',
    unit: null,
    sizeWord: null,
    weight: '',
    nounSingular: '',
    nounPlural: '',
    catalogKey: null,
    facts: null,
    isNew: false,
    newAisle: null,
    prepNote: null,
  };
}

/** The saved rows, in order, ready to edit. */
export function draftsFromRows(rows: SavedIngredient[], facts: Record<string, FormFacts>): IngredientDraft[] {
  return [...rows]
    .sort((a, b) => a.position - b.position)
    .map((r) => ({
      ...emptyDraft(r.id),
      name: r.name,
      quantity: quantityText(r.quantity),
      unit: r.unit ?? null,
      sizeWord: r.size_word ?? null,
      weight: r.weight_per_piece_g != null ? quantityText(r.weight_per_piece_g) : '',
      nounSingular: r.piece_noun_singular ?? '',
      nounPlural: r.piece_noun_plural ?? '',
      catalogKey: r.catalog_key ?? null,
      facts: r.catalog_key ? (facts[r.catalog_key] ?? null) : null,
      prepNote: r.prep_note ?? null,
    }));
}

/** A pasted line as a row (US1). Matching against the catalog comes after (`applyMatch`). */
export function draftFromParsed(line: ParsedLine, id: string): IngredientDraft {
  return {
    ...emptyDraft(id),
    name: line.name,
    quantity: quantityText(line.quantity),
    unit: line.unit,
    sizeWord: line.size_word,
    nounSingular: line.piece_noun?.singular ?? '',
    nounPlural: line.piece_noun?.plural ?? '',
  };
}

/** The sizes a linked ingredient offers in the unit list ("1 small onion"). */
export function sizesOf(facts: FormFacts | null): SizeWord[] {
  if (!facts) return [];
  const out: SizeWord[] = [];
  if (facts.size_small_g != null) out.push('small');
  if (facts.size_medium_g != null) out.push('medium');
  if (facts.size_large_g != null) out.push('large');
  return out.length > 1 ? out : [];
}

/** The catalog's weight for one piece of this row's size (US2's suggested default). */
function catalogWeight(facts: FormFacts | null, size: SizeWord | null): string {
  if (!facts) return '';
  const grams = pieceSnapshot(
    { ...facts, name: facts.name ?? '', plural: facts.plural ?? '', default_size: facts.default_size ?? null } as IngredientFacts,
    size,
  ).weight_per_piece_g;
  return grams != null ? quantityText(grams) : '';
}

/**
 * A unit picked in the unit list. Pieces get the catalog's weight for the size when none is typed
 * yet, or when the size changed and the weight was the catalog's own.
 */
export function withUnit(draft: IngredientDraft, unit: Unit | null, sizeWord: SizeWord | null = null): IngredientDraft {
  if (unit !== 'piece') return { ...draft, unit, sizeWord: null };
  const before = catalogWeight(draft.facts, draft.sizeWord);
  const weight = !draft.weight || draft.weight === before ? catalogWeight(draft.facts, sizeWord) || draft.weight : draft.weight;
  return { ...draft, unit, sizeWord, weight };
}

/**
 * What the catalog knows about the row's name (a picked suggestion, or `match_ingredients`), or null
 * when it knows nothing: the row is then a new ingredient and asks for its aisle.
 */
export function applyMatch(draft: IngredientDraft, facts: FormFacts | null, picked = false): IngredientDraft {
  if (!facts || (!facts.catalog_key && !picked)) {
    // The family's own ingredient (matched, no catalog key) isn't new; nothing at all is.
    return { ...draft, catalogKey: null, facts: facts ?? null, isNew: !facts };
  }
  const next: IngredientDraft = {
    ...draft,
    name: picked && facts.name ? facts.name : draft.name,
    catalogKey: facts.catalog_key ?? null,
    facts,
    isNew: false,
    newAisle: null,
  };
  if (next.unit === 'piece' && !next.weight) next.weight = catalogWeight(facts, next.sizeWord);
  if (next.sizeWord && !sizesOf(facts).includes(next.sizeWord)) next.sizeWord = null;
  return next;
}

/** The name was typed over: whatever it was linked to, and what one piece was called, no longer apply. */
export function withName(draft: IngredientDraft, name: string): IngredientDraft {
  return { ...draft, name, catalogKey: null, facts: null, isNew: false, newAisle: null, nounSingular: '', nounPlural: '' };
}

export type IngredientWarning = 'nameMissing' | 'quantityInvalid' | 'unitMissing' | 'amountMissing' | 'weightInvalid';

/** What `save_recipe_ingredients` takes per row, in order. */
export type IngredientSaveRow = Omit<IngredientInput, 'position'> & { id: string };

/** What one piece is called: the row's own (a pasted "2 cloves garlic", or as saved), the catalog's, or from the name. */
function nounsOf(d: IngredientDraft, name: string): { singular: string; plural: string } {
  if (d.nounSingular && d.nounPlural) return { singular: d.nounSingular, plural: d.nounPlural };
  if (d.facts?.noun_singular && d.facts.noun_plural) return { singular: d.facts.noun_singular, plural: d.facts.noun_plural };
  return pieceNouns(name);
}

/**
 * A row as the quantity engine reads it, while it's still being typed: for the Steps Preview
 * (spec 016), so "2 leeks (300 g)" shows before Save. An amount that doesn't read yet is left out.
 */
export function quantityOf(d: IngredientDraft): QuantityIngredient {
  const name = d.name.trim();
  const quantity = parseAmount(d.quantity);
  const amount = quantity === 'invalid' ? null : quantity;
  const piece = d.unit === 'piece' && amount !== null;
  const weight = piece ? parseAmount(d.weight) : null;
  const nouns = piece ? nounsOf(d, name) : null;
  return {
    id: d.id,
    name,
    quantity: amount,
    unit: amount !== null ? d.unit : null,
    size_word: piece ? d.sizeWord : null,
    weight_per_piece_g: weight === 'invalid' ? null : weight,
    piece_noun_singular: nouns?.singular ?? null,
    piece_noun_plural: nouns?.plural ?? null,
    facts: d.facts,
  };
}

const isBlank = (d: IngredientDraft) => !d.name.trim() && !d.quantity.trim() && !d.weight.trim();

/**
 * Save's reading of the rows (US3, OC-EditIngredients › Validation copy): the rows to save, or a
 * warning per row. Rows left completely empty are dropped.
 */
export function readIngredients(drafts: IngredientDraft[]): { rows: IngredientSaveRow[] } | { warnings: Record<string, IngredientWarning> } {
  const warnings: Record<string, IngredientWarning> = {};
  const rows: IngredientSaveRow[] = [];
  for (const d of drafts) {
    if (isBlank(d)) continue;
    const name = d.name.trim();
    const quantity = parseAmount(d.quantity);
    const piece = d.unit === 'piece';
    const weight = piece ? parseAmount(d.weight) : null;
    if (quantity === 'invalid') warnings[d.key] = 'quantityInvalid';
    else if (quantity !== null && d.unit === null) warnings[d.key] = 'unitMissing';
    else if (quantity === null && d.unit !== null) warnings[d.key] = 'amountMissing';
    else if (weight === 'invalid') warnings[d.key] = 'weightInvalid';
    else if (!name) warnings[d.key] = 'nameMissing';
    if (warnings[d.key] || quantity === 'invalid' || weight === 'invalid') continue;
    const nouns = piece ? nounsOf(d, name) : null;
    const row = {
      name: name.slice(0, 80).trim(),
      catalog_key: d.catalogKey,
      quantity,
      unit: d.unit,
      size_word: piece ? d.sizeWord : null,
      weight_per_piece_g: weight,
      piece_noun_singular: nouns?.singular.slice(0, 40) ?? null,
      piece_noun_plural: nouns?.plural.slice(0, 40) ?? null,
      prep_note: d.prepNote,
    };
    const parsed = IngredientInput.safeParse({ ...row, position: rows.length });
    if (!parsed.success) {
      warnings[d.key] = parsed.error.issues.some((i) => i.path[0] === 'name') ? 'nameMissing' : 'quantityInvalid';
      continue;
    }
    const { position: _position, ...valid } = parsed.data;
    rows.push({ ...valid, id: d.id });
  }
  return Object.keys(warnings).length > 0 ? { warnings } : { rows };
}

/** Whether the rows differ from how they were loaded (Cancel asks, Save writes them). */
export function ingredientsChanged(start: IngredientDraft[], now: IngredientDraft[]): boolean {
  const norm = (ds: IngredientDraft[]) =>
    JSON.stringify(
      ds.filter((d) => !isBlank(d)).map((d) => [d.id, d.name, d.quantity, d.unit, d.sizeWord, d.weight, d.nounSingular, d.nounPlural, d.catalogKey, d.newAisle]),
    );
  return norm(start) !== norm(now);
}

/** The step numbers (from 1) whose text mentions the ingredient (the remove dialog). */
export function stepsUsing(id: string, steps: { position: number; body: string }[]): number[] {
  const token = ingredientToken(id);
  return [...steps]
    .sort((a, b) => a.position - b.position)
    .flatMap((s, i) => (s.body.includes(token) ? [i + 1] : []));
}

/** Typeahead for the name field (spec 031's `suggest_ingredients`). Empty on any failure. */
export async function suggestIngredients(client: Pick<Client, 'rpc'>, text: string, limit = 5): Promise<IngredientFacts[]> {
  const q = normaliseName(text);
  if (!q) return [];
  try {
    const { data, error } = await client.rpc('suggest_ingredients', { q, lim: limit });
    return error || !data ? [] : (data as IngredientFacts[]);
  } catch {
    return [];
  }
}

/**
 * The catalog's facts for each name (spec 031's `match_ingredients`), in order: null where nothing
 * matched. Undefined when the lookup failed, so rows aren't marked new just because we're offline.
 */
export async function matchIngredients(client: Pick<Client, 'rpc'>, names: string[]): Promise<(FormFacts | null)[] | undefined> {
  if (names.length === 0) return [];
  try {
    const queries = names.map((n) => {
      const { full, core } = parseIngredientText(n);
      return { full: full.slice(0, 80), core: core.slice(0, 80) };
    });
    const { data, error } = await client.rpc('match_ingredients', { queries });
    if (error || !data) return undefined;
    const out: (FormFacts | null)[] = names.map(() => null);
    for (const row of data) {
      if (row.how === 'none') continue;
      out[row.idx] = row as FormFacts;
    }
    return out;
  } catch {
    return undefined;
  }
}

/**
 * Saves the rows: new ingredients go into the family's own list with their aisle (spec 031), then the
 * recipe's whole list in one call (rows left out are removed, and taken out of the steps).
 */
export async function saveIngredients(
  client: Pick<Client, 'from' | 'rpc'>,
  target: { recipeId: string; familyId: string },
  rows: IngredientSaveRow[],
  drafts: IngredientDraft[],
): Promise<boolean> {
  try {
    // An aisle the family already gave that name is kept (ignoreDuplicates).
    const custom = drafts.filter((d) => d.isNew && d.newAisle && d.name.trim());
    if (custom.length > 0) {
      const byName = new Map(
        custom.map((d) => {
          const row = familyIngredientRow({ custom_name: d.name.trim().slice(0, 80).trim(), aisle: d.newAisle });
          return [row.name_norm, { ...row, family_id: target.familyId }] as const;
        }),
      );
      const { error } = await client.from('family_ingredients').upsert([...byName.values()], { onConflict: 'family_id,name_norm', ignoreDuplicates: true });
      if (error) return false;
    }
    const { error } = await client.rpc('save_recipe_ingredients', { p_recipe_id: target.recipeId, p_ingredients: rows });
    return !error;
  } catch {
    return false;
  }
}
