import type { DisplayWords, ShownUnit } from './display.en';

const UNITS: Record<ShownUnit, [string, string]> = {
  cup: ['taza', 'tazas'],
  tbsp: ['cda', 'cdas'],
  tsp: ['cdta', 'cdtas'],
  pinch: ['pizca', 'pizcas'],
  g: ['g', 'g'],
  kg: ['kg', 'kg'],
  ml: ['ml', 'ml'],
  L: ['l', 'l'],
  oz: ['oz', 'oz'],
  lb: ['lb', 'lb'],
};

/** Spec 076: amounts in Spanish ("1,5 kg de harina", "2 cdas de aceite"). */
export const es: DisplayWords = {
  unit: (unit, count) => UNITS[unit][count > 1 ? 1 : 0],
  aPinch: 'una pizca',
  aPinchOf: (noun) => `una pizca de ${noun}`,
  measured: (measure, noun) => `${measure} de ${noun}`,
  of: (measure, noun) => `${measure} de ${noun}`,
  about: (amount) => `unos ${amount}`,
  // Said of the piece, not the noun, so they never need agreement ("2 cebollas (tamaño pequeño)").
  size: { small: 'tamaño pequeño', medium: 'tamaño mediano', large: 'tamaño grande' },
  pieces: (amount, size, noun) => `${amount} ${noun}${size ? ` (${size})` : ''}`,
  sized: (size, name) => `${name} (${size})`,
  decimal: ',',
};
