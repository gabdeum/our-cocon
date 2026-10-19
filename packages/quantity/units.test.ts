import type { Unit } from '@cocon/schemas/recipes';
import { describe, expect, it } from 'vitest';
import { QuantityError } from './errors';
import { cToF, convert, fToC, kindOf } from './units';

const UNITS: Unit[] = ['g', 'kg', 'oz', 'lb', 'ml', 'l', 'tsp', 'tbsp', 'cup', 'piece', 'pinch'];

describe('convert, known values', () => {
  it.each([
    [1, 'kg', 'g', 1000],
    [1, 'lb', 'oz', 16],
    [1, 'oz', 'g', 28.3495],
    [1, 'lb', 'g', 453.592],
    [1, 'l', 'ml', 1000],
    [1, 'cup', 'ml', 236.588],
    [1, 'cup', 'tbsp', 16],
    [1, 'tbsp', 'tsp', 3],
    [1, 'tsp', 'ml', 4.9289],
    [300, 'ml', 'cup', 1.268],
    [3, 'piece', 'piece', 3],
    [2, 'pinch', 'pinch', 2],
  ] as [number, Unit, Unit, number][])('%d %s = %d %s', (value, from, to, expected) => {
    expect(convert(value, from, to)).toBeCloseTo(expected, 3);
  });

  it('weighs a volume with a density, and back', () => {
    expect(convert(1, 'cup', 'g', 0.48)).toBeCloseTo(113.56, 2);
    expect(convert(100, 'g', 'ml', 0.48)).toBeCloseTo(208.33, 2);
  });
});

describe('convert, every unit pair', () => {
  const pairs = UNITS.flatMap((from) => UNITS.map((to) => [from, to] as const));

  it.each(pairs)('%s → %s', (from, to) => {
    const a = kindOf(from);
    const b = kindOf(to);
    const sameMeasure = a === b && (a === 'weight' || a === 'volume');
    const crossMeasure = (a === 'weight' && b === 'volume') || (a === 'volume' && b === 'weight');
    if (from === to || sameMeasure) {
      expect(convert(convert(7, from, to), to, from)).toBeCloseTo(7, 9);
    } else if (crossMeasure) {
      expect(convert(convert(7, from, to, 0.68), to, from, 0.68)).toBeCloseTo(7, 9);
      // FR-008: without a density there's no weight↔volume conversion.
      expect(() => convert(7, from, to)).toThrow(QuantityError);
      expect(() => convert(7, from, to, 0)).toThrow(QuantityError);
    } else {
      expect(() => convert(7, from, to, 1)).toThrow(expect.objectContaining({ code: 'incompatible_units' }));
    }
  });
});

it('rejects amounts that are not numbers of zero or more', () => {
  for (const bad of [-1, Number.NaN, Infinity]) expect(() => convert(bad, 'g', 'oz')).toThrow(expect.objectContaining({ code: 'invalid_quantity' }));
});

it('converts temperatures', () => {
  expect(cToF(180)).toBe(356);
  expect(fToC(350)).toBeCloseTo(176.67, 2);
  expect(fToC(cToF(71))).toBeCloseTo(71, 9);
});
