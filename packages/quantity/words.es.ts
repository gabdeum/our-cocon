import type { Unit } from '@cocon/schemas/recipes';
import type { ParserWords } from './words.en';

const pairs = (list: [string, Unit][]): Record<string, Unit> => Object.fromEntries(list);
const nouns = (list: [string, string][]) => Object.fromEntries(list.flatMap(([one, many]) => [[one, { singular: one, plural: many }], [many, { singular: one, plural: many }]]));

/** Spec 078 FR-005: the paste parser's Spanish words ("1 cucharada de aceite", "2 dientes de ajo"). */
export const es: ParserWords = {
  units: pairs([
    ['gramo', 'g'], ['gramos', 'g'], ['kilo', 'kg'], ['kilos', 'kg'], ['kilogramo', 'kg'], ['kilogramos', 'kg'],
    ['mililitro', 'ml'], ['mililitros', 'ml'], ['litro', 'l'], ['litros', 'l'],
    ['cucharada', 'tbsp'], ['cucharadas', 'tbsp'], ['cda', 'tbsp'], ['cdas', 'tbsp'],
    ['cucharadita', 'tsp'], ['cucharaditas', 'tsp'], ['cdta', 'tsp'], ['cdtas', 'tsp'], ['cdita', 'tsp'], ['cditas', 'tsp'],
    ['taza', 'cup'], ['tazas', 'cup'], ['pizca', 'pinch'], ['pizcas', 'pinch'], ['onza', 'oz'], ['onzas', 'oz'],
    ['libra', 'lb'], ['libras', 'lb'], ['pieza', 'piece'], ['piezas', 'piece'], ['unidad', 'piece'], ['unidades', 'piece'],
  ]),
  countNouns: nouns([
    ['diente', 'dientes'], ['rebanada', 'rebanadas'], ['loncha', 'lonchas'], ['rodaja', 'rodajas'], ['rama', 'ramas'],
    ['ramita', 'ramitas'], ['hoja', 'hojas'], ['lata', 'latas'], ['manojo', 'manojos'], ['cabeza', 'cabezas'], ['sobre', 'sobres'],
  ]),
  sizes: { pequeño: 'small', pequeña: 'small', mediano: 'medium', mediana: 'medium', grande: 'large' },
  one: ['un', 'una', 'uno'],
  of: ['de', 'del'],
  prep: [
    'finamente', 'picado', 'picada', 'picados', 'picadas', 'rallado', 'rallada', 'rallados', 'ralladas', 'cortado', 'cortada',
    'cortados', 'cortadas', 'pelado', 'pelada', 'pelados', 'peladas', 'derretido', 'derretida', 'fresco', 'fresca', 'en',
    'dados', 'rodajas', 'trozos', 'tiras', 'y', 'o', 'al', 'gusto', 'para', 'servir', 'opcional', 'un', 'poco', 'de', 'más',
  ],
};
