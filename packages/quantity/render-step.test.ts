import { expect, it } from 'vitest';
import { facts } from './catalog.fixture';
import { renderStep } from './render-step';
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
