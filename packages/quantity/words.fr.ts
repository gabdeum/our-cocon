import type { Unit } from '@cocon/schemas/recipes';
import type { ParserWords } from './words.en';

const pairs = (list: [string, Unit][]): Record<string, Unit> => Object.fromEntries(list);
const nouns = (list: [string, string][]) => Object.fromEntries(list.flatMap(([one, many]) => [[one, { singular: one, plural: many }], [many, { singular: one, plural: many }]]));

/** Spec 078 FR-005: the paste parser's French words ("2 c. à soupe d’huile d’olive", "3 gousses d’ail"). */
export const fr: ParserWords = {
  units: pairs([
    ['gramme', 'g'], ['grammes', 'g'], ['kilo', 'kg'], ['kilos', 'kg'], ['kilogramme', 'kg'], ['kilogrammes', 'kg'],
    ['millilitre', 'ml'], ['millilitres', 'ml'], ['litre', 'l'], ['litres', 'l'],
    ['tasse', 'cup'], ['tasses', 'cup'], ['pincée', 'pinch'], ['pincées', 'pinch'], ['pincee', 'pinch'], ['pincees', 'pinch'],
    ['cas', 'tbsp'], ['càs', 'tbsp'], ['cs', 'tbsp'], ['cac', 'tsp'], ['càc', 'tsp'], ['cc', 'tsp'],
    ['morceau', 'piece'], ['morceaux', 'piece'],
  ]),
  countNouns: nouns([
    ['gousse', 'gousses'], ['tranche', 'tranches'], ['brin', 'brins'], ['branche', 'branches'], ['feuille', 'feuilles'],
    ['boîte', 'boîtes'], ['botte', 'bottes'], ['tête', 'têtes'], ['bâton', 'bâtons'], ['sachet', 'sachets'],
  ]),
  sizes: { petit: 'small', petite: 'small', moyen: 'medium', moyenne: 'medium', gros: 'large', grosse: 'large', grand: 'large', grande: 'large' },
  one: ['un', 'une'],
  of: ['de', 'du', 'des'],
  prep: [
    'finement', 'grossièrement', 'haché', 'hachée', 'hachés', 'hachées', 'émincé', 'émincée', 'émincés', 'émincées', 'coupé',
    'coupée', 'coupés', 'coupées', 'râpé', 'râpée', 'râpés', 'râpées', 'pelé', 'pelée', 'pelés', 'pelées', 'écrasé', 'écrasée',
    'fondu', 'fondue', 'ramolli', 'frais', 'fraîche', 'en', 'dés', 'cubes', 'tranches', 'rondelles', 'lamelles', 'morceaux',
    'et', 'ou', 'à', 'au', 'goût', 'pour', 'servir', 'facultatif', 'un', 'peu', 'de', 'plus',
  ],
  phrases: [
    [/\bc(?:uill(?:e|è)res?)?\.?\s*(?:à|a)\s*s(?:oupe)?\.?(?=\s|$)/giu, 'tbsp'],
    [/\bc(?:uill(?:e|è)res?)?\.?\s*(?:à|a)\s*c(?:af(?:e|é))?\.?(?=\s|$)/giu, 'tsp'],
    [/\bcuill(?:e|è)res?\s+(?:à|a)\s+th(?:e|é)\b/giu, 'tsp'],
  ],
  elided: ['d’', "d'"],
};
