import { en, type CalendarWords } from './words.en';
import { es } from './words.es';
import { fr } from './words.fr';

/** Spec 076: the calendar's words in every language the app speaks. */
export const calendarWordsByLanguage = { en, fr, es } as const satisfies Record<string, CalendarWords>;

/**
 * The words labels use when none are passed: English (the MCP server) until the app picks its
 * language. Changed in place, so `const words = calendarWords` follows.
 */
export const calendarWords: CalendarWords = { ...en };

export function setCalendarWords(words: CalendarWords) {
  Object.assign(calendarWords, words);
}
