/** The longest time a recipe can store (`recipes.total_minutes`, `prep_minutes`): one week. */
export const MAX_RECIPE_MINUTES = 10080;

const MINUTE_WORDS = '(?:m|min|mins|minute|minutes)';
const HOUR_WORDS = '(?:h|hr|hrs|hour|hours)';
const minutesOnly = new RegExp(`^(\\d{1,5})\\s*${MINUTE_WORDS}?$`);
const hoursAndMinutes = new RegExp(`^(\\d{1,3})\\s*${HOUR_WORDS}(?:\\s*(\\d{1,3})\\s*${MINUTE_WORDS}?)?$`);
const clock = /^(\d{1,3}):(\d{2})$/;

/**
 * A typed time (spec 014 FR-003) in minutes: "70", "70 min", "1 h 10", "1h10", "1 h 05" (what the app
 * shows, so an edited value reads back), "2 hours", "1:10". Empty is null (no time); anything
 * else, or outside 1 min to a week, is 'invalid'. The MCP server reads times the same way.
 */
export function parseMinutes(text: string): number | null | 'invalid' {
  const t = text.trim().toLowerCase().replace(/\s+/g, ' ');
  if (t === '') return null;
  let minutes: number | null = null;
  const m = minutesOnly.exec(t);
  const hm = hoursAndMinutes.exec(t) ?? clock.exec(t);
  if (m) minutes = Number(m[1]);
  else if (hm) {
    const extra = hm[2] === undefined ? 0 : Number(hm[2]);
    if (extra >= 60) return 'invalid';
    minutes = Number(hm[1]) * 60 + extra;
  }
  if (minutes === null || minutes < 1 || minutes > MAX_RECIPE_MINUTES) return 'invalid';
  return minutes;
}

const AMOUNT = '(\\d+(?:[.,]\\d+)?|\\d*\\s*[½¼¾])';
const RANGE = `${AMOUNT}(?:\\s*(?:-|–|—|to)\\s*${AMOUNT})?`;
const DURATION = new RegExp(`\\b${RANGE}\\s*(${HOUR_WORDS}|${MINUTE_WORDS}|s|sec|secs|second|seconds)\\b(?:\\s*(?:and\\s*)?(\\d{1,2})\\s*${MINUTE_WORDS}\\b)?`, 'gi');
const FRACTIONS: Record<string, number> = { '½': 0.5, '¼': 0.25, '¾': 0.75 };

function amountOf(text: string): number {
  const t = text.replace(/\s+/g, '');
  const frac = FRACTIONS[t.slice(-1)];
  if (frac !== undefined) return (t.length > 1 ? Number(t.slice(0, -1)) : 0) + frac;
  return Number(t.replace(',', '.'));
}

/**
 * Spec 023 US1: a step's timer from its text, in seconds, when it mentions exactly one duration
 * ("Bake for 25 minutes", "simmer 1½ hours", "1 hr 20 min"). A range counts once, by its shorter
 * end ("20–25 minutes" → 20: check early). None, or more than one, is null: the step's text is
 * then the only guide, as in the app.
 */
export function stepTimerFrom(text: string): number | null {
  const found = [...text.matchAll(DURATION)];
  if (found.length !== 1) return null;
  const [, low = '', , unit = '', extra] = found[0] as RegExpMatchArray;
  const n = amountOf(low);
  if (!Number.isFinite(n) || n <= 0) return null;
  const u = unit.toLowerCase();
  const seconds = /^h/.test(u) ? n * 3600 + (extra ? Number(extra) * 60 : 0) : /^m/.test(u) ? n * 60 : n;
  const rounded = Math.round(seconds);
  return rounded >= 1 && rounded <= 86400 ? rounded : null;
}
