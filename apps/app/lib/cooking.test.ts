// Spec 012: cooking mode's scroll rules (US1, FR-004) and where it opens (032-later L19).
import { describe, expect, it } from 'vitest';
import { quiche } from '@cocon/schemas/quiche.fixture';
import { cookingMinutes, currentStep, scrollTarget, startIndex, stepStillThere } from './cooking';

describe('currentStep (US1 › 2)', () => {
  const tops = [0, 520, 1040, 1560];
  it('is the last step whose top is above 35% of the scroll area', () => {
    expect(currentStep(tops, 0, 800)).toBe(0);
    // 520 − 300 = 220 < 280 (35% of 800): step 2 is current.
    expect(currentStep(tops, 300, 800)).toBe(1);
    // 520 − 230 = 290: not yet.
    expect(currentStep(tops, 230, 800)).toBe(0);
    expect(currentStep(tops, 1500, 800)).toBe(3);
  });
  it('ignores steps not measured yet', () => {
    expect(currentStep([0, Number.POSITIVE_INFINITY], 400, 800)).toBe(0);
  });
});

describe('scrollTarget', () => {
  it("lands 8 above a step's top, never above the start", () => {
    expect(scrollTarget(520)).toBe(512);
    expect(scrollTarget(0)).toBe(0);
  });
});

describe('cookingMinutes', () => {
  it('rounds to whole minutes, at most a day', () => {
    expect(cookingMinutes(0, 42 * 60_000 + 20_000)).toBe(42);
    expect(cookingMinutes(0, 3 * 86_400_000)).toBe(1440);
    expect(cookingMinutes(10, 0)).toBe(0);
  });
});

describe('startIndex', () => {
  it('opens at the given step, or step 1 when it is unknown', () => {
    expect(startIndex(['a', 'b', 'c'], 'c')).toBe(2);
    expect(startIndex(['a', 'b', 'c'], 'gone')).toBe(0);
    expect(startIndex(['a', 'b', 'c'], undefined)).toBe(0);
  });
});

describe('stepStillThere (L19)', () => {
  const recipe = { deleted_at: null, steps: quiche.steps, variants: quiche.variants };
  it("finds the recipe's own steps and steps a variant adds", () => {
    expect(stepStillThere(recipe, (quiche.steps[0]?.id ?? ''))).toBe(true);
    const adder = quiche.variants.find((v) => v.changes.some((c) => c.type === 'add_step'));
    if (adder) {
      const i = adder.changes.findIndex((c) => c.type === 'add_step');
      expect(stepStillThere(recipe, `${adder.id}:${i}`)).toBe(true);
    }
  });
  it('is false for a removed step, a deleted recipe or one that is gone', () => {
    expect(stepStillThere(recipe, 'no-such-step')).toBe(false);
    expect(stepStillThere({ ...recipe, deleted_at: '2026-10-20T10:00:00Z' }, (quiche.steps[0]?.id ?? ''))).toBe(false);
    expect(stepStillThere(null, (quiche.steps[0]?.id ?? ''))).toBe(false);
    expect(stepStillThere(undefined, (quiche.steps[0]?.id ?? ''))).toBe(false);
  });
});
