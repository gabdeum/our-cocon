import { fToC, formatTemperature, ingredientToken, temperatureToken, tokenizeTemperatures } from '@cocon/quantity';
import { foldText, MAX_STEPS, parseMinutes, StepInput, type EventProps } from '@cocon/schemas';
import { strings } from '../strings/en';
import { formatTotalTime } from './recipe-format';

const s = strings.recipeForm.steps;

export { MAX_STEPS };

/** A saved step as the form loads it (`loadRecipeForm`). */
export interface SavedStep {
  id: string;
  position: number;
  name: string | null;
  body: string;
  timer_seconds: number | null;
  timer_label: string | null;
  temp_check_c: number | null;
  temp_check_text: string | null;
  tip: string | null;
  photo_path: string | null;
}

/**
 * One step while it's being edited (spec 016). `body` is stored text with `{ing:…}` and `{temp:…}`
 * tokens; the add-ons keep what was typed while they're switched off, until Save drops it.
 */
export interface StepDraft {
  /** Stable while editing, for React and warnings. */
  key: string;
  /** Kept for saved steps, new for added ones. */
  id: string;
  name: string;
  body: string;
  timerOn: boolean;
  /** As typed: "8", "8 min", "1 h 30". */
  minutes: string;
  timerLabel: string;
  /** The saved timer, kept exactly while its minutes aren't edited (an assistant may set 90 s). */
  savedSeconds: number | null;
  tempOn: boolean;
  /** As typed, in `tempScale`. */
  tempValue: string;
  tempScale: 'C' | 'F';
  tempText: string;
  tipOn: boolean;
  tip: string;
  photoOn: boolean;
  photoPath: string | null;
}

let seq = 0;
const nextKey = () => `step-${(seq += 1)}`;

export function emptyStep(id: string): StepDraft {
  return {
    key: nextKey(),
    id,
    name: '',
    body: '',
    timerOn: false,
    minutes: '',
    timerLabel: '',
    savedSeconds: null,
    tempOn: false,
    tempValue: '',
    tempScale: 'C',
    tempText: '',
    tipOn: false,
    tip: '',
    photoOn: false,
    photoPath: null,
  };
}

const numberText = (n: number) => String(Math.round(n * 10) / 10);

/** The saved steps, in order, ready to edit. */
export function draftsFromSteps(rows: SavedStep[]): StepDraft[] {
  return [...rows]
    .sort((a, b) => a.position - b.position)
    .map((r) => ({
      ...emptyStep(r.id),
      name: r.name ?? '',
      body: r.body,
      timerOn: r.timer_seconds != null,
      minutes: r.timer_seconds != null ? formatTotalTime(Math.max(1, Math.round(r.timer_seconds / 60))) : '',
      timerLabel: r.timer_label ?? '',
      savedSeconds: r.timer_seconds,
      tempOn: r.temp_check_c != null || r.temp_check_text != null,
      tempValue: r.temp_check_c != null ? numberText(Number(r.temp_check_c)) : '',
      tempText: r.temp_check_text ?? '',
      tipOn: r.tip != null,
      tip: r.tip ?? '',
      photoOn: r.photo_path != null,
      photoPath: r.photo_path,
    }));
}

/** Nothing typed and nothing switched on with content: Save drops it, like an empty ingredient row. */
export function isBlankStep(d: StepDraft): boolean {
  return (
    !d.name.trim() &&
    !d.body.trim() &&
    !(d.timerOn && d.minutes.trim()) &&
    !(d.tempOn && (d.tempValue.trim() || d.tempText.trim())) &&
    !(d.tipOn && d.tip.trim()) &&
    !(d.photoOn && d.photoPath)
  );
}

/** What Save would write for a step, to tell whether anything changed. */
function saved(d: StepDraft) {
  return [
    d.id,
    d.name.trim(),
    d.body.trim(),
    d.timerOn && [d.minutes.trim(), d.timerLabel.trim()],
    d.tempOn && [d.tempValue.trim(), d.tempScale, d.tempText.trim()],
    d.tipOn && d.tip.trim(),
    d.photoOn && d.photoPath,
  ];
}

/** Whether the steps differ from how they were loaded (Cancel asks, Save writes them). */
export function stepsChanged(start: StepDraft[], now: StepDraft[]): boolean {
  const norm = (ds: StepDraft[]) => JSON.stringify(ds.filter((d) => !isBlankStep(d)).map(saved));
  return norm(start) !== norm(now);
}

// ——— Text with chips (FR-001) ———

/** Tokens as `renderStep` reads them (`@cocon/quantity`). */
const TOKEN = /\{(ing|temp):([^{}\s:]+)(?::(food))?\}/g;

export type ChipKind = 'ingredient' | 'missing' | 'temperature';

/** A run of the editor's text: typed text, or a chip standing for a token. */
export type BodySegment =
  | { type: 'text'; text: string }
  | { type: 'chip'; token: string; label: string; kind: ChipKind; ingredientId?: string; celsius?: number; food?: boolean };

/**
 * The body as the editor shows it: ingredient chips by name ("Leeks"), temperatures in both
 * scales ("180 °C (350 °F)"), and "Missing ingredient" for one that isn't in the list any more.
 */
export function segmentsOf(body: string, names: ReadonlyMap<string, string>): BodySegment[] {
  const out: BodySegment[] = [];
  let last = 0;
  const text = (t: string) => {
    if (t) out.push({ type: 'text', text: t });
  };
  for (const m of body.matchAll(TOKEN)) {
    text(body.slice(last, m.index));
    last = m.index + m[0].length;
    const [token, kind, value, food] = m as unknown as [string, 'ing' | 'temp', string, string | undefined];
    if (kind === 'ing') {
      const name = names.get(value);
      out.push(
        name
          ? { type: 'chip', token, label: name, kind: 'ingredient', ingredientId: value }
          : { type: 'chip', token, label: s.missingChip, kind: 'missing', ingredientId: value },
      );
      continue;
    }
    const celsius = Number(value);
    if (!Number.isFinite(celsius)) {
      text(token);
      continue;
    }
    out.push({ type: 'chip', token, label: formatTemperature(celsius, { system: 'metric', kind: food ? 'food' : 'oven' }), kind: 'temperature', celsius, food: !!food });
  }
  text(body.slice(last));
  return out;
}

/** What the editor's text field holds. */
export const shownText = (segments: BodySegment[]) => segments.map((g) => (g.type === 'text' ? g.text : g.label)).join('');

/** Each run of the body, a character of typed text or a whole chip, with where it shows. */
interface Unit {
  start: number;
  end: number;
  stored: string;
  chip: boolean;
}

function unitsOf(segments: BodySegment[]): Unit[] {
  const units: Unit[] = [];
  let at = 0;
  for (const g of segments) {
    if (g.type === 'chip') {
      units.push({ start: at, end: at + g.label.length, stored: g.token, chip: true });
      at += g.label.length;
    } else {
      for (const ch of g.text) {
        units.push({ start: at, end: at + ch.length, stored: ch, chip: false });
        at += ch.length;
      }
    }
  }
  return units;
}

export interface Selection {
  start: number;
  end: number;
}

/**
 * Replaces the shown range [from, to) with `stored` (text, or a token). A chip the range touches
 * goes whole; inserting inside a chip lands after it. Returns the body and the caret after it.
 */
export function replaceShown(
  segments: BodySegment[],
  names: ReadonlyMap<string, string>,
  from: number,
  to: number,
  stored: string,
): { body: string; caret: number } {
  let before = '';
  let after = '';
  for (const u of unitsOf(segments)) {
    if (to > from ? u.start < to && u.end > from : u.chip && u.start < from && u.end > from) {
      // Typing inside a chip: the chip stays, the text follows it. Deleting into one removes it.
      if (to === from) before += u.stored;
      continue;
    }
    if (u.end <= from) before += u.stored;
    else after += u.stored;
  }
  const caret = shownText(segmentsOf(before + stored, names)).length;
  return { body: before + stored + after, caret };
}

/** Braces would read as tokens: typed text never makes one by accident. */
const typed = (t: string) => t.replace(/[{}]/g, '');

/**
 * FR-001: the text field changed from `segments`' text to `next`. Works out what was typed or
 * deleted (the selection before the change settles a repeated letter), and applies it so a chip is
 * never partly edited: deleting into one removes it, typing inside one lands after it.
 */
export function editBody(
  segments: BodySegment[],
  names: ReadonlyMap<string, string>,
  next: string,
  selection?: Selection,
): { body: string; caret: number } {
  const old = shownText(segments);
  if (old === next) return { body: segments.map((g) => (g.type === 'text' ? g.text : g.token)).join(''), caret: selection?.end ?? next.length };
  if (selection && selection.start === selection.end) {
    const c = selection.start;
    // Backspace and forward delete of one character.
    if (next.length === old.length - 1 && c > 0 && old.slice(0, c - 1) + old.slice(c) === next) return replaceShown(segments, names, c - 1, c, '');
    if (next.length === old.length - 1 && old.slice(0, c) + old.slice(c + 1) === next) return replaceShown(segments, names, c, c + 1, '');
  }
  let prefix = 0;
  const max = Math.min(old.length, next.length);
  while (prefix < max && old[prefix] === next[prefix]) prefix += 1;
  if (selection) prefix = Math.min(prefix, selection.start);
  let suffix = 0;
  while (suffix < max - prefix && old[old.length - 1 - suffix] === next[next.length - 1 - suffix]) suffix += 1;
  let end = old.length - suffix;
  // The matched tail can't keep half a chip ("Leeks" → "onions" keeps its "s"): the change runs to the chip's end.
  if (end > prefix) for (const u of unitsOf(segments)) if (u.chip && u.start < end && end < u.end) end = u.end;
  return replaceShown(segments, names, prefix, end, typed(next.slice(prefix, next.length - (old.length - end))));
}

/** A caret inside a chip moves to the chip's end; a selection grows to cover the chips it touches. */
export function snapSelection(segments: BodySegment[], sel: Selection): Selection {
  let { start, end } = sel;
  for (const u of unitsOf(segments)) {
    if (!u.chip) continue;
    if (start === end) {
      if (u.start < start && start < u.end) return { start: u.end, end: u.end };
      continue;
    }
    if (u.start < start && start < u.end) start = u.start;
    if (u.start < end && end < u.end) end = u.end;
  }
  return { start, end };
}

/**
 * FR-002: puts a token at the caret ("+ Eggs", or a picked @ suggestion replacing "@eg"), with a
 * space either side when the text runs straight into it.
 */
export function insertToken(segments: BodySegment[], names: ReadonlyMap<string, string>, at: Selection, token: string): { body: string; caret: number } {
  const old = shownText(segments);
  const { start, end } = snapSelection(segments, at);
  const left = old.slice(0, start);
  const right = old.slice(end);
  const lead = left && !/\s$/.test(left) ? ' ' : '';
  const trail = !right || !/^[\s.,;:!?)]/.test(right) ? ' ' : '';
  return replaceShown(segments, names, start, end, lead + token + trail);
}

/** The "@le" being typed just before the caret: where its "@" is and what follows it. */
export function mentionAt(shown: string, caret: number): { start: number; query: string } | null {
  const m = /(?:^|[\s(])@([\p{L}\d'’ -]{0,30})$/u.exec(shown.slice(0, caret));
  const query = m?.[1];
  if (query === undefined) return null;
  return { start: caret - query.length - 1, query };
}

/** US1: the ingredients a "@" query names, best first: the name starts with it, then a word does. */
export function matchMentions<T extends { id: string; name: string }>(query: string, ingredients: T[], limit = 5): T[] {
  const q = foldText(query).trim();
  const named = ingredients.filter((i) => i.name.trim());
  if (!q) return named.slice(0, limit);
  const scored = named.flatMap((i) => {
    const n = foldText(i.name).trim();
    const rank = n.startsWith(q) ? 0 : n.split(' ').some((w) => w.startsWith(q)) ? 1 : -1;
    return rank < 0 ? [] : [{ i, rank }];
  });
  return scored.sort((a, b) => a.rank - b.rank).slice(0, limit).map((x) => x.i);
}

/** FR-002: ingredients no step mentions yet, for the "+ Leeks" chips. */
export function unusedIngredients<T extends { id: string; name: string }>(ingredients: T[], steps: Pick<StepDraft, 'body'>[]): T[] {
  return ingredients.filter((i) => i.name.trim() && !steps.some((st) => st.body.includes(ingredientToken(i.id))));
}

/** The ingredient ids a step's text mentions that aren't in the list (the "Missing ingredient" message). */
export function missingIn(body: string, ingredientIds: ReadonlySet<string>): string[] {
  return [...body.matchAll(TOKEN)].flatMap((m) => (m[1] === 'ing' && m[2] && !ingredientIds.has(m[2]) ? [m[2]] : []));
}

/**
 * Takes removed ingredients out of a step's text, tidied as `save_recipe_ingredients` does. A step
 * that was only those ingredients keeps its text (it shows them as missing until it's edited).
 */
export function removeTokens(body: string, ids: string[]): string {
  if (ids.length === 0) return body;
  let out = body;
  for (const id of ids) out = out.split(ingredientToken(id)).join('');
  out = out.replace(/[ \t]{2,}/g, ' ').replace(/ ([.,;:!?])/g, '$1').trim();
  return out === '' ? body : out;
}

/** The temperatures in a step's text, for the "Oven · Thermometer" choice. */
export function temperaturesIn(body: string): { token: string; celsius: number; food: boolean }[] {
  return [...body.matchAll(TOKEN)].flatMap((m) => {
    const c = Number(m[2]);
    return m[1] === 'temp' && Number.isFinite(c) ? [{ token: m[0], celsius: c, food: m[3] === 'food' }] : [];
  });
}

/** Marks one temperature in the text as an oven temperature or a thermometer reading (FR-006). */
export function markTemperature(body: string, token: string, food: boolean): string {
  const c = Number(/^\{temp:([^{}\s:]+)/.exec(token)?.[1]);
  if (!Number.isFinite(c)) return body;
  return body.replace(token, temperatureToken(c, food ? 'food' : 'oven'));
}

// ——— Save (OC-EditSteps › Validation copy) ———

export type StepField = 'body' | 'timer' | 'temp';
export type StepWarning = 'bodyMissing' | 'bodyTooLong' | 'timerInvalid' | 'tempInvalid';
export type StepWarnings = Record<string, Partial<Record<StepField, StepWarning>>>;

/** What `save_recipe_steps` takes per step, in order. */
export type StepSaveRow = Omit<StepInput, 'position'> & { id: string };

/** "71", "71.5", "-18", "160,5". */
function readTemperature(value: string, scale: 'C' | 'F'): number | null {
  const t = value.trim().replace(',', '.');
  if (!/^-?\d{1,3}(\.\d+)?$/.test(t)) return null;
  const c = scale === 'F' ? fToC(Number(t)) : Number(t);
  const rounded = Math.round(c * 10) / 10;
  return rounded >= -50 && rounded <= 400 ? rounded : null;
}

/**
 * Save's reading of the steps: the rows to save, or warnings per step. Blank steps are dropped,
 * typed temperatures become tokens (FR-006), a °F check is stored in °C (FR-005), and an add-on
 * that's switched off is saved as none.
 */
export function readSteps(drafts: StepDraft[]): { rows: StepSaveRow[] } | { warnings: StepWarnings } {
  const warnings: StepWarnings = {};
  const rows: StepSaveRow[] = [];
  for (const d of drafts) {
    if (isBlankStep(d)) continue;
    const w: Partial<Record<StepField, StepWarning>> = {};
    const body = tokenizeTemperatures(d.body).trim();
    if (!body) w.body = 'bodyMissing';
    else if (body.length > 2000) w.body = 'bodyTooLong';
    let seconds: number | null = null;
    if (d.timerOn) {
      const unchanged = d.savedSeconds != null && d.minutes.trim() === formatTotalTime(Math.max(1, Math.round(d.savedSeconds / 60)));
      const minutes = parseMinutes(d.minutes);
      if (unchanged) seconds = d.savedSeconds;
      else if (minutes === null || minutes === 'invalid' || minutes > 1440) w.timer = 'timerInvalid';
      else seconds = minutes * 60;
    }
    let celsius: number | null = null;
    if (d.tempOn) {
      celsius = readTemperature(d.tempValue, d.tempScale);
      if (celsius === null) w.temp = 'tempInvalid';
    }
    if (Object.keys(w).length > 0) {
      warnings[d.key] = w;
      continue;
    }
    const row = {
      name: d.name.trim().slice(0, 60).trim() || null,
      body,
      timer_seconds: seconds,
      timer_label: seconds != null ? d.timerLabel.trim().slice(0, 40).trim() || null : null,
      temp_check_c: celsius,
      temp_check_text: d.tempOn ? d.tempText.trim().slice(0, 120).trim() || null : null,
      tip: d.tipOn ? d.tip.trim().slice(0, 200).trim() || null : null,
      photo_path: d.photoOn ? d.photoPath : null,
    };
    const parsed = StepInput.safeParse({ ...row, position: rows.length });
    if (!parsed.success) {
      warnings[d.key] = { body: 'bodyTooLong' };
      continue;
    }
    const { position: _position, ...valid } = parsed.data;
    rows.push({ ...valid, id: d.id });
  }
  return Object.keys(warnings).length > 0 ? { warnings } : { rows };
}

/** `recipe_step_added` for each saved step that wasn't in the recipe before (no text is sent). */
export function addedStepEvents(rows: StepSaveRow[], startIds: ReadonlySet<string>): EventProps<'recipe_step_added'>[] {
  return rows
    .filter((r) => !startIds.has(r.id))
    .map((r) => ({ has_timer: r.timer_seconds != null, has_temperature: r.temp_check_c != null, has_tip: r.tip != null }));
}

/** The collapsed card's badges: "Tip", "8 min" (OC-EditSteps › Layout 2). */
export function stepBadges(d: StepDraft): string[] {
  const out: string[] = [];
  if (d.tipOn && d.tip.trim()) out.push(s.tipBadge);
  if (d.timerOn) {
    const m = parseMinutes(d.minutes);
    if (typeof m === 'number') out.push(formatTotalTime(m));
  }
  return out;
}
