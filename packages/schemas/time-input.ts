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
