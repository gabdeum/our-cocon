/** Spec 015 FR-001: an amount as typed ("2", "1.5", "1½", "½", "1/2", "1 1/2", "2-3"). */

const VULGAR: Record<string, number> = { '½': 0.5, '⅓': 1 / 3, '⅔': 2 / 3, '¼': 0.25, '¾': 0.75, '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875 };
const VULGAR_CLASS = '½⅓⅔¼¾⅛⅜⅝⅞';

/** One amount at the start of `text`, without a range: "1 1/2", "1½", "1/2", "1.5", "½". */
const SINGLE = new RegExp(`^(?:(\\d+)\\s+(\\d+)\\s*/\\s*(\\d+)|(\\d+)?\\s*([${VULGAR_CLASS}])|(\\d+)\\s*/\\s*(\\d+)|(\\d+(?:\\.\\d+)?|\\.\\d+))`);

/** A range's second half ("-3", " to 3", "–3"): read and ignored, the first number is kept. */
const RANGE_TAIL = new RegExp(`^\\s*(?:-|–|—|to)\\s*(?:\\d+(?:\\.\\d+)?(?:\\s*/\\s*\\d+)?|\\d*\\s*[${VULGAR_CLASS}])`);

/**
 * The amount at the start of `text` and how many characters it took, or null when it doesn't start
 * with one. Used by the paste parser, which then reads the unit and name from the rest.
 */
export function readAmount(text: string): { value: number; length: number } | null {
  const m = SINGLE.exec(text);
  if (!m) return null;
  let value: number;
  if (m[1] !== undefined) value = Number(m[1]) + Number(m[2]) / Number(m[3]);
  else if (m[5] !== undefined) value = Number(m[4] ?? 0) + (VULGAR[m[5]] as number);
  else if (m[6] !== undefined) value = Number(m[6]) / Number(m[7]);
  else value = Number(m[8]);
  if (!Number.isFinite(value)) return null;
  let length = m[0].length;
  const range = RANGE_TAIL.exec(text.slice(length));
  if (range) length += range[0].length;
  return { value, length };
}

/**
 * What an amount field lets through as it's typed: digits, a decimal point (a comma becomes one),
 * and with `fractions`, "/", spaces, "-" for ranges and ½-style characters ("1 1/2", "1½").
 */
export function amountInput(text: string, { fractions = true }: { fractions?: boolean } = {}): string {
  const allowed = fractions ? new RegExp(`[^0-9./ \\-${VULGAR_CLASS}]`, 'g') : /[^0-9.]/g;
  return text.replace(/,/g, '.').replace(allowed, '').replace(/\s{2,}/g, ' ').slice(0, 12);
}

/** What a quantity field holds: a positive number, nothing (empty), or something that isn't an amount. */
export function parseAmount(text: string): number | null | 'invalid' {
  const t = text.trim();
  if (!t) return null;
  const read = readAmount(t);
  if (!read || t.slice(read.length).trim() !== '' || !(read.value > 0) || read.value >= 100000) return 'invalid';
  return read.value;
}
