import type { SizeWord, Unit } from '@cocon/schemas/recipes';

/**
 * Spec 015 FR-003: every English word the paste parser knows, in one place, so French can be added
 * as `words.fr.ts` with the same shape. Words are lower case.
 */
export interface ParserWords {
  /** Unit words and their unit ("tablespoons" → tbsp). Checked with a trailing "." removed. */
  units: Record<string, Unit>;
  /** Words that count pieces of something ("2 cloves garlic"): the unit is pieces, the noun is kept. */
  countNouns: Record<string, { singular: string; plural: string }>;
  sizes: Record<string, SizeWord>;
  /** Words that mean one ("a pinch of salt", "an egg"). */
  one: string[];
  /** Joins an amount to its name and is dropped ("2 cups of flour"). */
  of: string[];
  /** Preparation words: a comma part made only of these belongs to the line before it. */
  prep: string[];
}

const plural = (pairs: [string, Unit][]): Record<string, Unit> => Object.fromEntries(pairs);

export const en: ParserWords = {
  units: plural([
    ['g', 'g'], ['gr', 'g'], ['gram', 'g'], ['grams', 'g'], ['gramme', 'g'], ['grammes', 'g'],
    ['kg', 'kg'], ['kgs', 'kg'], ['kilo', 'kg'], ['kilos', 'kg'], ['kilogram', 'kg'], ['kilograms', 'kg'],
    ['ml', 'ml'], ['mls', 'ml'], ['millilitre', 'ml'], ['millilitres', 'ml'], ['milliliter', 'ml'], ['milliliters', 'ml'],
    ['l', 'l'], ['litre', 'l'], ['litres', 'l'], ['liter', 'l'], ['liters', 'l'],
    ['tsp', 'tsp'], ['tsps', 'tsp'], ['teaspoon', 'tsp'], ['teaspoons', 'tsp'],
    ['tbsp', 'tbsp'], ['tbsps', 'tbsp'], ['tbs', 'tbsp'], ['tablespoon', 'tbsp'], ['tablespoons', 'tbsp'],
    ['cup', 'cup'], ['cups', 'cup'],
    ['oz', 'oz'], ['ounce', 'oz'], ['ounces', 'oz'],
    ['lb', 'lb'], ['lbs', 'lb'], ['pound', 'lb'], ['pounds', 'lb'],
    ['pinch', 'pinch'], ['pinches', 'pinch'],
    ['piece', 'piece'], ['pieces', 'piece'], ['pc', 'piece'], ['pcs', 'piece'],
  ]),
  countNouns: Object.fromEntries(
    [
      ['clove', 'cloves'], ['slice', 'slices'], ['sprig', 'sprigs'], ['stalk', 'stalks'], ['sheet', 'sheets'],
      ['can', 'cans'], ['tin', 'tins'], ['bunch', 'bunches'], ['head', 'heads'], ['stick', 'sticks'],
    ].flatMap(([one, many]) => [
      [one as string, { singular: one as string, plural: many as string }],
      [many as string, { singular: one as string, plural: many as string }],
    ]),
  ),
  sizes: { small: 'small', medium: 'medium', large: 'large', big: 'large' },
  one: ['a', 'an', 'one'],
  of: ['of'],
  prep: [
    'finely', 'coarsely', 'roughly', 'thinly', 'thickly', 'freshly', 'lightly', 'and', 'or', 'chopped', 'diced', 'minced',
    'sliced', 'grated', 'shredded', 'crushed', 'cubed', 'halved', 'quartered', 'peeled', 'deseeded', 'seeded', 'cored',
    'pitted', 'trimmed', 'rinsed', 'drained', 'beaten', 'whisked', 'melted', 'softened', 'cold', 'warm', 'at', 'room',
    'temperature', 'to', 'taste', 'optional', 'for', 'serving', 'garnish', 'divided', 'cut', 'into', 'pieces', 'chunks',
    'cubes', 'wedges', 'rings', 'strips', 'torn', 'zested', 'juiced', 'ground', 'toasted', 'thawed', 'sifted', 'packed',
    'plus', 'extra', 'more', 'if', 'needed', 'small', 'large', 'thin', 'thick', 'bite', 'sized', 'size', 'cm', 'inch', 'in',
    'squeezed', 'washed', 'dried', 'fresh', 'a', 'the', 'some',
  ],
};
