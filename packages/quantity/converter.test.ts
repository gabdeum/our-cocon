import { describe, expect, it } from 'vitest';
import { facts } from './catalog.fixture';
import { events } from '@cocon/schemas';
import { CONVERTER_UNITS, convertUnits, densityHint, gasMark, tabOf } from './converter';
import { QuantityError } from './errors';

const tiles = (r: ReturnType<typeof convertUnits>) => r.map((t) => [t.unit, t.text]);

describe('convertUnits (spec 013 FR-004/005)', () => {
  it('US3: 300 ml is 1¼ cups, 20 tbsp, 61 tsp and 10.1 fl oz', () => {
    expect(tiles(convertUnits(300, 'ml'))).toEqual([
      ['cup', '1¼'],
      ['tbsp', '20'],
      ['tsp', '61'],
      ['fl_oz', '10.1'],
    ]);
  });

  it('never shows the unit typed in, and fills up with ml', () => {
    expect(tiles(convertUnits(1, 'cup'))).toEqual([
      ['tbsp', '16'],
      ['tsp', '48'],
      ['fl_oz', '8'],
      ['ml', '237'],
    ]);
  });

  it('small spoons read to the nearest ½, tiny cups as decimals', () => {
    expect(tiles(convertUnits(10, 'ml'))).toEqual([
      ['cup', '0.04'],
      ['tbsp', '½'],
      ['tsp', '2'],
      ['fl_oz', '0.3'],
    ]);
  });

  it('weight: g, oz, lb, and cups of the ingredient when its density is known', () => {
    expect(tiles(convertUnits(200, 'g', facts('heavy_cream').density_g_per_ml))).toEqual([
      ['kg', '0.2'],
      ['oz', '7.1'],
      ['lb', '0.44'],
      ['cups_of', '¾'],
    ]);
    expect(tiles(convertUnits(1, 'lb'))).toEqual([
      ['g', '454'],
      ['oz', '16'],
    ]);
    expect(tiles(convertUnits(2.5, 'lb'))[0]).toEqual(['kg', '1.13']);
  });

  it('oven: the other two scales, then a fan oven 20 °C lower', () => {
    expect(tiles(convertUnits(180, 'c'))).toEqual([
      ['f', '350'],
      ['gas_mark', '4'],
      ['fan_c', '160'],
      ['fan_f', '325'],
    ]);
    expect(tiles(convertUnits(425, 'f')).slice(0, 2)).toEqual([
      ['c', '220'],
      ['gas_mark', '7'],
    ]);
    expect(tiles(convertUnits(0.5, 'gas_mark')).slice(0, 2)).toEqual([
      ['c', '120'],
      ['f', '250'],
    ]);
  });

  it('matches spec 005: 180 °C reads 350 °F like a recipe step', () => {
    expect(convertUnits(180, 'c')[0]?.value).toBe(350);
  });

  it('rejects amounts that are not numbers or below 0', () => {
    expect(() => convertUnits(-1, 'ml')).toThrow(QuantityError);
    expect(() => convertUnits(Number.NaN, 'g')).toThrow(QuantityError);
  });
});

describe('gasMark', () => {
  it('picks the nearest mark', () => {
    expect([100, 140, 165, 200, 260].map(gasMark)).toEqual([0.25, 1, 3, 6, 9]);
  });
});

describe('tabOf', () => {
  it('finds the tab of each unit', () => {
    expect([tabOf('fl_oz'), tabOf('lb'), tabOf('gas_mark')]).toEqual(['volume', 'weight', 'oven']);
  });
});

describe('densityHint (For this recipe)', () => {
  it('US3: 300 ml heavy cream weighs about 300 g', () => {
    expect(densityHint(300, 'ml', facts('heavy_cream').density_g_per_ml as number)).toEqual({ unit: 'g', value: 300, text: '300' });
  });

  it('a weight reads as cups, and big weights as kg', () => {
    expect(densityHint(118, 'g', 0.5)?.text).toBe('1');
    expect(densityHint(2, 'l', 1)).toEqual({ unit: 'kg', value: 2, text: '2' });
  });

  it('nothing for oven temperatures, 0 or a missing density', () => {
    expect(densityHint(180, 'c', 1)).toBeNull();
    expect(densityHint(0, 'ml', 1)).toBeNull();
    expect(densityHint(10, 'ml', 0)).toBeNull();
  });
});

describe('the unit_converter_used event', () => {
  it('lists the same units as the converter (schemas cannot import this package)', () => {
    const units = events.unit_converter_used.shape;
    expect(units.from_unit.options).toEqual(Object.values(CONVERTER_UNITS).flat());
    expect(units.to_unit.options).toEqual([...Object.values(CONVERTER_UNITS).flat(), 'cups_of', 'fan_c', 'fan_f']);
  });
});
