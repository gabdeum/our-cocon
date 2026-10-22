import { foldText, singularWord } from '@cocon/schemas/ingredient-text';
import type { SizeWord, Unit } from '@cocon/schemas/recipes';
import { readAmount } from './parse-amount';
import { en, type ParserWords } from './words.en';

/** Spec 015 FR-003: one pasted line as a form row. Nothing here is matched against the catalog. */
export interface ParsedLine {
  /** As written, first letter in capitals ("Lardons", "Salt and pepper to taste"). */
  name: string;
  quantity: number | null;
  unit: Unit | null;
  size_word: SizeWord | null;
  /** "2 cloves garlic": what one piece is called. */
  piece_noun: { singular: string; plural: string } | null;
}

const BULLET = /^\s*(?:[-•*·▪–—]+|\d+[.)](?=\s))\s*/;

const upperFirst = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** Commas split a list, except inside brackets and between digits ("1,5"). */
function splitCommas(line: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (c === '(') depth += 1;
    else if (c === ')') depth = Math.max(0, depth - 1);
    else if ((c === ',' || c === ';') && depth === 0 && !(/\d/.test(line[i - 1] ?? '') && /\d/.test(line[i + 1] ?? ''))) {
      parts.push(line.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(line.slice(start));
  return parts;
}

/** "finely chopped", "to taste": a part that only says how to prepare the one before it. */
function isPrepOnly(part: string, words: ParserWords): boolean {
  if (readAmount(part.trim())) return false;
  const folded = foldText(part).split(' ').filter(Boolean);
  return folded.length > 0 && folded.every((w) => words.prep.includes(w) || /^\d+$/.test(w));
}

/**
 * Splits a pasted list on new lines and commas. A part that is only preparation ("finely chopped")
 * stays with the line before it, so "1 onion, finely chopped" is one row.
 */
export function splitPastedList(text: string, words: ParserWords = en): string[] {
  const out: string[] = [];
  for (const line of text.split(/\r?\n|\r/)) {
    // Only a later part of the same line joins: a line of its own is always a row.
    let joinable = false;
    for (const [i, raw] of splitCommas(line).entries()) {
      const part = (i === 0 ? raw.replace(BULLET, '') : raw).trim().replace(/\.$/, '').trim();
      if (!part) continue;
      if (joinable && isPrepOnly(part, words)) out[out.length - 1] = `${out.at(-1) as string}, ${part}`;
      else out.push(part);
      joinable = true;
    }
  }
  return out;
}

const unitOf = (word: string, words: ParserWords): Unit | undefined => words.units[word.toLowerCase().replace(/\.$/, '')];

/** One line ("200 g lardons", "3 eggs", "1½ cups flour", "2 small onions"), or null when it's empty. */
export function parseIngredientLine(line: string, words: ParserWords = en): ParsedLine | null {
  let rest = line.replace(BULLET, '').trim().replace(/\.$/, '').trim();
  if (!rest) return null;

  let quantity: number | null = null;
  const amount = readAmount(rest);
  if (amount) {
    quantity = amount.value;
    rest = rest.slice(amount.length).trim();
  } else {
    const first = /^(\S+)\s+(.*)$/.exec(rest);
    // "a pinch of salt", "an egg": one, when something follows.
    if (first && words.one.includes((first[1] as string).toLowerCase())) {
      quantity = 1;
      rest = (first[2] as string).trim();
    }
  }

  let unit: Unit | null = null;
  let size_word: SizeWord | null = null;
  let piece_noun: ParsedLine['piece_noun'] = null;
  if (quantity !== null) {
    // An amount in brackets after the count is a note ("2 (400 g) cans"): kept in the name.
    const next = /^(\S+)(?:\s+(.*))?$/.exec(rest);
    const word = next?.[1] ?? '';
    const after = (next?.[2] ?? '').trim();
    const asUnit = unitOf(word, words);
    const noun = words.countNouns[word.toLowerCase()];
    const size = words.sizes[word.toLowerCase()];
    if (asUnit && after) {
      unit = asUnit;
      rest = after;
    } else if (noun && after) {
      unit = 'piece';
      piece_noun = noun;
      rest = after;
    } else if (size && after) {
      unit = 'piece';
      size_word = size;
      rest = after;
    } else {
      unit = 'piece';
    }
    // "2 large cloves garlic", "1 cup of flour".
    const again = /^(\S+)\s+(.*)$/.exec(rest);
    if (again && unit === 'piece' && size_word && words.countNouns[(again[1] as string).toLowerCase()]) {
      piece_noun = words.countNouns[(again[1] as string).toLowerCase()] ?? null;
      rest = (again[2] as string).trim();
    }
    const of = /^(\S+)\s+(.*)$/.exec(rest);
    if (of && words.of.includes((of[1] as string).toLowerCase())) rest = (of[2] as string).trim();
  }

  const name = upperFirst(rest.trim()).slice(0, 80).trim();
  if (!name) return null;
  return { name, quantity, unit, size_word, piece_noun };
}

/** A pasted list as rows, in order; lines with no name are left out. */
export function parsePastedList(text: string, words: ParserWords = en): ParsedLine[] {
  return splitPastedList(text, words).flatMap((line) => {
    const parsed = parseIngredientLine(line, words);
    return parsed ? [parsed] : [];
  });
}

const PLURAL_ES = /(s|x|z|ch|sh|o)$/;

/** "Leeks" → leek / leeks, "Egg" → egg / eggs: what one and several pieces are called, from the name. */
export function pieceNouns(name: string): { singular: string; plural: string } {
  const base = name.split(/[,(]/)[0]?.trim().toLowerCase() || name.trim().toLowerCase();
  const words = base.split(/\s+/).filter(Boolean);
  const last = words.pop() ?? '';
  const head = words.length ? `${words.join(' ')} ` : '';
  const folded = foldText(last);
  const isPlural = folded.length > 3 && folded.endsWith('s') && !/(ss|us|is)$/.test(folded);
  let singular = last;
  let plural = last;
  if (isPlural) {
    singular = folded === last ? singularWord(last) : last.replace(/s$/, '');
  } else if (/[^aeiou]y$/.test(last)) {
    plural = `${last.slice(0, -1)}ies`;
  } else {
    plural = PLURAL_ES.test(last) ? `${last}es` : `${last}s`;
  }
  return { singular: `${head}${singular}`.slice(0, 40), plural: `${head}${plural}`.slice(0, 40) };
}

/**
 * A grocery line (spec 020 FR-002): like a recipe line, or with the amount after the name, as
 * lists are often written: "Gruyere 120g", "Lemon 12", "heavy cream 240 ml". The amount at the end
 * counts only when it's the last word or two and nothing but a known unit follows the number, so
 * "Size 4 nappies" stays a name.
 */
export function parseGroceryLine(line: string, words: ParserWords = en): ParsedLine | null {
  const parsed = parseIngredientLine(line, words);
  if (!parsed || parsed.quantity !== null) return parsed;
  const tokens = line.trim().replace(/\.$/, '').split(/\s+/);
  for (let i = Math.max(1, tokens.length - 2); i < tokens.length; i++) {
    const tail = tokens.slice(i).join(' ');
    const amount = readAmount(tail);
    if (!amount || !(amount.value > 0)) continue;
    const rest = tail.slice(amount.length).trim().toLowerCase().replace(/\.$/, '');
    if (rest && !unitOf(rest, words)) continue;
    const reordered = parseIngredientLine(`${tail} ${tokens.slice(0, i).join(' ')}`, words);
    if (reordered && reordered.quantity !== null && reordered.name) return reordered;
  }
  return parsed;
}
