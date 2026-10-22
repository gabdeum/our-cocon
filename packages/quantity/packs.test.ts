import { describe, expect, it } from 'vitest';
import { catalogEntries, facts, packsOf } from './catalog.fixture';
import { parsePackSize, pickPacks, sumNeeds, type StorePack } from './packs';

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
