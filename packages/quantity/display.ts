import { en, type DisplayWords } from './display.en';
import { es } from './display.es';
import { fr } from './display.fr';

/** Spec 076: how amounts read in every language the app speaks. */
export const displayWordsByLanguage = { en, fr, es } as const satisfies Record<string, DisplayWords>;

/**
 * The words `format` uses: English (the MCP server) until the app picks its language. Changed in
 * place, as `@cocon/calendar`'s words.
 */
export const displayWords: DisplayWords = { ...en };

export function setDisplayWords(words: DisplayWords) {
  Object.assign(displayWords, words);
}
