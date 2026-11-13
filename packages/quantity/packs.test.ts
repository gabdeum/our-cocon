import { describe, expect, it } from 'vitest';
import { catalogEntries, facts, packsOf } from './catalog.fixture';
import { parsePackSize, pickPacks, storeAmount, sumNeeds, type StorePack } from './packs';
import { GRAMS_PER, ML_PER } from './units';

const labels = (plan: ReturnType<typeof pickPacks>) => plan?.picks.map((p) => [p.count, p.pack.label]);

describe('pickPacks (spec 021 FR-003)', () => {
  it('US1: 300 ml cream is a pint carton in the US, about 170 ml left over', () => {
    const plan = pickPacks({ quantity: 300, unit: 'ml' }, packsOf('heavy_cream', 'us'), facts('heavy_cream'), 'us');
    expect(labels(plan)).toEqual([[1, '1 pint carton']]);
    expect(plan?.leftover).toBeCloseTo(173);
    expect(plan?.approximate).toBe(true);
  });

  it('US1: and 2 × 20 cl in Europe, 100 ml left over, exactly', () => {
    const plan = pickPacks({ quantity: 300, unit: 'ml' }, packsOf('heavy_cream', 'eu'), facts('heavy_cream'), 'eu');
    expect(labels(plan)).toEqual([[2, '20 cl']]);
    expect(plan?.leftover).toBe(100);
    expect(plan?.approximate).toBe(false);
  });

  it('picks the fewest packs when two combinations leave the same', () => {
    const packs: StorePack[] = [
      { size: 100, unit: 'g', label: '100 g', loose: false },
      { size: 200, unit: 'g', label: '200 g', loose: false },
    ];
    expect(labels(pickPacks({ quantity: 400, unit: 'g' }, packs, null, 'eu'))).toEqual([[2, '200 g']]);
  });

  it('mixes sizes to leave less', () => {
    const packs: StorePack[] = [
      { size: 500, unit: 'ml', label: '50 cl', loose: false },
      { size: 200, unit: 'ml', label: '20 cl', loose: false },
    ];
    expect(labels(pickPacks({ quantity: 700, unit: 'ml' }, packs, null, 'eu'))).toEqual([
      [1, '50 cl'],
      [1, '20 cl'],
    ]);
  });

  it('buys loose by weight exactly, and one by one in whole pieces', () => {
    const pumpkin = pickPacks({ quantity: 1, unit: 'kg' }, packsOf('pumpkin', 'eu'), facts('pumpkin'), 'eu');
    expect(pumpkin?.loose).toMatchObject({ amount: 1000, kind: 'weight' });
    expect(pumpkin?.leftover).toBe(0);
    const apples = pickPacks({ quantity: 6, unit: null }, packsOf('apple', 'eu'), facts('apple'), 'eu');
    expect(labels(apples)).toEqual([[6, 'each']]);
    expect(apples?.leftover).toBe(0);
  });

  it('converts through the piece weight when the store sells by weight or by the piece', () => {
    // 1 kg of pumpkin, sold whole in the US: one pumpkin (1.5 kg), about 500 g left over.
    const plan = pickPacks({ quantity: 1, unit: 'kg' }, packsOf('pumpkin', 'us'), facts('pumpkin'), 'us');
    expect(labels(plan)).toEqual([[1, 'each']]);
    expect(plan?.leftover).toBeCloseTo(500);
    expect(plan?.approximate).toBe(true);
  });

  it('spec 052: tuna steaks are bought by weight, loose, in pounds in the US', () => {
    // 2 steaks of 170 g: 340 g loose, not a pack counted in steaks.
    const plan = pickPacks({ quantity: 2, unit: null }, packsOf('tuna_steak', 'us'), facts('tuna_steak'), 'us');
    expect(plan?.loose).toMatchObject({ amount: 340, kind: 'weight' });
    expect(plan?.picks).toEqual([]);
  });

  it('gives nothing without an amount, without packs, or when no pack converts', () => {
    expect(pickPacks({ quantity: 1, unit: 'pinch' }, packsOf('salt', 'eu'), facts('salt'), 'eu')).toBeNull();
    expect(pickPacks({ quantity: 300, unit: 'ml' }, [], null, 'eu')).toBeNull();
    // Grams of something with no density, sold by the litre.
    expect(pickPacks({ quantity: 300, unit: 'g' }, [{ size: 1, unit: 'l', label: '1 l', loose: false }], null, 'eu')).toBeNull();
  });
});

describe('sumNeeds (FR-002)', () => {
  it('sums in base units, in the first amount kind', () => {
    expect(sumNeeds([{ quantity: 200, unit: 'ml' }, { quantity: 0.1, unit: 'l' }], facts('heavy_cream'))).toEqual({ quantity: 300, kind: 'volume' });
    expect(sumNeeds([{ quantity: 2, unit: null }, { quantity: 182, unit: 'g' }], facts('apple'))).toEqual({ quantity: 3, kind: 'piece' });
    expect(sumNeeds([{ quantity: 2, unit: null }, { quantity: 1, unit: 'cup' }], null)).toBeNull();
  });
});

describe('SC-001: Buy is never less than Need', () => {
  const amounts = [0.3, 1, 2.5, 7, 13, 99.5, 250, 333, 1001, 4800];
  const units = [null, 'g', 'kg', 'oz', 'lb', 'ml', 'l', 'cup', 'tbsp'] as const;
  it('for every catalog item, store and amount', () => {
    let checked = 0;
    for (const entry of catalogEntries) {
      for (const profile of ['us', 'eu'] as const) {
        const packs = entry.packs?.[profile] ?? [];
        for (const unit of units) {
          for (const quantity of amounts) {
            const plan = pickPacks({ quantity, unit }, packs, facts(entry.key), profile);
            if (!plan) continue;
            checked++;
            const bought = plan.loose ? plan.bought : plan.picks.reduce((sum, p) => sum + p.count, 0);
            expect(bought, `${entry.key} ${profile} ${quantity} ${unit}`).toBeGreaterThan(0);
            expect(plan.bought, `${entry.key} ${profile} ${quantity} ${unit}`).toBeGreaterThanOrEqual(plan.need - 1e-9);
            expect(plan.leftover).toBeGreaterThanOrEqual(0);
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(5000);
  }, 30_000);
});

describe('parsePackSize (FR-004)', () => {
  it('reads one amount and a unit, store measures included', () => {
    expect(parsePackSize('250 g')).toEqual({ size: 250, unit: 'g' });
    expect(parsePackSize('20 cl')).toEqual({ size: 200, unit: 'ml' });
    expect(parsePackSize('1 pint')).toEqual({ size: 473.18, unit: 'ml' });
    expect(parsePackSize('1.5 kg')).toEqual({ size: 1.5, unit: 'kg' });
    expect(parsePackSize('6')).toEqual({ size: 6, unit: 'piece' });
  });

  it('refuses anything else', () => {
    expect(parsePackSize('')).toBeNull();
    expect(parsePackSize('a bag')).toBeNull();
    expect(parsePackSize('2 tbsp')).toBeNull();
    expect(parsePackSize('250 g of cheese')).toBeNull();
    expect(parsePackSize('0 g')).toBeNull();
  });
});

describe('storeAmount (spec 052 FR-004, FR-005)', () => {
  it.each([
    // US2: Za'atar 50 g, Guanciale 400 g, Gochujang 3 tbsp, Banana leaves 4.
    [50, 'g', 'us', '2 oz'],
    [400, 'g', 'us', '1 lb'],
    [400, 'g', 'eu', '400 g'],
    [3, 'tbsp', 'us', '2 fl oz'],
    [3, 'tbsp', 'eu', '50 ml'],
    [4, null, 'us', null],
    [1, 'pinch', 'eu', null],
    // The boundaries.
    [1, 'g', 'us', '1 oz'],
    [3.9, 'oz', 'us', '¼ lb'],
    [4, 'oz', 'us', '¼ lb'],
    [600, 'g', 'us', '1½ lb'],
    [99, 'g', 'eu', '100 g'],
    [100, 'g', 'eu', '100 g'],
    [101, 'g', 'eu', '150 g'],
    [1, 'kg', 'eu', '1 kg'],
    [1250, 'g', 'eu', '1.3 kg'],
    [31 * 29.5735295625, 'ml', 'us', '31 fl oz'],
    [32 * 29.5735295625, 'ml', 'us', '1 qt'],
    [1.1, 'l', 'us', '1½ qt'],
    [999, 'ml', 'eu', '1 L'],
    [1.1, 'l', 'eu', '1.25 L'],
  ] as const)('%s %s in a %s store → %s', (quantity, unit, profile, text) => {
    expect(storeAmount({ quantity, unit }, profile)).toBe(text);
  });

  it('converts without steps when round-up is off', () => {
    expect(storeAmount({ quantity: 50, unit: 'g' }, 'us', false)).toBe('1.8 oz');
    expect(storeAmount({ quantity: 3, unit: 'tbsp' }, 'eu', false)).toBe('44.4 ml');
  });

  it('SC-002: never less than the need', () => {
    const per: Record<string, number> = { oz: GRAMS_PER.oz, lb: GRAMS_PER.lb, g: 1, kg: 1000, 'fl oz': 29.5735295625, qt: 946.352946, ml: 1, L: 1000 };
    const value = (text: string) => {
      const [, n, unit] = /^([\d.¼½¾]+) (.+)$/.exec(text) ?? [];
      const number = (n ?? '').replace('¼', '.25').replace('½', '.5').replace('¾', '.75').replace(/^\./, '0.');
      return Number(number) * (per[unit ?? ''] ?? NaN);
    };
    for (const unit of ['g', 'kg', 'oz', 'lb', 'ml', 'l', 'tsp', 'tbsp', 'cup'] as const) {
      const base = unit in GRAMS_PER ? GRAMS_PER[unit as keyof typeof GRAMS_PER] : ML_PER[unit as keyof typeof ML_PER];
      for (const quantity of [0.3, 1, 2.5, 3.9, 4, 7, 13, 31, 32, 99, 99.5, 100, 250, 333, 999, 1000, 1001, 4800]) {
        for (const profile of ['us', 'eu'] as const) {
          const text = storeAmount({ quantity, unit }, profile) as string;
          expect(value(text), `${quantity} ${unit} ${profile}: ${text}`).toBeGreaterThanOrEqual(quantity * base - 1e-6);
        }
      }
    }
  });
});
