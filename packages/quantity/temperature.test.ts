import { expect, it } from 'vitest';
import { formatTemperature } from './temperature';

it.each([
  [180, 'oven', 'metric', '180 °C (350 °F)'],
  [180, 'oven', 'imperial', '350 °F (180 °C)'],
  [160, 'oven', 'metric', '160 °C (325 °F)'],
  [200, 'oven', 'metric', '200 °C (400 °F)'],
  [220, 'oven', 'imperial', '425 °F (220 °C)'],
  [71, 'food', 'metric', '71 °C (160 °F)'],
  [63, 'food', 'imperial', '145 °F (63 °C)'],
  [74.4, 'food', 'metric', '74 °C (165 °F)'],
] as const)('%d °C, %s, %s → %s', (c, kind, system, expected) => {
  expect(formatTemperature(c, { system, kind })).toBe(expected);
});

it('rejects a temperature that is not a number', () => {
  expect(() => formatTemperature(Number.NaN, { system: 'metric', kind: 'oven' })).toThrow(expect.objectContaining({ code: 'invalid_quantity' }));
});
