import { renderTemperatureCheck, type IngredientFactsInput } from '@cocon/quantity';
import {
  brokenChanges,
  MAX_VARIANT_CHANGES,
  parseMinutes,
  VariantInput,
  variantConflicts,
  type EventProps,
  type IngredientRow,
  type Json,
  type RecipeVariant,
  type VariantChange,
  type VariantKind,
} from '@cocon/schemas';
import { strings } from '../strings/en';
import { formatTotalTime } from './recipe-format';
import {
  draftsFromRows,
  emptyDraft,
  quantityOf,
  readIngredients,
  type FormFacts,
  type IngredientDraft,
  type IngredientWarning,
} from './recipe-ingredients';
import { draftsFromSteps, emptyStep, isBlankStep, readSteps, segmentsOf, shownText, type SavedStep, type StepDraft, type StepSaveRow, type StepWarnings } from './recipe-steps';
import { defaultFormat, ingredientLine } from './recipe-view';
import type { Client } from './supabase';

const v = strings.recipeForm.variants;
const sum = strings.recipeSettings.summary;

export type ChangeType = VariantChange['type'];
export const CHANGE_TYPES: readonly ChangeType[] = ['swap_ingredient', 'add_ingredient', 'remove_ingredient', 'add_step', 'change_step', 'remove_step'];

interface ChangeBase {
  /** Stable while editing, for React and warnings. */
  key: string;
  /** The change as it was saved, written back as is until it's edited (an assistant may have set fields the form doesn't show). */
  saved: VariantChange | null;
  edited: boolean;
}

/**
 * One change while it's being edited (FR-002). Ingredients and steps reuse the form's own drafts
 * (specs 015, 016). A target id is null until it's picked.
 */
export type ChangeDraft = ChangeBase &
  (
    | { type: 'swap_ingredient'; ingredientId: string | null; with: IngredientDraft[] }
    | { type: 'add_ingredient'; ingredient: IngredientDraft }
    | { type: 'remove_ingredient'; ingredientId: string | null }
    | { type: 'add_step'; stepId: string | null; place: 'before' | 'after'; step: StepDraft }
    | { type: 'change_step'; stepId: string | null; step: StepDraft }
    | { type: 'remove_step'; stepId: string | null }
  );

/** One variant while it's being edited (FR-001). */
export interface VariantDraft {
  key: string;
  id: string;
  name: string;
  kind: VariantKind;
  changes: ChangeDraft[];
  /** Saved changes the form can't read (an older shape, an assistant's mistake): written back as they were. */
  unreadable: Json[];
}

/** What `save_recipe_variants` takes per variant, in order. */
export type VariantSaveRow = {
  id: string;
  name: string;
  kind: VariantKind;
  /** Unreadable ones last: the recipe page skips them, so where they sit changes nothing. */
  changes: (VariantChange | Json)[];
};

let seq = 0;
const nextKey = (what: string) => `${what}-${(seq += 1)}`;

/** Variant ingredients don't ask for an aisle: they're matched, or left as they are. */
const noAisle = (d: IngredientDraft): IngredientDraft => ({ ...d, isNew: false, newAisle: null });

export function emptyVariant(id: string): VariantDraft {
  return { key: nextKey('variant'), id, name: '', kind: 'version', changes: [], unreadable: [] };
}

/** A new change of a type, nothing picked yet. */
export function newChange(type: ChangeType, newId: () => string): ChangeDraft {
  const base = { key: nextKey('change'), saved: null, edited: true };
  switch (type) {
    case 'swap_ingredient':
      return { ...base, type, ingredientId: null, with: [emptyDraft(newId())] };
    case 'add_ingredient':
      return { ...base, type, ingredient: emptyDraft(newId()) };
    case 'add_step':
      return { ...base, type, stepId: null, place: 'before', step: emptyStep(newId()) };
    case 'change_step':
      return { ...base, type, stepId: null, step: emptyStep(newId()) };
    default:
      return { ...base, type, ingredientId: null, stepId: null } as ChangeDraft;
  }
}

/** A change step's editor starts from the base step as it is in the form. */
export function pickChangeStep(change: Extract<ChangeDraft, { type: 'change_step' }>, base: StepDraft): ChangeDraft {
  return { ...change, edited: true, stepId: base.id, step: { ...base, key: change.step.key, tipOn: false, photoOn: false } };
}

type AddedStep = Extract<VariantChange, { type: 'add_step' }>['step'];

const asSaved = (step: AddedStep, id: string): SavedStep => ({
  id,
  position: 0,
  name: step.name ?? null,
  body: step.body,
  timer_seconds: step.timer_seconds ?? null,
  timer_label: step.timer_label ?? null,
  temp_check_c: step.temp_check_c ?? null,
  temp_check_text: step.temp_check_text ?? null,
  tip: step.tip ?? null,
  photo_path: step.photo_path ?? null,
});

function draftOf(change: VariantChange, variantId: string, index: number, baseSteps: readonly SavedStep[], facts: Record<string, FormFacts>): ChangeDraft {
  const base = { key: nextKey('change'), saved: change, edited: false };
  const rows = (list: IngredientRow[]) => draftsFromRows(list.map((r, position) => ({ ...r, position })), facts).map(noAisle);
  switch (change.type) {
    case 'swap_ingredient':
      return { ...base, type: change.type, ingredientId: change.ingredient_id, with: rows(change.with) };
    case 'add_ingredient':
      return { ...base, type: change.type, ingredient: rows([change.ingredient])[0] as IngredientDraft };
    case 'remove_ingredient':
      return { ...base, type: change.type, ingredientId: change.ingredient_id };
    case 'add_step':
      return { ...base, type: change.type, stepId: change.step_id, place: change.place, step: draftsFromSteps([asSaved(change.step, `${variantId}:${index}`)])[0] as StepDraft };
    case 'change_step': {
      const { type: _type, step_id, ...fields } = change;
      const from = baseSteps.find((s) => s.id === step_id);
      const merged = from ? { ...from, ...fields } : asSaved({ body: fields.body ?? '', ...fields }, step_id);
      return { ...base, type: change.type, stepId: step_id, step: { ...(draftsFromSteps([merged])[0] as StepDraft), tipOn: false, photoOn: false } };
    }
    case 'remove_step':
      return { ...base, type: change.type, stepId: change.step_id };
  }
}

/** The saved variants, in order, ready to edit. */
export function draftsFromVariants(variants: readonly (RecipeVariant & { unreadable?: Json[] })[], baseSteps: readonly SavedStep[], facts: Record<string, FormFacts>): VariantDraft[] {
  return [...variants]
    .sort((a, b) => a.position - b.position)
    .map((r) => ({
      key: nextKey('variant'),
      id: r.id,
      name: r.name,
      kind: r.kind,
      changes: r.changes.map((c, i) => draftOf(c, r.id, i, baseSteps, facts)),
      unreadable: r.unreadable ?? [],
    }));
}

/** Whether the variants differ from how they were loaded (Cancel asks, Save writes them). Edits replace drafts, so an untouched list is the same. */
export function variantsChanged(start: VariantDraft[], now: VariantDraft[]): boolean {
  return start.length !== now.length || start.some((d, i) => d !== now[i]);
}

// ——— Reading what's typed ———

const isBlankRow = (d: IngredientDraft) => !d.name.trim() && !d.quantity.trim() && !d.weight.trim();

/** A row as it reads now, for summaries and warnings before Save. */
function rowOf(d: IngredientDraft): IngredientRow {
  const q = quantityOf(d);
  return {
    id: d.id,
    name: q.name,
    catalog_key: d.catalogKey,
    quantity: q.quantity,
    unit: q.unit ?? null,
    size_word: q.size_word ?? null,
    weight_per_piece_g: q.weight_per_piece_g ?? null,
    piece_noun_singular: q.piece_noun_singular ?? null,
    piece_noun_plural: q.piece_noun_plural ?? null,
    prep_note: d.prepNote,
  };
}

const stepFields = ['body', 'timer_seconds', 'timer_label', 'temp_check_c', 'temp_check_text'] as const;

/** What a change step changes: the fields that differ from the base step (null clears one). */
function stepDiff(now: StepSaveRow, base: StepSaveRow | null): Partial<Pick<StepSaveRow, (typeof stepFields)[number]>> {
  const out: Record<string, unknown> = {};
  for (const k of stepFields) if (!base || (now[k] ?? null) !== (base[k] ?? null)) out[k] = now[k] ?? null;
  // The body can't be cleared, only rewritten.
  if (out.body === null) delete out.body;
  return out;
}

const readOne = (d: StepDraft) => {
  const r = readSteps([d]);
  return 'rows' in r ? (r.rows[0] ?? null) : null;
};

/** A change as it reads now, or null while it has nothing to point at. Lenient: for summaries and warnings, not for Save. */
export function previewChange(c: ChangeDraft, baseSteps: readonly StepDraft[]): VariantChange | null {
  if (!c.edited && c.saved) return c.saved;
  switch (c.type) {
    case 'swap_ingredient':
      return c.ingredientId ? { type: c.type, ingredient_id: c.ingredientId, with: c.with.filter((d) => !isBlankRow(d)).map(rowOf) } : null;
    case 'add_ingredient':
      return c.ingredient.name.trim() ? { type: c.type, ingredient: rowOf(c.ingredient) } : null;
    case 'add_step': {
      if (!c.stepId) return null;
      const minutes = c.step.timerOn ? parseMinutes(c.step.minutes) : null;
      return {
        type: c.type,
        step_id: c.stepId,
        place: c.place,
        step: { name: c.step.name.trim() || null, body: c.step.body, timer_seconds: typeof minutes === 'number' ? minutes * 60 : null },
      };
    }
    case 'change_step': {
      if (!c.stepId) return null;
      const base = baseSteps.find((s) => s.id === c.stepId);
      const now = readOne(c.step);
      if (!now) return { type: c.type, step_id: c.stepId, body: c.step.body };
      return { type: c.type, step_id: c.stepId, ...stepDiff(now, base ? readOne(base) : null) };
    }
    default:
      return c.type === 'remove_ingredient'
        ? c.ingredientId
          ? { type: c.type, ingredient_id: c.ingredientId }
          : null
        : c.stepId
          ? { type: c.type, step_id: c.stepId }
          : null;
  }
}

export type ChangeWarning = keyof typeof v.changeWarnings;

export interface VariantWarning {
  name?: 'nameMissing';
  changes?: 'noChanges';
  /** By change key. */
  change: Record<string, ChangeWarning>;
  /** The rows and steps inside the changes, by their draft keys, as the Ingredients and Steps sections warn. */
  rows: Record<string, IngredientWarning>;
  steps: StepWarnings;
}
export type VariantWarnings = Record<string, VariantWarning>;

type Read = { change: VariantChange } | { drop: true } | { warning: ChangeWarning; rows?: Record<string, IngredientWarning>; steps?: StepWarnings };

function readChange(c: ChangeDraft, baseSteps: readonly StepDraft[]): Read {
  if (!c.edited && c.saved) return { change: c.saved };
  switch (c.type) {
    case 'swap_ingredient': {
      const blank = c.with.every(isBlankRow);
      if (!c.ingredientId) return blank ? { drop: true } : { warning: 'pickIngredient' };
      const read = readIngredients(c.with);
      if ('warnings' in read) return { warning: 'rows', rows: read.warnings };
      if (read.rows.length === 0) return { warning: 'swapEmpty' };
      return { change: { type: c.type, ingredient_id: c.ingredientId, with: read.rows } };
    }
    case 'add_ingredient': {
      if (isBlankRow(c.ingredient)) return { drop: true };
      const read = readIngredients([c.ingredient]);
      if ('warnings' in read) return { warning: 'rows', rows: read.warnings };
      const row = read.rows[0];
      return row ? { change: { type: c.type, ingredient: row } } : { warning: 'addEmpty' };
    }
    case 'add_step': {
      if (!c.stepId) return isBlankStep(c.step) ? { drop: true } : { warning: 'pickStep' };
      const read = readSteps([c.step]);
      if ('warnings' in read) return { warning: 'steps', steps: read.warnings };
      const row = read.rows[0];
      if (!row) return { warning: 'stepEmpty' };
      const { id: _id, ...step } = row;
      return { change: { type: c.type, step_id: c.stepId, place: c.place, step } };
    }
    case 'change_step': {
      if (!c.stepId) return { drop: true };
      const read = readSteps([c.step]);
      if ('warnings' in read) return { warning: 'steps', steps: read.warnings };
      const row = read.rows[0];
      if (!row) return { warning: 'stepEmpty' };
      const base = baseSteps.find((s) => s.id === c.stepId);
      const diff = stepDiff(row, base ? readOne(base) : null);
      if (Object.keys(diff).length === 0) return { warning: 'stepUnchanged' };
      return { change: { type: c.type, step_id: c.stepId, ...diff } };
    }
    default: {
      const change = previewChange(c, baseSteps);
      return change ? { change } : { drop: true };
    }
  }
}

/**
 * Save's reading of the variants (OC-EditVariants › Validation copy): the rows to save, or warnings
 * per variant. Changes with nothing picked and nothing typed are dropped. A change step saves only
 * what differs from the base step as it's being saved.
 */
export function readVariants(drafts: VariantDraft[], baseSteps: readonly StepDraft[]): { rows: VariantSaveRow[] } | { warnings: VariantWarnings } {
  const warnings: VariantWarnings = {};
  const rows: VariantSaveRow[] = [];
  drafts.forEach((d, position) => {
    const w: VariantWarning = { change: {}, rows: {}, steps: {} };
    const changes: VariantChange[] = [];
    for (const c of d.changes) {
      const r = readChange(c, baseSteps);
      if ('change' in r) changes.push(r.change);
      else if ('warning' in r) {
        w.change[c.key] = r.warning;
        Object.assign(w.rows, r.rows);
        Object.assign(w.steps, r.steps);
      }
    }
    const name = d.name.trim();
    if (!name) w.name = 'nameMissing';
    if (changes.length === 0 && d.unreadable.length === 0 && Object.keys(w.change).length === 0) w.changes = 'noChanges';
    if (!w.name && !w.changes && Object.keys(w.change).length === 0) {
      const room = Math.max(0, MAX_VARIANT_CHANGES - d.unreadable.length);
      const parsed = VariantInput.safeParse({ position, name: name.slice(0, 40).trim(), kind: d.kind, changes: changes.slice(0, room) });
      if (parsed.success && changes.length <= room) {
        rows.push({ id: d.id, name: parsed.data.name, kind: parsed.data.kind, changes: [...parsed.data.changes, ...d.unreadable] });
        return;
      }
      // The fields' own limits keep within the schema; this is the last word.
      if (!parsed.success && parsed.error.issues.some((i) => i.path[0] === 'name')) w.name = 'nameMissing';
      else w.changes = 'noChanges';
    }
    warnings[d.key] = w;
  });
  return Object.keys(warnings).length > 0 ? { warnings } : { rows };
}

/** `variant_created` for each saved variant that wasn't in the recipe before (no text is sent). */
export function createdVariantEvents(rows: VariantSaveRow[], startIds: ReadonlySet<string>): EventProps<'variant_created'>[] {
  return rows.filter((r) => !startIds.has(r.id)).map((r) => ({ change_count: Math.min(MAX_VARIANT_CHANGES, r.changes.length) }));
}

/** The recipe's whole variant list in one call: order is position, variants left out are removed. */
export async function saveVariants(client: Pick<Client, 'rpc'>, recipeId: string, rows: VariantSaveRow[]): Promise<boolean> {
  try {
    const { error } = await client.rpc('save_recipe_variants', { p_recipe_id: recipeId, p_variants: rows });
    return !error;
  } catch {
    return false;
  }
}

// ——— Warnings while editing (edge cases) ———

/** For each variant key, its changes (by key) that clash with another variant, with that variant's names. */
export function draftConflicts(drafts: VariantDraft[], baseSteps: readonly StepDraft[]): Record<string, Record<string, string[]>> {
  const kept = drafts.map((d) =>
    d.changes.flatMap((c) => {
      const change = previewChange(c, baseSteps);
      return change ? [{ key: c.key, change }] : [];
    }),
  );
  const found = variantConflicts(drafts.map((d, i) => ({ id: d.key, name: d.name.trim(), kind: d.kind, changes: (kept[i] ?? []).map((k) => k.change) })));
  return Object.fromEntries(
    drafts.map((d, i) => {
      const keys = (kept[i] ?? []).map((k) => k.key);
      const byIndex = Object.entries(found[d.key] ?? {});
      return [d.key, Object.fromEntries(byIndex.map(([index, names]) => [keys[Number(index)] ?? '', names]))];
    }),
  );
}

/** The change keys of a variant that point at an ingredient or step the form no longer has (032-later L29). */
export function draftBroken(d: VariantDraft, base: { ingredients: readonly { id: string }[]; steps: readonly { id: string }[] }, baseSteps: readonly StepDraft[]): Set<string> {
  const kept = d.changes.flatMap((c) => {
    const change = previewChange(c, baseSteps);
    return change ? [{ key: c.key, change }] : [];
  });
  return new Set(brokenChanges(base, kept.map((k) => k.change)).map((i) => kept[i]?.key ?? ''));
}

// ——— Plain words (FR-005, OC-RecipeSettings › Layout 6) ———

/** What summaries know about the base recipe. */
export interface SummaryBase {
  ingredients: readonly { id: string; name: string }[];
  steps: readonly { id: string; name?: string | null; body: string }[];
  /** Ingredient names by id, base and variant, for step text with chips. */
  names: ReadonlyMap<string, string>;
  facts: (catalogKey: string) => IngredientFactsInput | null | undefined;
}

const upperFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** "Flour" → "flour", but "IPA" stays. */
const lowerFirst = (s: string) => (/^.[A-Z]/u.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1));

/** "200 g flour", "250 g sliced mushrooms", "salt": amounts from the quantity engine (constitution V). */
export function amountName(row: IngredientRow, base: Pick<SummaryBase, 'facts'>): string {
  try {
    const line = ingredientLine({ ...row, fromVariant: true, facts: row.catalog_key ? (base.facts(row.catalog_key) ?? null) : null }, defaultFormat);
    return [line.amount, row.prep_note, lowerFirst(line.fullName)].filter(Boolean).join(' ');
  } catch {
    return lowerFirst(row.name);
  }
}

/** A step's title: its name, or the first line of its text with chips as names. */
function stepTitle(step: { name?: string | null; body: string }, names: ReadonlyMap<string, string>): string {
  return step.name?.trim() || shownText(segmentsOf(step.body, names)).split('\n')[0]?.trim() || '';
}

const stepNumber = (base: SummaryBase, id: string) => base.steps.findIndex((s) => s.id === id) + 1;

/** The change's tag in the editor: honey for what replaces or removes, sage for what adds. */
export function changeTag(change: VariantChange, base: SummaryBase): { label: string; tone: 'honey' | 'sage' } {
  switch (change.type) {
    case 'swap_ingredient':
    case 'remove_ingredient':
      return { label: v.tag[change.type], tone: 'honey' };
    case 'add_ingredient':
      return { label: v.tag.add_ingredient, tone: 'sage' };
    default: {
      const n = stepNumber(base, change.step_id);
      if (n === 0) return { label: v.tag.stepGone, tone: change.type === 'add_step' ? 'sage' : 'honey' };
      if (change.type === 'add_step') return { label: v.tag.add_step(change.place, n), tone: 'sage' };
      return { label: v.tag[change.type](n), tone: 'honey' };
    }
  }
}

/** The block's summary: "~~Shortcrust pastry~~ → 200 g flour, 100 g cold butter, 50 ml ice water" (FR-005). */
export function changeSummary(change: VariantChange, base: SummaryBase): { struck: string | null; text: string } {
  const ingredientName = (id: string) => base.ingredients.find((i) => i.id === id)?.name ?? null;
  const step = (id: string) => base.steps.find((s) => s.id === id);
  switch (change.type) {
    case 'swap_ingredient':
      return { struck: ingredientName(change.ingredient_id), text: change.with.map((r) => amountName(r, base)).join(', ') };
    case 'add_ingredient':
      return { struck: null, text: amountName(change.ingredient, base) };
    case 'remove_ingredient':
      return { struck: ingredientName(change.ingredient_id), text: '' };
    case 'remove_step': {
      const s = step(change.step_id);
      return { struck: s ? stepTitle(s, base.names) || v.unnamedStep(stepNumber(base, change.step_id)) : null, text: '' };
    }
    case 'add_step': {
      const title = stepTitle(change.step, base.names);
      const minutes = change.step.timer_seconds ? Math.max(1, Math.round(change.step.timer_seconds / 60)) : null;
      return { struck: null, text: [title, minutes ? v.timer(formatTotalTime(minutes)) : null].filter(Boolean).join(' · ') };
    }
    case 'change_step': {
      const parts: string[] = [];
      if (change.body !== undefined) parts.push(v.newText(shownText(segmentsOf(change.body, base.names)).split('\n')[0]?.trim() ?? ''));
      if (change.timer_seconds !== undefined)
        parts.push(change.timer_seconds === null ? v.noTimer : v.timer(formatTotalTime(Math.max(1, Math.round(change.timer_seconds / 60)))));
      if (change.temp_check_c !== undefined || change.temp_check_text !== undefined) {
        const text = renderTemperatureCheck(change.temp_check_text ?? null, change.temp_check_c ?? null, defaultFormat.system);
        parts.push(change.temp_check_c === null && !text ? v.noTempCheck : v.tempCheck(text ?? ''));
      }
      return { struck: null, text: parts.length ? parts.join(' · ') : v.nothingYet };
    }
  }
}

/**
 * A variant's one line on the recipe settings screen: "Replaces bacon lardons with 250 g sliced
 * mushrooms", "Replaces shortcrust pastry with 3 ingredients · adds step “Make the dough”".
 * Changes pointing at something removed are left out, as on the recipe page.
 */
export function variantSummary(changes: readonly VariantChange[], base: SummaryBase): string {
  const broken = new Set(brokenChanges(base, changes));
  const name = (id: string) => lowerFirst(base.ingredients.find((i) => i.id === id)?.name ?? '');
  const parts = changes.flatMap((c, i): string[] => {
    if (broken.has(i)) return [];
    switch (c.type) {
      case 'swap_ingredient':
        return [sum.replaces(name(c.ingredient_id), c.with.length === 1 && c.with[0] ? amountName(c.with[0], base) : sum.ingredients(c.with.length))];
      case 'add_ingredient':
        return [sum.adds(amountName(c.ingredient, base))];
      case 'remove_ingredient':
        return [sum.removes(name(c.ingredient_id))];
      case 'add_step':
        return [sum.addsStep(stepTitle(c.step, base.names))];
      case 'change_step':
        return [sum.changesStep(stepNumber(base, c.step_id))];
      case 'remove_step':
        return [sum.removesStep(stepNumber(base, c.step_id))];
    }
  });
  return parts.length ? upperFirst(parts.join(sum.join)) : sum.nothing;
}
