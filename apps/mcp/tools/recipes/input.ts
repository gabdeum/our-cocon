import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { matchIngredients, type MatchedFacts } from '@cocon/data';
import { parseIngredientLine, pieceNouns, scalingAmountIn, tokenizeIngredients, tokenizeTemperatures, type MentionTarget } from '@cocon/quantity';
import {
  IngredientInput,
  MAX_STEPS,
  MAX_VARIANT_CHANGES,
  MAX_VARIANTS,
  SizeWord,
  StepInput,
  Unit,
  ingredientName,
  VariantChange,
  VariantKind,
  normalizeText,
  type IngredientRow,
} from '@cocon/schemas';
import { ToolError, type ToolContext } from '../../src/tools.js';

/**
 * What assistants send for ingredients and steps, and how it becomes the rows the app saves
 * (032-later L32, L33): lines read by the app's paste parser, names matched against the catalog
 * (spec 031), rows checked with IngredientInput and StepInput, steps tokenized like the app's.
 */

const UNITS = Unit.options.join(', ');

/** An ingredient row's fields; a variant's new ingredients have no id to keep. */
const ingredientRow = {
  name: z.string().max(80).describe('The raw ingredient, no amount: "Onion". A bracket for a second row ("Onion (sauce)"), details after a comma ("Onion, sliced").'),
  quantity: z.number().positive().lt(100000).optional().describe('A number (1.5). Leave out for "to taste".'),
  unit: z.string().max(20).optional().describe(`One of: ${UNITS}. "piece" for counted things.`),
  size: SizeWord.optional().describe('small, medium or large, for counted things.'),
  prep_note: z.string().max(80).optional().describe('The same as text after a comma in the name.'),
};
const IngredientLine = z.string().min(1).max(200).describe('A line as in a recipe: "2 leeks, sliced".');
const Id = (what: string) => z.uuid().optional().describe(`Its id from get_recipe, to keep the ${what}. Leave out for a new one.`);

export const IngredientIn = z.union([IngredientLine, z.strictObject({ id: Id('ingredient'), ...ingredientRow })]);
/** A new ingredient in a variant. */
const VariantIngredientIn = z.union([IngredientLine, z.strictObject(ingredientRow)]);
export type IngredientIn = z.infer<typeof IngredientIn>;

export const ThermometerCheck = z
  .strictObject({
    celsius: z.number().min(-50).max(400).describe('°C, e.g. 63.'),
    text: z.string().max(120).optional().describe('"The thickest part should read {temp}". Without {temp}, the reading goes at the end.'),
  })
  .describe('The food thermometer reading when done. Never the oven.');

/** A step's fields. null removes one from a kept step (update_recipe keeps what's left out). */
const stepRow = {
  name: z.string().max(60).nullable().optional().describe('A short title: "Make the sauce".'),
  text: z.string().max(2000),
  timer_minutes: z.number().positive().max(1440).nullable().optional().describe('Only for a set wait (Step add-ons).'),
  timer_label: z.string().max(40).nullable().optional().describe('What it times: "Roast".'),
  tip: z.string().max(200).nullable().optional().describe('A chef’s tip (Step add-ons).'),
  thermometer_check: ThermometerCheck.nullable().optional(),
};
const StepLine = z.string().min(1).max(2000).describe('The step as plain text.');

export const StepIn = z.union([StepLine, z.strictObject({ id: Id('step'), ...stepRow })]);
/** A new step in a variant. */
const VariantStepIn = z.union([StepLine, z.strictObject(stepRow)]);
export type StepIn = z.infer<typeof StepIn>;

/** How ingredients are written, for tool descriptions. */
export const INGREDIENT_WRITING = [
  'Ingredients: a written line each ("2 leeks, sliced", "salt to taste") or a row.',
  '- Order: most important first, as the app lists them: what the dish is built on (meat, fish, main vegetables, pasta, rice), then what gives it character (cream, cheese, stock, spices), then salt, pepper and oil, then garnishes.',
  '- Name: the raw ingredient, one per row ("Onion", "Chicken thighs", "Double cream"). No brand, no cut or preparation, and no variety unless the recipe needs it ("Arborio rice" in a risotto). Names are matched to Our Cocon’s catalog for unit conversion and the grocery list, so a product sold as its own thing keeps its name ("Tinned tomatoes", "Frozen peas").',
  '- After a comma: any other detail, how it’s cut, prepared or bought ("Onion, finely chopped", "Butter, softened", "Chicken thighs, skin on"). It shows after the amount in the steps.',
  '- Brackets: when one ingredient is used in several places, one row per use with its own amount ("Onion (sauce)", "Onion (topping)"). The ingredient and grocery lists add them up.',
  '- No amount in a name or after the comma: use quantity and unit, so it scales.',
].join('\n');

/** How steps are written, for tool descriptions (spec 023 FR-004, 032-later L16). */
export const STEP_WRITING = [
  'Steps: text naming the ingredients ("Soften the leeks in the butter", or {ing:Leeks} as for_editing writes them). The app links each ingredient’s first mention and writes its amount in: don’t repeat amounts.',
  '- An ingredient is linked in one step only; later mentions ("season with more salt") stay plain text. Name a bracketed row in full: {ing:Onion (sauce)}.',
  '- No amount that should scale in step text, titles or tips ("about 20 g of oil"): put it on the ingredient. Fine: sizes ("75 g balls", "a 23 cm tin"), amounts for one ("2 tbsp per serving"), ratios ("60% hydration") and times. The reply’s warnings list each amount found: check them.',
  '- Oven temperatures go in the text ("180 °C" or "350 °F"); the app shows both.',
].join('\n');

/** What a step's add-ons are for in the app, for tool descriptions (spec 016 FR-003). */
export const ADD_ON_WRITING = [
  'Step add-ons: a timer, a temperature check, a chef’s tip. Each has one job: go through the steps one by one and add one only when you can say why. Most steps have none.',
  '- Timer (timer_minutes, timer_label): a countdown button on the step, in cooking mode too, so the cook can walk away. For a set wait they could overrun: baking, roasting, simmering, resting, proving, chilling, marinating. Not for short hands-on actions ("fry for 2 minutes"), "until golden" or the total time. For a range, the shorter end. Never added for you.',
  '- Temperature check (thermometer_check): what a food thermometer reads when it’s done ("The thickest part should read {temp}", 63 °C for salmon), for meat, fish, custard, bread, sugar, frying oil. Never the oven. Hidden for members without a thermometer, so the text still gives a visual cue ("until the juices run clear"). A reading inside the text: {temp:115:food}.',
  '- Chef’s tip (tip): the app’s "something you wish you’d known the first time": why it matters, a common mistake, a rescue, what can be made ahead. Never something the cook must do (that’s the text) or a repeat. One to three per recipe.',
].join('\n');

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

/** Refuses an amount written into a name or note, which wouldn't scale with the servings. */
function checkNoAmount(where: string, name: string, ...texts: (string | null | undefined)[]) {
  for (const text of texts) {
    const amount = text ? scalingAmountIn(text) : null;
    if (amount)
      throw new ToolError(
        `${where} (${name}) has an amount in its name or prep note ("${amount}"), which won’t change with the servings. Put it in quantity and unit instead, and keep the name to what it is.`,
      );
  }
}

function draftOf(input: IngredientIn, n: number, keep: ReadonlySet<string>): Draft {
  const where = `Ingredient #${n}`;
  const draft = readDraft(input, where, keep);
  checkNoAmount(where, draft.name, draft.name, draft.prep_note);
  return draft;
}

function readDraft(input: IngredientIn, where: string, keep: ReadonlySet<string>): Draft {
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

/** Why a step's ingredient tokens were refused, as the sentence to fix it. */
function tokenError(where: string, failure: Exclude<ReturnType<typeof tokenizeIngredients>, { ok: true }>, targets: readonly MentionTarget[], usedIn: ReadonlyMap<string, number>): ToolError {
  switch (failure.reason) {
    case 'unknown':
      return new ToolError(`${where} mentions ${failure.token}, but that isn’t one of the recipe’s ingredients. Add it to the ingredients, or write it as plain text.`);
    case 'ambiguous':
      return new ToolError(`${where} mentions ${failure.token}, which could be ${failure.names.map((n) => `{ing:${n}}`).join(' or ')}. Use the full name.`);
    case 'repeated': {
      const name = targets.find((t) => t.id === failure.id)?.name ?? failure.token;
      const earlier = usedIn.get(failure.id);
      const short = ingredientName(name);
      return new ToolError(
        `${where} mentions ${name}, which ${earlier ? `step ${earlier}` : 'this step'} already uses. Each ingredient goes in one step, with its whole amount. If it’s used twice, add one row per use with its own amount, like "${short} (sauce)" and "${short} (topping)", and name each in its step; otherwise write later mentions as plain text.`,
      );
    }
  }
}

/**
 * An amount written into a step (its text, title or tip) may need to scale with the servings, or
 * may be a size ("75 g balls"): the step saves either way, and the reply says to check it.
 */
export function stepAmountWarning(where: string, body: string, ...more: (string | null | undefined)[]): string | null {
  for (const text of [body.replace(/\{[^{}]*\}/g, ' '), ...more.map((t) => t ?? '')]) {
    const amount = scalingAmountIn(text);
    if (amount)
      return `${where} mentions "${amount}", which stays the same when the servings change. If it should scale, put it on the ingredient (a row of its own if it’s a separate part, like "Onion (topping)") and name the ingredient in the step. If it’s a size or an amount for one of something ("75 g balls"), leave it.`;
  }
  return null;
}

/**
 * One step as the app saves it: names and temperatures tokenized, a timer from its text. `usedIn`
 * are the ingredients earlier steps mention, by step number: each ingredient goes in one step.
 */
export function stepFields(input: StepIn, where: string, targets: readonly MentionTarget[], usedIn: ReadonlyMap<string, number> = new Map()) {
  const s: Partial<Exclude<StepIn, string>> & { text: string } = typeof input === 'string' ? { text: input } : input;
  const tokens = tokenizeIngredients(s.text.trim(), targets, new Set(usedIn.keys()));
  if (!tokens.ok) throw tokenError(where, tokens, targets, usedIn);
  const warning = stepAmountWarning(where, tokens.body, s.tip, s.name);
  const timer = s.timer_minutes != null ? Math.round(s.timer_minutes * 60) : null;
  return {
    /** The ingredients it mentions, for the next steps (not saved). */
    mentions: tokens.ids,
    /** An amount to check, for the reply (not saved). */
    warning,
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

/** Which step (by number) mentions each ingredient, for a change to one step: the others' mentions. */
export function mentionsIn(steps: readonly { body: string }[], except?: number): Map<string, number> {
  const out = new Map<string, number>();
  steps.forEach((st, i) => {
    if (i === except) return;
    for (const m of st.body.matchAll(/\{ing:([^{}\s:]+)\}/g)) if (m[1] && !out.has(m[1])) out.set(m[1], i + 1);
  });
  return out;
}

export type StepOut = Omit<ReturnType<typeof stepFields>, 'mentions' | 'warning'> & { id: string; photo_path?: string | null };

/**
 * The assistant's steps as rows; `keep` are ids they may keep (the recipe's own). Each ingredient
 * goes in one step. Amounts to check go into `warnings`.
 */
export function stepRows(inputs: readonly StepIn[], targets: readonly MentionTarget[], keep: ReadonlySet<string> = new Set(), warnings: string[] = []): StepOut[] {
  if (inputs.length > MAX_STEPS) throw new ToolError(`A recipe can have at most ${MAX_STEPS} steps. Combine some.`);
  const usedIn = new Map<string, number>();
  return inputs.map((input, i) => {
    const where = `Step ${i + 1}`;
    const id = typeof input === 'object' && input.id ? input.id : randomUUID();
    if (typeof input === 'object' && input.id && !keep.has(input.id)) throw new ToolError(`${where} has an id that isn't one of this recipe's steps. Leave the id out for a new step.`);
    const { mentions, warning, ...fields } = stepFields(input, where, targets, usedIn);
    for (const m of mentions) usedIn.set(m, i + 1);
    if (warning) warnings.push(warning);
    return { id, ...checkStep(fields, where, i) };
  });
}


// ——— Variants, as part of the recipe (spec 017; 032-later L11) ———

/** An ingredient of the recipe, by its name (or id). */
const IngredientRef = z.string().min(1).max(80).describe('The recipe ingredient’s name, as in its ingredient list.');
/** A step of the recipe, by its number. */
const StepRef = z.int().min(1).max(MAX_STEPS).describe('The step’s number in for_editing.');

export const ChangeIn = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('swap_ingredient'), ingredient: IngredientRef, with: z.array(VariantIngredientIn).min(1).max(10).describe('What it becomes.') }),
  z.strictObject({
    type: z.literal('add_ingredient'),
    ingredient: VariantIngredientIn,
    next_to: IngredientRef.optional().describe('The recipe ingredient it goes next to, by importance. Left out, at the end.'),
    place: z.enum(['before', 'after']).optional().describe('Before or after next_to (default after).'),
  }),
  z.strictObject({ type: z.literal('remove_ingredient'), ingredient: IngredientRef }),
  z.strictObject({ type: z.literal('add_step'), step: StepRef.describe('The step it goes next to.'), place: z.enum(['before', 'after']), new_step: VariantStepIn }),
  z.strictObject({
    type: z.literal('change_step'),
    step: StepRef.describe('The step’s number. A variant changes its text, timer or temperature check, not its title or tip.'),
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
export const VARIANT_WRITING = [
  'Variants: a few changes to ingredients or steps, picked with one tap on the recipe page. A version is one at a time ("Vegetarian"); an option is on or off on top ("Extra cheese").',
  '- Save the ones the member gave ("or use chicken", an optional extra, a diet swap). Name ingredients as in the list, and steps by their number in for_editing.',
  '- An ingredient a variant adds goes by importance too: next_to says where (a swap keeps its place).',
  '- Swapping one ingredient for one other updates the steps that name it. Swapping it for several, or removing it, doesn’t: change those steps too (change_step); the reply’s warnings name them.',
  '- Don’t add variants unasked. After saving, suggest ones that suit the recipe, and add them if the member agrees.',
].join('\n');

/**
 * Steps that still name an ingredient a variant removes or swaps for several: only a swap for one
 * follows into the steps (applyVariants), so those steps would lose the name and amount.
 */
function namesLeftBehind(label: string, changes: readonly VariantChange[], base: { ingredients: readonly MentionTarget[]; steps: readonly { id: string; body: string }[] }): string[] {
  const gone = changes.flatMap((c) => (c.type === 'remove_ingredient' || (c.type === 'swap_ingredient' && c.with.length > 1) ? [c.ingredient_id] : []));
  const handled = new Set(changes.flatMap((c) => (c.type === 'remove_step' || (c.type === 'change_step' && c.body !== undefined) ? [c.step_id] : [])));
  return base.steps.flatMap((st, i) => {
    if (handled.has(st.id)) return [];
    return gone
      .filter((id) => st.body.includes(`{ing:${id}}`))
      .map((id) => `${label}: step ${i + 1} names ${base.ingredients.find((t) => t.id === id)?.name ?? 'an ingredient'}, which this variant takes out, so the step would lose it. Rewrite that step in the variant (change_step).`);
  });
}

/** The recipe ingredient a change names: by id, or by name (singular or plural, any case or accents). */
function findIngredient(ref: string, rows: readonly MentionTarget[]): MentionTarget | undefined {
  const want = normalizeText(ref.trim());
  const forms = (r: MentionTarget) => {
    const name = normalizeText(r.name);
    return [name, `${name}s`, `${name}es`, name.replace(/e?s$/, ''), r.plural ? normalizeText(r.plural) : ''];
  };
  const exact = rows.find((r) => r.id === ref) ?? rows.find((r) => forms(r).includes(want));
  if (exact) return exact;
  // The name cooks read ("onion" for "Onion, cooked"), when only one row has it.
  const short = rows.filter((r) => forms({ ...r, name: ingredientName(r.name) }).includes(want));
  return short.length === 1 ? short[0] : undefined;
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
  base: { ingredients: readonly MentionTarget[]; steps: readonly { id: string; body: string }[] },
  existing: readonly { id: string; name: string }[] = [],
  /** Amounts in the variants' steps to check, for the reply. */
  warnings: string[] = [],
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
        const id = base.steps[number - 1]?.id;
        if (!id) throw new ToolError(`${where} names step ${number}, but the recipe has ${base.steps.length} steps.`);
        return id;
      };
      let out: unknown;
      switch (c.type) {
        case 'swap_ingredient':
          out = { type: c.type, ingredient_id: ingredientId(c.ingredient), with: bare(brought.get(n)) };
          break;
        case 'add_ingredient':
          out = { type: c.type, ingredient: bare(brought.get(n))[0], ...(c.next_to ? { next_to_id: ingredientId(c.next_to), place: c.place ?? 'after' } : {}) };
          break;
        case 'remove_ingredient':
          out = { type: c.type, ingredient_id: ingredientId(c.ingredient) };
          break;
        case 'add_step': {
          const { mentions: _m, warning, ...fields } = stepFields(c.new_step, where, targets);
          if (warning) warnings.push(warning);
          const { name, body, timer_seconds, timer_label, temp_check_c, temp_check_text, tip } = checkStep(fields, where, 0);
          out = { type: c.type, step_id: stepId(c.step), place: c.place, step: { name, body, timer_seconds, timer_label, temp_check_c, temp_check_text, tip } };
          break;
        }
        case 'change_step': {
          const changed = c.text !== undefined ? stepFields({ text: c.text }, where, targets) : null;
          if (changed?.warning) warnings.push(changed.warning);
          out = {
            type: c.type,
            step_id: stepId(c.step),
            ...(changed ? { body: changed.body } : {}),
            ...(c.timer_minutes !== undefined ? { timer_seconds: c.timer_minutes === null ? null : Math.round(c.timer_minutes * 60) } : {}),
            ...(c.timer_label !== undefined ? { timer_label: c.timer_label?.trim() || null } : {}),
            ...(c.thermometer_check !== undefined
              ? { temp_check_c: c.thermometer_check?.celsius ?? null, temp_check_text: c.thermometer_check?.text?.trim() || null }
              : {}),
          };
          break;
        }
        case 'remove_step':
          out = { type: c.type, step_id: stepId(c.step) };
          break;
      }
      const parsed = VariantChange.safeParse(out);
      if (!parsed.success) throw new ToolError(`${where}: ${(parsed.error.issues[0]?.message ?? 'isn’t valid').replace(/\.$/, '')}. Fix it and try again.`);
      return parsed.data;
    });
    warnings.push(...namesLeftBehind(label, changes, base));
    const kept = existing.find((e) => normalizeText(e.name) === key);
    rows.push({ id: kept?.id ?? randomUUID(), name: v.name.trim(), kind: v.kind, changes });
  }
  return rows;
}
