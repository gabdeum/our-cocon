import { ingredientToken } from './render-step';

/** An ingredient a step can mention: its id, name and, when the catalog knows it, its plural. */
export interface MentionTarget {
  id: string;
  name: string;
  plural?: string | null;
}

export type Tokenized = { ok: true; body: string } | { ok: false; unknown: string };

const TOKEN = /\{(ing|temp):([^{}]*)\}/g;
const MARKS = /\p{M}/gu;

/** One character folded for matching (accents and capitals off), keeping the text's length. */
function fold(text: string): string {
  let out = '';
  for (const c of text) {
    const f = c.normalize('NFD').replace(MARKS, '').toLowerCase();
    out += f.length === c.length ? f : c.toLowerCase().length === c.length ? c.toLowerCase() : c;
  }
  return out;
}

const isWordChar = (c: string | undefined) => c !== undefined && /[\p{L}\p{N}]/u.test(c);

/** The ways a step may write an ingredient's name: as is, its plural, or without a plural's s. */
function forms(i: MentionTarget): string[] {
  const name = fold(i.name.trim());
  const out = new Set([name]);
  if (i.plural?.trim()) out.add(fold(i.plural.trim()));
  if (/(s|x|z|ch|sh)$/.test(name)) out.add(`${name}es`);
  else out.add(`${name}s`);
  if (name.endsWith('es')) out.add(name.slice(0, -2));
  if (name.endsWith('s')) out.add(name.slice(0, -1));
  return [...out].filter((f) => f.length >= 2);
}

/**
 * Words before a mention that the token now says itself: "the", or an amount ("200 ml",
 * "2 large", "a pinch of"). Folded text, anchored at the end.
 */
const LEADING = new RegExp(
  '(?:(?:the|your)\\s{1,3})?' +
    '(?:(?:\\d{1,6}(?:[.,/]\\d{1,4})?|[½¼¾⅓⅔⅛]|\\d{1,4}\\s{0,3}[½¼¾⅓⅔⅛]|a|an|one|half(?:\\s{1,3}a)?)\\s{0,3}' +
    '(?:(?:g|kg|ml|l|tsp|tbsp|cups?|oz|lbs?|pinch(?:es)?|grams?|kilos?|kilograms?|millilit(?:er|re)s?|lit(?:er|re)s?|' +
    'teaspoons?|tablespoons?|ounces?|pounds?|cloves?|cans?|tins?|bunch(?:es)?|handfuls?|sprigs?|slices?|small|medium|large)\\.?\\s{1,3}){0,3}' +
    '(?:of\\s{1,3})?)?$',
);

const LEAD_WINDOW = 48;

/**
 * Spec 023 FR-004: a step written as plain text, as the app stores it. Each ingredient's first
 * mention becomes `{ing:<id>}` (the app writes it with its amount, so a written amount or "the"
 * before it goes too); later mentions and anything unmatched stay text. Accents and capitals don't
 * matter; longer names win ("double cream" before "cream"). An assistant may also write
 * `{ing:<name or id>}` itself: one naming no ingredient of the recipe comes back as `unknown`.
 */
export function tokenizeIngredients(body: string, ingredients: readonly MentionTarget[]): Tokenized {
  const byId = new Map(ingredients.map((i) => [i.id, i]));
  const byName = new Map<string, MentionTarget>();
  for (const i of ingredients) for (const f of forms(i)) if (!byName.has(f)) byName.set(f, i);

  // 1. Tokens the assistant wrote: ids stay, names become ids, anything else is refused.
  let unknown: string | null = null;
  const resolved = body.replace(TOKEN, (token, kind: string, ref: string) => {
    if (kind !== 'ing') return token;
    const target = byId.get(ref) ?? byName.get(fold(ref.trim()));
    if (!target) unknown ??= token;
    return target ? ingredientToken(target.id) : token;
  });
  if (unknown) return { ok: false, unknown };

  // 2. Plain-text mentions, outside tokens, first one of each ingredient not already a token.
  const done = new Set([...resolved.matchAll(/\{ing:([^{}\s:]+)\}/g)].map((m) => m[1]));
  const folded = fold(resolved);
  const blocked = new Array<boolean>(resolved.length).fill(false);
  for (const m of resolved.matchAll(TOKEN)) for (let k = m.index; k < m.index + m[0].length; k++) blocked[k] = true;

  const candidates = [...byName.entries()].sort((a, b) => b[0].length - a[0].length);
  const hits: { start: number; end: number; id: string }[] = [];
  for (const [form, target] of candidates) {
    if (done.has(target.id)) continue;
    let from = 0;
    for (;;) {
      const at = folded.indexOf(form, from);
      if (at < 0) break;
      const end = at + form.length;
      from = at + 1;
      if (isWordChar(folded[at - 1]) || isWordChar(folded[end])) continue;
      if (blocked.slice(at, end).some(Boolean)) continue;
      // Only the few words just before the mention can be its amount: a short window keeps this
      // fast on any text (no backtracking over a long prefix).
      const lead = LEADING.exec(folded.slice(Math.max(0, at - LEAD_WINDOW), at))?.[0] ?? '';
      const start = at - lead.length;
      // A leading word only goes when it stands on its own ("the", not "breathe").
      const s = lead && isWordChar(folded[start - 1]) ? at : start;
      hits.push({ start: s, end, id: target.id });
      for (let k = s; k < end; k++) blocked[k] = true;
      done.add(target.id);
      break;
    }
  }

  let out = resolved;
  for (const h of hits.sort((a, b) => b.start - a.start)) out = out.slice(0, h.start) + ingredientToken(h.id) + out.slice(h.end);
  return { ok: true, body: out };
}
