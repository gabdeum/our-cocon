import { describe, expect, it } from 'vitest';
import { scalingAmountIn } from './scaling-amounts';

describe('scalingAmountIn (spec 023 FR-004)', () => {
  it.each([
    ['You will need about 20g of it.', '20g'],
    ['Reserve 100 ml of the cooking water.', '100 ml'],
    ['need 3 g', '3 g'],
    ['Add 1½ tbsp of oil.', '1½ tbsp'],
    ['Stir in 2 tablespoons more.', '2 tablespoons'],
    ['Pour in ½ cup.', '½ cup'],
  ])('%s → %s', (text, amount) => {
    expect(scalingAmountIn(text)).toBe(amount);
  });

  it.each([
    'Add 2 spoons per serving.',
    'Allow 100 g of pasta per person.',
    'Use a 2 l pot.',
    'Bring a 3 litre saucepan of water to the boil.',
    'Bake for 25 minutes at {temp:180}.',
    'Cut into 2 cm pieces.',
    'Add 2 large onions.',
    'Chinese 5 spice',
    'Serves 4 people',
  ])('%s → none', (text) => {
    expect(scalingAmountIn(text)).toBeNull();
  });
});
