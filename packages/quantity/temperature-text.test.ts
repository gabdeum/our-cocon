import { expect, it } from 'vitest';
import { renderStep } from './render-step';
import { tokenizeTemperatures } from './temperature-text';

it.each([
  ['Bake at 180 °C for 35 minutes.', 'Bake at {temp:180} for 35 minutes.'],
  ['Bake at 180°C.', 'Bake at {temp:180}.'],
  ['Bake at 180C.', 'Bake at {temp:180}.'],
  ['Bake at 180 ° c.', 'Bake at {temp:180}.'],
  ['Heat to 350°F', 'Heat to {temp:176.7}'],
  ['Heat to 350F, then 400 °F.', 'Heat to {temp:176.7}, then {temp:204.4}.'],
  ['Cook sugar to 115ºC', 'Cook sugar to {temp:115}'],
  ['Oven at 37,5 °C', 'Oven at {temp:37.5}'],
])('%s → %s', (typed, stored) => {
  expect(tokenizeTemperatures(typed)).toBe(stored);
});

it.each([
  'Add 2 C of flour', // could be cups
  'Add 2 c flour',
  'About 180Cal a slice',
  'Use a 20 cm tin',
  'Grade 9F pencil',
  'Heat to 900 °C', // no oven goes that high
  'Bake at {temp:180} with {ing:00000000-0000-4000-8000-0000000000a1}',
])('leaves "%s" alone', (text) => {
  expect(tokenizeTemperatures(text)).toBe(text);
});

it('every reader sees both scales once stored', () => {
  const segments = renderStep(tokenizeTemperatures('Heat to 350°F.'), [], { system: 'metric', scale: true });
  expect(segments).toEqual([{ type: 'text', text: 'Heat to 177 °C (350 °F).' }]);
});
