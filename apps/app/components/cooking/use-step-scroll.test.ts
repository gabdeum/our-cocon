// Spec 012 US1 and FR-004: which step is current, scrolling to it, and the 700 ms pause in tracking.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { OPEN_SETTLE_MS, SCROLL_LOCK_MS } from '../../lib/cooking';
import { useStepScroll } from './use-step-scroll';

const TOPS = [0, 520, 1040, 1560, 2080, 2600];

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function setup(initial = 0) {
  const scrollTo = vi.fn();
  const hook = renderHook(() => useStepScroll(TOPS.length, initial, scrollTo));
  act(() => TOPS.forEach((top, i) => hook.result.current.onStepLayout(i, top, 520)));
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
    // Once measured, and again as the steps after it are laid out: always to the same place.
    expect(scrollTo.mock.calls.every(([y, animated]) => y === 1552 && animated === false)).toBe(true);
    expect(scrollTo).toHaveBeenCalled();
  });

  it('opened at a step: a step above it growing afterwards scrolls to it again', () => {
    const { hook, scrollTo } = setup(4);
    expect(scrollTo).toHaveBeenLastCalledWith(2072, false);
    // Step 2 reflows 300 taller (fonts loaded): steps 3–6 move down.
    act(() => [0, 520, 1340, 1860, 2380, 2900].forEach((top, i) => hook.result.current.onStepLayout(i, top, i === 1 ? 820 : 520)));
    expect(scrollTo).toHaveBeenLastCalledWith(2372, false);
    expect(hook.result.current.current).toBe(4);
  });

  it('opened at a step: scrolling by hand, or 2 s passing, ends the re-aiming', () => {
    const first = setup(4);
    // It got there; then the person scrolls up.
    act(() => first.hook.result.current.onScroll(2072, 800));
    act(() => vi.advanceTimersByTime(SCROLL_LOCK_MS));
    act(() => first.hook.result.current.onScroll(1500, 800));
    const calls = first.scrollTo.mock.calls.length;
    act(() => first.hook.result.current.onStepLayout(1, 520, 820));
    expect(first.scrollTo).toHaveBeenCalledTimes(calls);

    const second = setup(4);
    act(() => vi.advanceTimersByTime(OPEN_SETTLE_MS));
    const before = second.scrollTo.mock.calls.length;
    act(() => second.hook.result.current.onStepLayout(1, 520, 820));
    expect(second.scrollTo).toHaveBeenCalledTimes(before);
  });

  it('opened at a step: a scroll that stopped short goes again when tracking resumes', () => {
    const { hook, scrollTo } = setup(4);
    // The browser only got to step 2, while the step bar already reads step 5.
    act(() => hook.result.current.onScroll(900, 800));
    expect(hook.result.current.current).toBe(4);
    const calls = scrollTo.mock.calls.length;
    act(() => vi.advanceTimersByTime(SCROLL_LOCK_MS));
    expect(scrollTo).toHaveBeenCalledTimes(calls + 1);
    expect(scrollTo).toHaveBeenLastCalledWith(2072, false);
  });

  it('opened at a step: once it got there, nothing more happens', () => {
    const { hook, scrollTo } = setup(4);
    // Scroll-snap rests on the step's own top, 8 below where it was sent.
    act(() => hook.result.current.onScroll(2080, 800));
    const calls = scrollTo.mock.calls.length;
    act(() => vi.advanceTimersByTime(SCROLL_LOCK_MS));
    expect(scrollTo).toHaveBeenCalledTimes(calls);
  });

  it('opened at step 1: nothing to aim at', () => {
    const { scrollTo } = setup(0);
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('snaps where Next and Back land: each top − 8', () => {
    const { hook } = setup();
    act(() => hook.result.current.onViewport(700));
    expect(hook.result.current.snaps).toEqual([0, 512, 1032, 1552, 2072, 2592]);
    expect(hook.result.current.tall).toEqual([false, false, false, false, false, false]);
  });

  it('a step taller than the screen also snaps at its end, then the next step', () => {
    const { hook } = setup();
    act(() => hook.result.current.onViewport(700));
    // Step 3 grows to 900 tall: steps 4–6 move down by 380.
    act(() => [0, 520, 1040, 1940, 2460, 2980].forEach((top, i) => hook.result.current.onStepLayout(i, top, i === 2 ? 900 : 520)));
    expect(hook.result.current.snaps).toEqual([0, 512, 1032, 1240, 1932, 2452, 2972]);
    expect(hook.result.current.tall[2]).toBe(true);
  });
});
