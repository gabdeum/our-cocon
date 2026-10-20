import { describe, expect, it } from 'vitest';
import { quiche } from '@cocon/schemas/quiche.fixture';
import { noVariants } from '@cocon/schemas';
import { converterView, recipeIngredient } from './converter-view';
import { defaultPanelChoices, type RecipeChoices } from './recipe-choices';

const recipe = {
  ...quiche,
  ingredients: quiche.ingredients.map((i) => ({ ...i, catalog_key: i.name === 'Heavy cream' ? 'heavy_cream' : null })),
  facts: { heavy_cream: { density_g_per_ml: 1 } },
};
const choices: RecipeChoices = { servings: 6, ...noVariants, ...defaultPanelChoices, scaledBy: null };
const cream = { name: 'Heavy cream', density: 1 };

describe('converterView (US3)', () => {
  it('300 ml: 1¼ cups, 20 tablespoons, 61 teaspoons, 10.1 fl oz, and the cream note', () => {
    const view = converterView(300, 'ml', cream);
    expect(view.tiles.map((t) => `${t.value} ${t.label}`)).toEqual(['1¼ cups', '20 tablespoons', '61 teaspoons', '10.1 fl oz (US)']);
    expect(view.forRecipe).toBe("300 ml heavy cream weighs about 300 g. Handy if you'd rather weigh it on your scale.");
  });

  it('singular up to one: ¾ cup, 1 tablespoon', () => {
    expect(converterView(180, 'ml', null).tiles[0]).toMatchObject({ value: '¾', label: 'cup' });
    expect(converterView(15, 'ml', null).tiles[1]).toMatchObject({ value: '1', label: 'tablespoon' });
  });

  it('weight: cups of the ingredient, and the other way round in the note', () => {
    const view = converterView(240, 'g', cream);
    expect(view.tiles.at(-1)).toEqual({ unit: 'cups_of', value: '1', label: 'cup of heavy cream' });
    expect(view.forRecipe).toBe("240 g heavy cream is about 1 cup. Handy if you'd rather use cups.");
  });

  it('oven: no recipe note; nothing at all without a number', () => {
    expect(converterView(180, 'c', null)).toEqual({
      tiles: [
        { unit: 'f', value: '350', label: '°F' },
        { unit: 'gas_mark', value: '4', label: 'gas mark' },
        { unit: 'fan_c', value: '160', label: '°C fan oven' },
        { unit: 'fan_f', value: '325', label: '°F fan oven' },
      ],
      forRecipe: null,
    });
    expect(converterView(null, 'ml', cream)).toEqual({ tiles: [], forRecipe: null });
  });

  it('no matching ingredient: no recipe note, and 3 weight tiles', () => {
    expect(converterView(300, 'ml', null).forRecipe).toBeNull();
    const weight = converterView(200, 'g', null);
    expect(weight.tiles.map((t) => t.unit)).toEqual(['kg', 'oz', 'lb']);
    expect(weight.forRecipe).toBeNull();
  });
});

describe('recipeIngredient', () => {
  it('picks the first ingredient of the tab’s kind with a density, none for the oven', () => {
    expect(recipeIngredient(recipe, choices, 'volume')?.name).toBe('Heavy cream');
    expect(recipeIngredient(recipe, choices, 'weight')).toBeNull();
    expect(recipeIngredient(recipe, choices, 'oven')).toBeNull();
  });
});
