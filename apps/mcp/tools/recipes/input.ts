import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { matchIngredients, type MatchedFacts } from '@cocon/data';
import { parseIngredientLine, pieceNouns, tokenizeIngredients, tokenizeTemperatures, type MentionTarget } from '@cocon/quantity';
import {
  IngredientInput,
  MAX_STEPS,
  MAX_VARIANT_CHANGES,
  MAX_VARIANTS,
  SizeWord,
  StepInput,
  Unit,
  VariantChange,
  VariantKind,
  normalizeText,
  stepTimerFrom,
  type IngredientRow,
} from '@cocon/schemas';
import { ToolError, type ToolContext } from '../../src/tools.js';

/**
 * What assistants send for ingredients and steps, and how it becomes the rows the app saves
 * (032-later L32, L33): lines read by the app's paste parser, names matched against the catalog
 * (spec 031), rows checked with IngredientInput and StepInput, steps tokenized like the app's.
 */

const UNITS = Unit.options.join(', ');

export const IngredientIn = z.union([
  z.string().min(1).max(200).describe('One line as written in a recipe: "2 leeks, sliced", "200 ml double cream", "salt to taste".'),
  z.strictObject({
    id: z.uuid().optional().describe('Keep this ingredient (its id from get_recipe) when changing a recipe; leave out for a new one.'),
    name: z.string().max(80).describe('What it is, without the amount: "Leeks", "Double cream".'),
    quantity: z.number().positive().lt(100000).optional().describe('How much, as a number (1.5, not "1½"). Leave out for "to taste".'),
    unit: z.string().max(20).optional().describe(`One of: ${UNITS}. "piece" for things you count (2 eggs). Leave out with no quantity.`),
    size: SizeWord.optional().describe('For counted things only: small, medium or large ("1 large onion").'),
    prep_note: z.string().max(80).optional().describe('How it’s prepared: "sliced", "at room temperature".'),
  }),
]);
export type IngredientIn = z.infer<typeof IngredientIn>;

export const ThermometerCheck = z.strictObject({
  celsius: z.number().min(-50).max(400).describe('The reading to check for, in °C (e.g. 63 for chicken).'),
  text: z
    .string()
    .max(120)
    .optional()
    .describe('What to check, e.g. "The thickest part should read {temp}". {temp} is where the reading goes; leave it out to add the reading at the end.'),
});

export const StepIn = z.union([
  z.string().min(1).max(2000).describe('The step as plain text.'),
  z.strictObject({
    id: z.uuid().optional().describe('Keep this step (its id from get_recipe) when changing a recipe; leave out for a new one.'),
    name: z.string().max(60).optional().describe('A short title: "Make the sauce".'),
    text: z.string().max(2000).describe('The step as plain text.'),
    timer_minutes: z.number().positive().max(1440).optional().describe('A timer for this step. Left out, a single duration in the text becomes the timer.'),
    timer_label: z.string().max(40).optional().describe('What the timer is for: "Bake".'),
    tip: z.string().max(200).optional().describe('A short tip shown under the step.'),
    thermometer_check: ThermometerCheck.optional(),
  }),
]);
export type StepIn = z.infer<typeof StepIn>;

/** How steps are written, for tool descriptions (spec 023 FR-004, 032-later L16). */
export const STEP_WRITING = [
  'Write steps as plain text naming the ingredients ("Soften the leeks in the butter"): Our Cocon links each ingredient’s first mention and writes its amount in, so don’t repeat amounts.',
  'Write oven temperatures as you like ("180 °C", "350 °F"); they’re shown in both scales. For a thermometer reading in the text, write {temp:<°C>:food}, e.g. {temp:63:food}; or use thermometer_check.',
  'A single duration in a step ("bake for 25 minutes") becomes its timer unless you send timer_minutes.',
].join(' ');

/** Units the way people write them ("grams", "tablespoons") as the app's, else the sentence to fix it. */
export function unitOf(raw: string): z.infer<typeof Unit> {
  const t = raw.trim().toLowerCase().replace(/\.$/, '');
  const direct = Unit.safeParse(t);
  if (direct.success) return direct.data;
  const parsed = parseIngredientLine(`2 ${t} flour`);
  if (parsed?.unit && parsed.name.toLowerCase() === 'flour') return parsed.unit;
  throw new ToolError(`Unknown unit '${raw}'. Use ${UNITS}.`);
}

/** A row on its way in: what the assistant said, before the catalog is asked. */
interface Draft {
  id: string;
  /** "piece" because a count was written with no unit ("2 eggs"), not said outright. */
  countedOnly: boolean;
  name: string;
  quantity: number | null;
  unit: z.infer<typeof Unit> | null;
  size_word: z.infer<typeof SizeWord> | null;
  nouns: { singular: string; plural: string } | null;
  prep_note: string | null;
}

/** "Leeks, sliced" → name and prep note, as the app keeps them apart. */
function splitPrep(name: string): { name: string; prep: string | null } {
  const at = name.indexOf(', ');
  return at > 0 ? { name: name.slice(0, at).trim(), prep: name.slice(at + 2).trim() || null } : { name: name.trim(), prep: null };
}

function draftOf(input: IngredientIn, n: number, keep: ReadonlySet<string>): Draft {
  const where = `Ingredient #${n}`;
  if (typeof input === 'string') {
    const parsed = parseIngredientLine(input);
    if (!parsed) throw new ToolError(`${where} is empty. Write it like "2 leeks" or "salt to taste".`);
    const { name, prep } = splitPrep(parsed.name);
    const countedOnly = parsed.unit === 'piece' && !parsed.piece_noun && !parsed.size_word;
    return { id: randomUUID(), countedOnly, name, quantity: parsed.quantity, unit: parsed.unit, size_word: parsed.size_word, nouns: parsed.piece_noun, prep_note: prep };
  }
  if (input.id && !keep.has(input.id)) throw new ToolError(`${where} has an id that isn't one of this recipe's ingredients. Leave the id out for a new ingredient.`);
  // FR-006: an amount needs its unit; only a size says "counted" by itself ("1 large onion").
  if (input.quantity != null && !input.unit && !input.size)
    throw new ToolError(`${where} (${input.name}) has an amount but no unit. Ask the member for it, or use "piece" for things you count (2 eggs).`);
  const unit = input.unit ? unitOf(input.unit) : input.size ? 'piece' : null;
  if (unit && input.quantity == null) throw new ToolError(`${where} (${input.name}) has a unit but no amount. Add the amount, or leave both out ("salt to taste").`);
  if (input.size && unit !== 'piece') throw new ToolError(`${where} (${input.name}): a size (small, medium, large) only goes with counted things. Use the unit "piece" or leave the size out.`);
  return {
    id: input.id ?? randomUUID(),
    countedOnly: false,
    name: input.name.trim(),
    quantity: input.quantity ?? null,
    unit,
    size_word: input.size ?? null,
    nouns: null,
    prep_note: input.prep_note?.trim() || null,
  };
}

/** A saved ingredient row (no position: order is position), and what steps call it. */
export type IngredientOut = IngredientRow & { plural: string | null };

/**
 * The assistant's ingredients as rows: each matched against the catalog (so amounts get their
 * weights), checked like the form's. `keep` are ids the rows may keep (the recipe's own).
 */
export async function ingredientRows(ctx: Pick<ToolContext, 'db'>, inputs: readonly IngredientIn[], keep: ReadonlySet<string> = new Set()): Promise<IngredientOut[]> {
  const drafts = inputs.map((input, i) => draftOf(input, i + 1, keep));
  const seen = new Set<string>();
  for (const d of drafts) {
    if (seen.has(d.id)) throw new ToolError(`The ingredient with id ${d.id} is listed twice. Keep it once.`);
    seen.add(d.id);
  }
  const matched = (await matchIngredients(ctx.db, drafts.map((d) => d.name))) ?? drafts.map(() => null);
  return drafts.map((d, i) => {
    const facts: MatchedFacts | null = matched[i] ?? null;
    // "2 flour": counted, but the catalog knows flour isn't something you count. Ask, don't guess.
    const countable = facts && (facts.size_small_g != null || facts.size_medium_g != null || facts.size_large_g != null || facts.noun_singular);
    if (d.countedOnly && facts && !countable)
      throw new ToolError(`Ingredient #${i + 1} (${d.name}): ${d.quantity} of what? Ask the member for the unit (${UNITS}) and send the line again.`);
    const piece = d.unit === 'piece';
    const nouns = piece ? (d.nouns ?? (facts?.noun_singular && facts.noun_plural ? { singular: facts.noun_singular, plural: facts.noun_plural } : pieceNouns(d.name))) : null;
    const row = {
      name: d.name.slice(0, 80).trim(),
      catalog_key: facts?.catalog_key ?? null,
      quantity: d.quantity,
      unit: d.unit,
      size_word: piece ? d.size_word : null,
      weight_per_piece_g: null,
      piece_noun_singular: nouns?.singular.slice(0, 40) ?? null,
      piece_noun_plural: nouns?.plural.slice(0, 40) ?? null,
      prep_note: d.prep_note?.slice(0, 80) ?? null,
    };
    const parsed = IngredientInput.safeParse({ ...row, position: i });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const what = issue?.path[0] === 'name' ? 'needs a name' : (issue?.message ?? 'isn’t valid');
      throw new ToolError(`Ingredient #${i + 1}${d.name ? ` (${d.name})` : ''} ${what.replace(/\.$/, '')}. Fix it and try again.`);
    }
    const { position: _position, ...valid } = parsed.data;
    return { ...valid, id: d.id, plural: facts?.plural ?? null };
  });
}

/** What steps can name: the recipe's ingredients with their plurals. */
export const mentionTargets = (rows: readonly (Pick<IngredientRow, 'id' | 'name'> & { plural?: string | null })[]): MentionTarget[] =>
  rows.map((r) => ({ id: r.id, name: r.name, plural: r.plural ?? null }));

/** One step as the app saves it: names and temperatures tokenized, a timer from its text. */
export function stepFields(input: StepIn, where: string, targets: readonly MentionTarget[]) {
  const s: Partial<Exclude<StepIn, string>> & { text: string } = typeof input === 'string' ? { text: input } : input;
  const tokens = tokenizeIngredients(s.text.trim(), targets);
  if (!tokens.ok) throw new ToolError(`${where} mentions ${tokens.unknown}, but that isn’t one of the recipe’s ingredients. Add it to the ingredients, or write it as plain text.`);
  const timer = s.timer_minutes !== undefined ? Math.round(s.timer_minutes * 60) : stepTimerFrom(s.text);
  return {
    name: s.name?.trim() || null,
    body: tokenizeTemperatures(tokens.body),
    timer_seconds: timer,
    timer_label: timer ? s.timer_label?.trim() || null : null,
    temp_check_c: s.thermometer_check?.celsius ?? null,
    temp_check_text: s.thermometer_check?.text?.trim() || null,
    tip: s.tip?.trim() || null,
  };
}

/** Checks a step like the form does, or says what to fix. */
export function checkStep<T extends Record<string, unknown>>(fields: T, where: string, position: number): T {
  const { id: _id, ...step } = fields;
  const parsed = StepInput.safeParse({ ...step, position, photo_path: fields.photo_path ?? null });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new ToolError(`${where}${issue?.path.length ? ` (${issue.path.join('.')})` : ''}: ${(issue?.message ?? 'isn’t valid').replace(/\.$/, '')}. Fix it and try again.`);
  }
  return fields;
}

export type StepOut = ReturnType<typeof stepFields> & { id: string; photo_path?: string | null };

/** The assistant's steps as rows; `keep` are ids they may keep (the recipe's own). */
export function stepRows(inputs: readonly StepIn[], targets: readonly MentionTarget[], keep: ReadonlySet<string> = new Set()): StepOut[] {
  if (inputs.length > MAX_STEPS) throw new ToolError(`A recipe can have at most ${MAX_STEPS} steps. Combine some.`);
  return inputs.map((input, i) => {
    const where = `Step ${i + 1}`;
    const id = typeof input === 'object' && input.id ? input.id : randomUUID();
    if (typeof input === 'object' && input.id && !keep.has(input.id)) throw new ToolError(`${where} has an id that isn't one of this recipe's steps. Leave the id out for a new step.`);
    return { id, ...checkStep(stepFields(input, where, targets), where, i) };
  });
}


// ——— Variants, as part of the recipe (spec 017; 032-later L11) ———

/** An ingredient of the recipe, by its name (or id). */
const IngredientRef = z.string().min(1).max(80).describe('The recipe ingredient’s name, as in its ingredient list.');
/** A step of the recipe, by its number. */
const StepRef = z.int().min(1).max(MAX_STEPS).describe('The step’s number in the recipe, without variants.');

export const ChangeIn = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('swap_ingredient'), ingredient: IngredientRef, with: z.array(IngredientIn).min(1).max(10).describe('What it becomes.') }),
  z.strictObject({ type: z.literal('add_ingredient'), ingredient: IngredientIn }),
  z.strictObject({ type: z.literal('remove_ingredient'), ingredient: IngredientRef }),
  z.strictObject({ type: z.literal('add_step'), step: StepRef.describe('The step it goes next to.'), place: z.enum(['before', 'after']), new_step: StepIn }),
  z.strictObject({
    type: z.literal('change_step'),
    step: StepRef,
    text: z.string().min(1).max(2000).optional().describe('The step’s text in this variant.'),
    timer_minutes: z.number().positive().max(1440).nullable().optional(),
    timer_label: z.string().max(40).nullable().optional(),
    thermometer_check: ThermometerCheck.nullable().optional(),
  }),
  z.strictObject({ type: z.literal('remove_step'), step: StepRef }),
]);
export type ChangeIn = z.infer<typeof ChangeIn>;

export const VariantIn = z.strictObject({
  name: z.string().min(1).max(40).describe('"Vegetarian", "Extra cheese".'),
  kind: VariantKind.describe('version: pick one at a time ("Vegetarian"); option: switch on any on top ("Extra cheese").'),
  changes: z.array(ChangeIn).min(1).max(MAX_VARIANT_CHANGES),
});
export type VariantIn = z.infer<typeof VariantIn>;

/** How variants are written, for tool descriptions. */
export const VARIANT_WRITING =
  'Variants (optional) change only ingredients and steps: name the recipe’s ingredients as in its list, and its steps by number. New ingredients and steps are written like the recipe’s own.';

/** The recipe ingredient a change names: by id, or by name (singular or plural, any case or accents). */
function findIngredient(ref: string, rows: readonly MentionTarget[]): MentionTarget | undefined {
  const want = normalizeText(ref.trim());
  const forms = (r: MentionTarget) => {
    const name = normalizeText(r.name);
    return [name, `${name}s`, `${name}es`, name.replace(/e?s$/, ''), r.plural ? normalizeText(r.plural) : ''];
  };
  return rows.find((r) => r.id === ref) ?? rows.find((r) => forms(r).includes(want));
}

export type VariantSaveRow = { id: string; name: string; kind: z.infer<typeof VariantKind>; changes: VariantChange[] };

/**
 * The recipe's variants as `save_recipe_variants` takes them: changes pointing at the recipe's
 * ingredients and steps (after this save), new ingredients matched like the recipe's own, every
 * change checked with spec 017's rules. A variant keeps its id when one by the same name exists.
 */
export async function variantRows(
  ctx: Pick<ToolContext, 'db'>,
  inputs: readonly VariantIn[],
  base: { ingredients: readonly MentionTarget[]; stepIds: readonly string[] },
  existing: readonly { id: string; name: string }[] = [],
): Promise<VariantSaveRow[]> {
  if (inputs.length > MAX_VARIANTS) throw new ToolError(`A recipe can have at most ${MAX_VARIANTS} variants.`);
  const names = new Set<string>();
  const rows: VariantSaveRow[] = [];
  for (const v of inputs) {
    const label = `Variant "${v.name.trim()}"`;
    const key = normalizeText(v.name.trim());
    if (names.has(key)) throw new ToolError(`Two variants are called "${v.name.trim()}". Give each its own name.`);
    names.add(key);

    // New ingredients first, so the variant's own steps can name them.
    const brought = new Map<number, IngredientOut[]>();
    for (const [n, c] of v.changes.entries()) {
      if (c.type === 'swap_ingredient') brought.set(n, await ingredientRows(ctx, c.with));
      if (c.type === 'add_ingredient') brought.set(n, await ingredientRows(ctx, [c.ingredient]));
    }
    const targets = [...base.ingredients, ...mentionTargets([...brought.values()].flat())];
    const bare = (list: IngredientOut[] = []) => list.map(({ plural: _p, ...r }) => r);

    const changes = v.changes.map((c, n): VariantChange => {
      const where = `${label}, change #${n + 1}`;
      const ingredientId = (ref: string) => {
        const found = findIngredient(ref, base.ingredients);
        if (!found) throw new ToolError(`${where} names "${ref}", which isn’t one of the recipe’s ingredients. Use a name from its ingredient list.`);
        return found.id;
      };
      const stepId = (number: number) => {
        const id = base.stepIds[number - 1];
        if (!id) throw new ToolError(`${where} names step ${number}, but the recipe has ${base.stepIds.length} steps.`);
        return id;
      };
      let out: unknown;
      switch (c.type) {
        case 'swap_ingredient':
          out = { type: c.type, ingredient_id: ingredientId(c.ingredient), with: bare(brought.get(n)) };
          break;
        case 'add_ingredient':
          out = { type: c.type, ingredient: bare(brought.get(n))[0] };
          break;
        case 'remove_ingredient':
          out = { type: c.type, ingredient_id: ingredientId(c.ingredient) };
          break;
        case 'add_step': {
          const { name, body, timer_seconds, timer_label, temp_check_c, temp_check_text, tip } = checkStep(stepFields(c.new_step, where, targets), where, 0);
          out = { type: c.type, step_id: stepId(c.step), place: c.place, step: { name, body, timer_seconds, timer_label, temp_check_c, temp_check_text, tip } };
          break;
        }
        case 'change_step':
          out = {
            type: c.type,
            step_id: stepId(c.step),
            ...(c.text !== undefined ? { body: stepFields({ text: c.text, timer_minutes: 1 }, where, targets).body } : {}),
            ...(c.timer_minutes !== undefined ? { timer_seconds: c.timer_minutes === null ? null : Math.round(c.timer_minutes * 60) } : {}),
            ...(c.timer_label !== undefined ? { timer_label: c.timer_label?.trim() || null } : {}),
            ...(c.thermometer_check !== undefined
              ? { temp_check_c: c.thermometer_check?.celsius ?? null, temp_check_text: c.thermometer_check?.text?.trim() || null }
              : {}),
          };
          break;
        case 'remove_step':
          out = { type: c.type, step_id: stepId(c.step) };
          break;
      }
      const parsed = VariantChange.safeParse(out);
      if (!parsed.success) throw new ToolError(`${where}: ${(parsed.error.issues[0]?.message ?? 'isn’t valid').replace(/\.$/, '')}. Fix it and try again.`);
      return parsed.data;
    });
    const kept = existing.find((e) => normalizeText(e.name) === key);
    rows.push({ id: kept?.id ?? randomUUID(), name: v.name.trim(), kind: v.kind, changes });
  }
  return rows;
}
