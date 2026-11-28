import type { SizeWord } from '@cocon/schemas/recipes';

/** The units an amount is shown in. */
export type ShownUnit = 'cup' | 'tbsp' | 'tsp' | 'pinch' | 'g' | 'kg' | 'ml' | 'L' | 'oz' | 'lb';

/**
 * Spec 076: every word `format` shows, one file per language (`display.fr.ts`, `display.es.ts`),
 * with the word order of each. Not the parser's words (`words.en.ts`), which read what people type.
 */
export interface DisplayWords {
  unit: (unit: ShownUnit, count: number) => string;
  /** An amount too small to measure. */
  aPinch: string;
  aPinchOf: (noun: string) => string;
  /** "200 g flour". */
  measured: (measure: string, noun: string) => string;
  /** Spoons of something counted in pieces: "1 tbsp of onions". */
  of: (measure: string, noun: string) => string;
  /** A volume worked out from a weight: "about ¾". */
  about: (amount: string) => string;
  size: Record<SizeWord, string>;
  /** "2 onions", "1 large onion" (`size` empty for the default size). */
  pieces: (amount: string, size: string, noun: string) => string;
  /** A name with its size, in ingredient lists: "Large eggs". */
  sized: (size: string, name: string) => string;
  /** The decimal point: "1.5". */
  decimal: string;
}

const UNITS: Record<ShownUnit, [string, string]> = {
  cup: ['cup', 'cups'],
  tbsp: ['tbsp', 'tbsp'],
  tsp: ['tsp', 'tsp'],
  pinch: ['pinch', 'pinches'],
  g: ['g', 'g'],
  kg: ['kg', 'kg'],
  ml: ['ml', 'ml'],
  L: ['L', 'L'],
  oz: ['oz', 'oz'],
  lb: ['lb', 'lb'],
};

export const en: DisplayWords = {
  unit: (unit, count) => UNITS[unit][count > 1 ? 1 : 0],
  aPinch: 'a pinch',
  aPinchOf: (noun) => `a pinch of ${noun}`,
  measured: (measure, noun) => `${measure} ${noun}`,
  of: (measure, noun) => `${measure} of ${noun}`,
  about: (amount) => `about ${amount}`,
  size: { small: 'small', medium: 'medium', large: 'large' },
  pieces: (amount, size, noun) => `${amount}${size ? ` ${size}` : ''} ${noun}`,
  sized: (size, name) => `${size.charAt(0).toUpperCase()}${size.slice(1)} ${name.charAt(0).toLowerCase()}${name.slice(1)}`,
  decimal: '.',
};
