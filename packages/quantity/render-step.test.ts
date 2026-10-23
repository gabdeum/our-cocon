import { describe, expect, it } from 'vitest';
import { facts } from './catalog.fixture';
import { ingredientToken, renderStep, renderTemperatureCheck, temperatureToken } from './render-step';
import type { QuantityIngredient } from './types';

const leek: QuantityIngredient = {
  id: '6f1c3a52-0d7e-4e43-9f0a-1d2b3c4d5e6f',
  name: 'Leeks',
  quantity: 2,
  unit: 'piece',
  weight_per_piece_g: 150,
  piece_noun_singular: 'leek',
  piece_noun_plural: 'leeks',
  facts: facts('leek'),
};
const onion: QuantityIngredient = {
  id: 'onion-1',
  name: 'Onion',
  quantity: 1,
  unit: 'piece',
  size_word: 'small',
  weight_per_piece_g: 70,
  piece_noun_singular: 'onion',
  piece_noun_plural: 'onions',
  facts: facts('onion'),
};
const options = { system: 'metric', scale: true } as const;
const plain = (segments: ReturnType<typeof renderStep>) => segments.map((s) => (s.type === 'missing' ? '?' : s.text)).join('');

it('US3: fills tokens with the ingredient phrase, marked for highlight', () => {
  const segments = renderStep(`Add {ing:${leek.id}} finely sliced`, [leek, onion], options);
  expect(segments).toEqual([
    { type: 'text', text: 'Add ' },
    { type: 'amount', text: '2 leeks (300 g)', ingredientId: leek.id },
    { type: 'text', text: ' finely sliced' },
  ]);
  expect(plain(renderStep('Add {ing:onion-1} finely chopped', [leek, onion], options))).toBe('Add 1 small onion (70 g) finely chopped');
});

it('handles tokens back to back, at the edges, and plain text', () => {
  expect(renderStep('{ing:onion-1}{ing:onion-1}', [onion], options).map((s) => s.type)).toEqual(['amount', 'amount']);
  expect(renderStep('Rest for 10 minutes.', [], options)).toEqual([{ type: 'text', text: 'Rest for 10 minutes.' }]);
  expect(renderStep('', [], options)).toEqual([]);
});

it('marks a token whose ingredient was deleted', () => {
  expect(renderStep('Add {ing:gone} now', [leek], options)).toEqual([
    { type: 'text', text: 'Add ' },
    { type: 'missing', ingredientId: 'gone' },
    { type: 'text', text: ' now' },
  ]);
});

it('follows the units and the kitchen scale', () => {
  expect(plain(renderStep(`Add {ing:${leek.id}}`, [leek], { system: 'imperial', scale: true }))).toBe('Add 2 leeks (10.6 oz)');
  expect(plain(renderStep(`Add {ing:${leek.id}}`, [leek], { system: 'metric', scale: false }))).toBe('Add 2 leeks');
});

describe('temperature tokens', () => {
  it('shows oven temperatures in both scales, the person\'s first', () => {
    const body = `Preheat the oven to ${temperatureToken(180)}. Line the pan with ${ingredientToken(leek.id)}.`;
    expect(body).toBe(`Preheat the oven to {temp:180}. Line the pan with {ing:${leek.id}}.`);
    expect(renderStep(body, [leek], options)).toEqual([
      { type: 'text', text: 'Preheat the oven to 180 °C (350 °F). Line the pan with ' },
      { type: 'amount', text: '2 leeks (300 g)', ingredientId: leek.id },
      { type: 'text', text: '.' },
    ]);
    expect(plain(renderStep('Bake at {temp:200}', [], { system: 'imperial', scale: true }))).toBe('Bake at 400 °F (200 °C)');
  });

  it('rounds thermometer readings to 5 °F', () => {
    expect(temperatureToken(71, 'food')).toBe('{temp:71:food}');
    expect(plain(renderStep('Cook until it reaches {temp:71:food}.', [], options))).toBe('Cook until it reaches 71 °C (160 °F).');
    expect(plain(renderStep('Heat the sugar to {temp:115:food}', [], { system: 'imperial', scale: true }))).toBe('Heat the sugar to 240 °F (115 °C)');
  });

  it('keeps a decimal and leaves a broken token as written', () => {
    expect(temperatureToken(176.6667)).toBe('{temp:176.7}');
    expect(plain(renderStep('Oven at {temp:hot}', [], options))).toBe('Oven at {temp:hot}');
  });
});

describe('renderTemperatureCheck (spec 009 FR-003)', () => {
  it('US2: puts the reading where {temp} is, in both scales', () => {
    expect(renderTemperatureCheck('the center should reach {temp} and barely wobble.', 71, 'metric')).toBe('the center should reach 71 °C (160 °F) and barely wobble.');
    expect(renderTemperatureCheck('the center should reach {temp} and barely wobble.', 71, 'imperial')).toBe('the center should reach 160 °F (71 °C) and barely wobble.');
  });

  it('puts the reading after the text when there is no {temp}', () => {
    expect(renderTemperatureCheck('center reaches', 71, 'metric')).toBe('center reaches 71 °C (160 °F)');
  });

  it('shows whichever half the step has, or nothing', () => {
    expect(renderTemperatureCheck(null, 71, 'metric')).toBe('71 °C (160 °F)');
    expect(renderTemperatureCheck('  ', 71, 'metric')).toBe('71 °C (160 °F)');
    expect(renderTemperatureCheck('Until golden.', null, 'metric')).toBe('Until golden.');
    expect(renderTemperatureCheck(null, null, 'metric')).toBeNull();
  });
});

describe('names and notes in steps', () => {
  const garlic: QuantityIngredient = { id: 'g', name: 'Garlic (sauce), crushed', quantity: 10, unit: 'g' };

  it('reads the name without its bracket, and the note after the amount', () => {
    expect(plain(renderStep(`Add ${ingredientToken('g')}.`, [garlic], options))).toBe('Add 10 g garlic, crushed.');
  });

  it('takes the row’s prep note first', () => {
    const sliced = { ...onion, name: 'Onion (topping)', prep_note: 'thinly sliced' };
    expect(plain(renderStep(`Scatter ${ingredientToken('onion-1')}.`, [sliced], options))).toBe('Scatter 1 small onion (70 g), thinly sliced.');
  });
});
