/**
 * Spec 031 FR-005: how ingredient text is normalised before matching. The same functions run on
 * what people type (app, MCP server) and on the catalog's names when `pnpm catalog` builds the
 * match table, so both sides always agree. No dependencies: the generator imports it as is.
 */

export type SizeWordText = 'small' | 'medium' | 'large';

export interface ParsedIngredientText {
  /** Every word except size words and amounts, normalised: tried first, so "ground beef" stays whole. */
  full: string;
  /** `full` without descriptors ("finely chopped red onions" → "red onion"). */
  core: string;
  size_word: SizeWordText | null;
  /** Descriptors, brackets and what follows a comma, as written ("finely chopped"). */
  prep: string | null;
}

const SIZE_WORDS: Record<string, SizeWordText> = { small: 'small', medium: 'medium', large: 'large', big: 'large' };

/** Words that describe how an ingredient is prepared or bought, not what it is. */
const DESCRIPTORS = new Set([
  'finely', 'coarsely', 'roughly', 'thinly', 'thickly', 'freshly', 'lightly', 'very', 'well', 'extra',
  'chopped', 'diced', 'minced', 'sliced', 'grated', 'shredded', 'crushed', 'cubed', 'halved', 'quartered',
  'julienned', 'mashed', 'pureed', 'peeled', 'deseeded', 'seeded', 'cored', 'pitted', 'trimmed', 'rinsed',
  'drained', 'washed', 'beaten', 'whisked', 'melted', 'softened', 'chilled', 'cold', 'warm', 'room',
  'temperature', 'fresh', 'dried', 'frozen', 'canned', 'tinned', 'toasted', 'roasted', 'ground', 'boneless',
  'skinless', 'skin', 'bone', 'on', 'in', 'optional', 'plus', 'more', 'for', 'serving', 'garnish', 'to',
  'taste', 'about', 'approximately', 'packed', 'heaping', 'heaped', 'level', 'sifted', 'uncooked', 'cooked',
  'raw', 'ripe', 'organic', 'unsalted', 'salted', 'divided', 'thawed', 'torn', 'zested', 'juiced', 'cut',
  'into', 'pieces', 'piece', 'chunks', 'wedges', 'rings', 'strips', 'cubes', 'thin', 'thick', 'good',
  'quality', 'store', 'bought', 'homemade', 'storebought', 'a', 'an', 'the', 'of', 'some', 'few',
]);

/** Connecting words dropped from the ends of a name ("onion and" after "finely chopped and"). */
const EDGE_WORDS = new Set(['and', 'or', 'of', 'with', 'a', 'an', 'the']);

const IRREGULAR: Record<string, string> = {
  leaves: 'leaf', loaves: 'loaf', halves: 'half', knives: 'knife', geese: 'goose', mice: 'mouse', feet: 'foot', teeth: 'tooth',
};

const AMOUNT = /^[\d.,/½⅓⅔¼¾⅛-]+$/;

/** Lower case, no accents, letters and digits only ("Za’atar" → "zaatar", "all-purpose" → "all purpose"). */
export function foldText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’‘`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** English singular of one folded word. Crude on purpose: it only has to agree with itself. */
export function singularWord(word: string): string {
  const irregular = IRREGULAR[word];
  if (irregular) return irregular;
  if (word.length <= 3) return word;
  if (word.endsWith('ies') && word.length > 4) return `${word.slice(0, -3)}y`;
  if (word.endsWith('oes')) return word.slice(0, -2);
  if (/(sses|shes|ches|xes|zes)$/.test(word)) return word.slice(0, -2);
  if (/(ss|us|is)$/.test(word)) return word;
  if (word.endsWith('s')) return word.slice(0, -1);
  return word;
}

/** A name as stored in the match table: folded, each word singular. */
export function normaliseName(name: string): string {
  return foldText(name).split(' ').filter(Boolean).map(singularWord).join(' ');
}

function trimEdges(words: string[]): string[] {
  let start = 0;
  let end = words.length;
  while (start < end && EDGE_WORDS.has(words[start] as string)) start += 1;
  while (end > start && EDGE_WORDS.has(words[end - 1] as string)) end -= 1;
  return words.slice(start, end);
}

/** Splits an ingredient as written into what to match and what to keep as a preparation note. */
export function parseIngredientText(text: string): ParsedIngredientText {
  const notes: string[] = [];
  let head = text.replace(/\(([^)]*)\)/g, (_, inside: string) => {
    if (inside.trim()) notes.push(inside.trim());
    return ' ';
  });
  const comma = head.search(/[,;]/);
  let tail: string | null = null;
  if (comma >= 0) {
    tail = head.slice(comma + 1).trim() || null;
    head = head.slice(0, comma);
  }

  let size: SizeWordText | null = null;
  const fullWords: string[] = [];
  const coreWords: string[] = [];
  const prepWords: string[] = [];
  for (const raw of head.split(/\s+/).filter(Boolean)) {
    const folded = foldText(raw);
    if (!folded || AMOUNT.test(raw)) continue;
    const parts = folded.split(' ');
    const sizeWord = parts.length === 1 ? SIZE_WORDS[folded] : undefined;
    if (sizeWord) {
      size ??= sizeWord;
      continue;
    }
    fullWords.push(...parts);
    if (parts.every((p) => DESCRIPTORS.has(p))) prepWords.push(raw);
    else coreWords.push(...parts);
  }

  const full = trimEdges(fullWords).map(singularWord).join(' ');
  const core = trimEdges(coreWords).map(singularWord).join(' ') || full;
  const prepParts = [prepWords.join(' '), ...notes, tail ?? ''].map((p) => p.trim()).filter(Boolean);
  const prep = prepParts.length > 0 ? prepParts.join(', ').slice(0, 80).trim() : null;
  return { full, core, size_word: size, prep };
}
