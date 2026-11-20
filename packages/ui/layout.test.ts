import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import { gutterFor, layoutTier, splitColumns, useLayoutTier } from './layout';

const dims = vi.hoisted(() => ({ width: 390, height: 844, scale: 3, fontScale: 1 }));
vi.mock('react-native', async (actual) => ({ ...(await actual<typeof import('react-native')>()), useWindowDimensions: () => ({ ...dims }) }));

afterEach(() => {
  cleanup();
  dims.width = 390;
  dims.height = 844;
});

// SC-001: tiers by window width.
describe('layoutTier', () => {
  it.each([
    [320, 'compact'],
    [599, 'compact'],
    [600, 'medium'],
    [959, 'medium'],
    [960, 'expanded'],
    [1366, 'expanded'],
  ] as const)('%i px is %s', (width, tier) => {
    expect(layoutTier(width)).toBe(tier);
  });

  it('gives the 20 gutter on the phone and 24 from 600', () => {
    expect(gutterFor('compact')).toBe(20);
    expect(gutterFor('medium')).toBe(24);
    expect(gutterFor('expanded')).toBe(24);
  });
});

describe('useLayoutTier', () => {
  it('follows the window live, on rotation or resizing', () => {
    const { result, rerender } = renderHook(() => useLayoutTier());
    expect(result.current).toEqual({ tier: 'compact', width: 390, height: 844 });
    dims.width = 820;
    dims.height = 1180;
    rerender();
    expect(result.current).toEqual({ tier: 'medium', width: 820, height: 1180 });
    dims.width = 1180;
    dims.height = 820;
    rerender();
    expect(result.current.tier).toBe('expanded');
  });
});

// SC-002: two-column lists read by column, at about the same height.
describe('splitColumns', () => {
  const total = (col: number[]) => col.reduce((a, b) => a + b, 0);

  /** Smallest height difference any order-keeping two-column cut can reach. */
  function bestDiff(weights: number[]) {
    let best = Infinity;
    for (let cut = 1; cut <= weights.length; cut++) {
      best = Math.min(best, Math.abs(total(weights.slice(0, cut)) - total(weights.slice(cut))));
    }
    return best;
  }

  it('keeps the order: column 1 top to bottom, then column 2', () => {
    expect(splitColumns(['a', 'b', 'c', 'd', 'e'], 2)).toEqual([
      ['a', 'b', 'c'],
      ['d', 'e'],
    ]);
  });

  it('uses the weights so columns end at about the same height', () => {
    // An aisle with 6 rows, then four with 1 or 2.
    expect(splitColumns([6, 1, 2, 1, 2], 2, (w) => w)).toEqual([[6], [1, 2, 1, 2]]);
  });

  it('never leaves column 1 empty', () => {
    expect(splitColumns(['only'], 2)).toEqual([['only'], []]);
    expect(splitColumns([1, 50], 2, (w) => w)).toEqual([[1], [50]]);
    expect(splitColumns([50, 1], 2, (w) => w)).toEqual([[50], [1]]);
    expect(splitColumns([], 2)).toEqual([[], []]);
  });

  it('stays within one item of the best split, whatever the weights', () => {
    let seed = 7;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let run = 0; run < 300; run++) {
      const weights = Array.from({ length: 1 + Math.floor(random() * 12) }, () => 1 + Math.floor(random() * 9));
      const [one = [], two = []] = splitColumns(weights, 2, (w) => w);
      expect([...one, ...two]).toEqual(weights);
      expect(one.length).toBeGreaterThan(0);
      expect(Math.abs(total(one) - total(two))).toBeLessThanOrEqual(bestDiff(weights) + Math.max(...weights));
    }
  });

  it('splits into three columns the same way', () => {
    expect(splitColumns([1, 2, 3, 4, 5, 6, 7, 8, 9], 3)).toEqual([
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
    ]);
  });
});
