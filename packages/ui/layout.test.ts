import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import { POPOVER, gutterFor, layoutTier, navFor, popoverPlacement, railInset, sheetPresentation, splitColumns, tabBottomPad, useLayoutTier, useSheetPresentation } from './layout';

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

// Spec 064: the bar below 960, the rail from 960; content after the rail and no bar padding beside it.
describe('navigation by tier', () => {
  it.each([
    [959, 'bar', 0, 180],
    [960, 'rail', 104, 28],
  ] as const)('%i px: %s, content from %i, %i under it', (width, nav, inset, pad) => {
    const tier = layoutTier(width);
    expect(navFor(tier)).toBe(nav);
    expect(railInset(tier)).toBe(inset);
    expect(tabBottomPad(tier)).toBe(pad);
  });

  it('keeps the phone as today', () => {
    expect(navFor('compact')).toBe('bar');
    expect(railInset('compact')).toBe(0);
    expect(tabBottomPad('compact')).toBe(180);
  });
});

// Spec 065 FR-001: one sheet, three presentations by tier.
describe('sheetPresentation', () => {
  it.each([
    ['compact', 'menu', 'sheet'],
    ['compact', 'flow', 'sheet'],
    ['medium', 'menu', 'popover'],
    ['medium', 'flow', 'card'],
    ['expanded', 'menu', 'popover'],
    ['expanded', 'flow', 'card'],
  ] as const)('%s + %s is a %s', (tier, kind, out) => {
    expect(sheetPresentation(tier, kind)).toBe(out);
  });

  it('follows the window for events', () => {
    const { result, rerender } = renderHook(() => useSheetPresentation('menu'));
    expect(result.current).toBe('sheet');
    dims.width = 820;
    rerender();
    expect(result.current).toBe('popover');
  });
});

// Spec 065 FR-002 and SC-002: the popover under its anchor, the arrow on the anchor's centre.
describe('popoverPlacement', () => {
  // The arrow's centre in window coordinates: inside the 1.5 border, half its 14 width.
  const arrowCentre = (p: ReturnType<typeof popoverPlacement>) => p.left + POPOVER.border + p.arrowLeft + POPOVER.arrow / 2;

  it('opens 12 below the anchor with its right edge 16 from the window when the anchor is on the right', () => {
    // Cooking mode's Settings button at 820: 48 round, 20 from the right, 28 from the top.
    const p = popoverPlacement({ x: 752, y: 28, width: 48, height: 48 }, { width: 820, height: 1180 });
    expect(p.top).toBe(88);
    expect(p.left + p.width).toBe(820 - 16);
    expect(p.width).toBe(360);
    expect(p.above).toBe(false);
  });

  it("opens under the anchor's left edge when there is room", () => {
    const p = popoverPlacement({ x: 120, y: 200, width: 44, height: 44 }, { width: 1180, height: 820 });
    expect(p.left).toBe(120);
  });

  const sizes = [
    [390, 844],
    [600, 960],
    [744, 1133],
    [820, 1180],
    [1024, 768],
    [1180, 820],
  ] as const;
  const anchors = (w: number) => [16, w / 2 - 22, w - 16 - 44, w - 20 - 48, 300];
  it.each(sizes)('centres the arrow on the anchor within 1 px at %i × %i', (width, height) => {
    for (const x of anchors(width)) {
      for (const size of [40, 44, 48]) {
        const p = popoverPlacement({ x, y: 100, width: size, height: size }, { width, height });
        expect(Math.abs(arrowCentre(p) - (x + size / 2))).toBeLessThanOrEqual(1);
      }
    }
  });

  it('opens above when it is taller than the room below and there is more above', () => {
    const anchor = { x: 760, y: 1000, width: 44, height: 44 };
    const p = popoverPlacement(anchor, { width: 820, height: 1180 }, 330);
    expect(p.above).toBe(true);
    expect(p.top).toBe(1000 - 12 - 330);
    expect(Math.abs(arrowCentre(p) - 782)).toBeLessThanOrEqual(1);
    // Short enough, it stays below.
    expect(popoverPlacement(anchor, { width: 820, height: 1180 }, 100).above).toBe(false);
  });

  it('is never wider than the window less 16 on each side', () => {
    expect(popoverPlacement({ x: 300, y: 40, width: 44, height: 44 }, { width: 360, height: 700 }).width).toBe(328);
  });
});
