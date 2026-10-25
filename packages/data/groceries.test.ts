import { describe, expect, it } from 'vitest';
import type { PackPlan } from '@cocon/quantity';
import { buyText, combinedText, type GroceryWords } from './groceries';

// The app passes its strings file; the MCP server its own words (spec 024). The wording is theirs.
const words: GroceryWords = {
  pieces: (n) => `${n} pc`,
  packCount: (count, label) => `${count}x ${label}`,
  onePack: (label) => `a ${label}`,
  packsJoin: ' & ',
  loose: (amount) => `${amount} bulk`,
  needNote: (amount) => `[${amount}]`,
};

const pack = (label: string, size: number, loose = false) => ({ size, unit: 'ml' as const, label, loose });

describe('grocery wording comes from the caller', () => {
  it('packs read in its words', () => {
    const plan = { picks: [{ pack: pack('pint carton', 473), count: 2 }, { pack: pack('cup', 237), count: 1 }], loose: null, need: 1100, leftover: 83, approximate: false } as unknown as PackPlan;
    expect(buyText(plan, words)).toBe('2x pint carton & a cup');
  });

  it('pieces and amounts that don’t add up too', () => {
    expect(combinedText('Apple', [{ quantity: 3, unit: 'piece' }, { quantity: 200, unit: 'g' }], null, words)).toBe('3 pc & 200 g');
  });
});
