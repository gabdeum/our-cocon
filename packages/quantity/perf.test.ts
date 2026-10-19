import { expect, it } from 'vitest';
import { facts } from './catalog.fixture';
import { format } from './format';
import type { QuantityIngredient } from './types';

it('SC-002: formats 100 ingredients in under 5 ms', () => {
  const onion = facts('onion');
  const butter = facts('butter');
  const kinds: QuantityIngredient[] = [
    { id: 'a', name: 'Onion', quantity: 95, unit: 'g', facts: onion },
    { id: 'b', name: 'Butter', quantity: 20, unit: 'g', facts: butter },
    { id: 'c', name: 'Leeks', quantity: 2.5, unit: 'piece', weight_per_piece_g: 150, facts: facts('leek') },
    { id: 'd', name: 'Heavy cream', quantity: 300, unit: 'ml' },
    { id: 'e', name: 'Nutmeg', quantity: 1, unit: 'pinch' },
  ];
  const list = Array.from({ length: 100 }, (_, i) => kinds[i % kinds.length] as QuantityIngredient);
  const run = (system: 'metric' | 'imperial') => list.forEach((i) => format(i, { system, scale: system === 'metric' }));
  for (let i = 0; i < 20; i += 1) run('metric');
  const times = Array.from({ length: 9 }, (_, i) => {
    const start = performance.now();
    run(i % 2 ? 'imperial' : 'metric');
    return performance.now() - start;
  }).sort((a, b) => a - b);
  expect(times[4]).toBeLessThan(5);
});
