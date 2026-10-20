// Spec 012 US1 and FR-004: which step is current, scrolling to it, and the 700 ms pause in tracking.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { SCROLL_LOCK_MS } from '../../lib/cooking';
import { useStepScroll } from './use-step-scroll';

const TOPS = [0, 520, 1040, 1560, 2080, 2600];

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function setup(initial = 0) {
  const scrollTo = vi.fn();
  const hook = renderHook(() => useStepScroll(TOPS.length, initial, scrollTo));
  act(() => TOPS.forEach((top, i) => hook.result.current.onStepLayout(i, top)));
  return { hook, scrollTo };
}

describe('useStepScroll', () => {
  it('US1 › 1: Next scrolls smoothly so step 2 is at the top, and makes it current', () => {
    const { hook, scrollTo } = setup();
    act(() => hook.result.current.jump(1));
    expect(scrollTo).toHaveBeenLastCalledWith(512, true);
    expect(hook.result.current.current).toBe(1);
  });

  it('US1 › 2: swiping makes the step whose top passes 35% current', () => {
    const { hook } = setup();
    act(() => hook.result.current.onScroll(1100, 800));
    expect(hook.result.current.current).toBe(2);
    act(() => hook.result.current.onScroll(0, 800));
    expect(hook.result.current.current).toBe(0);
  });

  it('US1 › 3: tapping the 5th segment jumps to step 5', () => {
    const { hook, scrollTo } = setup();
    act(() => hook.result.current.jump(4));
    expect(scrollTo).toHaveBeenLastCalledWith(2072, true);
    expect(hook.result.current.current).toBe(4);
  });

  it('FR-004: scroll events during the 700 ms after a jump are ignored', () => {
    const { hook } = setup();
    act(() => hook.result.current.jump(4));
    // The smooth scroll passes step 2 on its way.
    act(() => hook.result.current.onScroll(600, 800));
    expect(hook.result.current.current).toBe(4);
    act(() => vi.advanceTimersByTime(SCROLL_LOCK_MS));
    act(() => hook.result.current.onScroll(600, 800));
    expect(hook.result.current.current).toBe(1);
  });

  it('opens at a given step without animation, once it is measured', () => {
    const { hook, scrollTo } = setup(3);
    expect(hook.result.current.current).toBe(3);
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith(1552, false);
  });

  it('snaps where Next and Back land: each top − 8', () => {
    const { hook } = setup();
    expect(hook.result.current.tops).toEqual([0, 512, 1032, 1552, 2072, 2592]);
  });
});
