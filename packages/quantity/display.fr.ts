import type { DisplayWords, ShownUnit } from './display.en';

/** "d’huile", "de farine"; words whose h is aspirated keep "de" ("de haricots"). */
const ASPIRATED = /^(haricot|hachis|homard|houblon|hareng)/i;
const de = (noun: string) => (/^[aeiouyhâàéèêëîïôöûüœ]/i.test(noun) && !ASPIRATED.test(noun) ? `d’${noun}` : `de ${noun}`);

const UNITS: Record<ShownUnit, [string, string]> = {
  cup: ['tasse', 'tasses'],
  tbsp: ['c. à s.', 'c. à s.'],
  tsp: ['c. à c.', 'c. à c.'],
  pinch: ['pincée', 'pincées'],
  g: ['g', 'g'],
  kg: ['kg', 'kg'],
  ml: ['ml', 'ml'],
  L: ['l', 'l'],
  oz: ['oz', 'oz'],
  lb: ['lb', 'lb'],
};

/** Spec 076: amounts in French ("1,5 kg de farine", "2 c. à s. d’huile"). */
export const fr: DisplayWords = {
  unit: (unit, count) => UNITS[unit][count >= 2 ? 1 : 0],
  aPinch: 'une pincée',
  aPinchOf: (noun) => `une pincée ${de(noun)}`,
  measured: (measure, noun) => `${measure} ${de(noun)}`,
  of: (measure, noun) => `${measure} ${de(noun)}`,
  about: (amount) => `environ ${amount}`,
  // Said of the piece, not the noun, so they never need agreement ("2 tomates (petit format)").
  size: { small: 'petit format', medium: 'format moyen', large: 'grand format' },
  pieces: (amount, size, noun) => `${amount} ${noun}${size ? ` (${size})` : ''}`,
  sized: (size, name) => `${name} (${size})`,
  decimal: ',',
};
