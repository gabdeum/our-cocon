import { useCallback, useEffect, useRef, useState } from 'react';
import { currentStep, isTall, OPEN_SETTLE_MS, SCROLL_LOCK_MS, SCROLL_OFFSET, scrollTarget, snapPoints } from '../../lib/cooking';

export interface StepScroll {
  /** 0-based. */
  current: number;
  /** A step section's top in the scroll content and its height, from its onLayout. */
  onStepLayout: (index: number, top: number, height: number) => void;
  /** The scroll area's height, from its onLayout. */
  onViewport: (height: number) => void;
  /** From the ScrollView: how far it's scrolled and how tall it is. */
  onScroll: (scrollTop: number, viewportHeight: number) => void;
  /** Next, Back and segment taps (OC-Cook › Behaviour). */
  jump: (index: number) => void;
  /** Where scrolling comes to rest (`snapPoints`), for snapping on the iPhone. */
  snaps: number[];
  /** Steps taller than the scroll area, which also snap at their end (CSS snapping on the web). */
  tall: boolean[];
}

/**
 * Which step is current, and the scrolling to it (spec 012 US1, FR-004). The step whose top passes
 * 35% of the scroll area is current; Next, Back and segments scroll smoothly to a step's top − 8,
 * and scroll tracking pauses 700 ms meanwhile so the bar doesn't flicker through the steps between.
 * `initial` (a step opened from the Timers screen or the recipe page) is scrolled to, without
 * animation, once measured, and again on every layout change for the next 2 s (OPEN_SETTLE_MS) so a
 * step above it that grows, or a page not yet tall enough, doesn't leave it steps short; and when
 * tracking resumes, a scroll that stopped short of it goes again. Scrolling by hand, or any jump,
 * ends that. Scrolling by hand rests on `snapPoints`: step tops, and the end of a
 * step taller than the screen.
 */
export function useStepScroll(count: number, initial: number, scrollTo: (y: number, animated: boolean) => void): StepScroll {
  const [current, setCurrent] = useState(initial);
  const tops = useRef<number[]>([]);
  const heights = useRef<number[]>([]);
  const viewport = useRef(0);
  const [snaps, setSnaps] = useState<number[]>([]);
  const [tall, setTall] = useState<boolean[]>([]);
  // The step it opened at, while its position may still move (OPEN_SETTLE_MS from the first scroll).
  const pending = useRef<number | null>(initial > 0 ? initial : null);
  const settle = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const locked = useRef(false);
  const unlock = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Where the scroll area really is (from every scroll event, even while tracking pauses).
  const scrolledTo = useRef(0);
  // When a pause ends: opened at a step and not there, scroll again (set below).
  const recheck = useRef<() => void>(() => undefined);

  useEffect(
    () => () => {
      clearTimeout(unlock.current);
      clearTimeout(settle.current);
    },
    [],
  );

  const lock = useCallback(() => {
    locked.current = true;
    clearTimeout(unlock.current);
    unlock.current = setTimeout(() => {
      locked.current = false;
      recheck.current();
    }, SCROLL_LOCK_MS);
  }, []);

  const measure = useCallback(() => {
    const measured = tops.current.map((t, i) => ({ t, h: heights.current[i] })).filter((m) => m.t !== undefined);
    setSnaps(
      snapPoints(
        measured.map((m) => m.t),
        measured.map((m) => m.h ?? 0),
        viewport.current,
      ),
    );
    setTall(heights.current.map((h) => isTall(h, viewport.current)));
  }, []);

  /** Opened at a step: scroll (again) to where it is now. */
  const aim = useCallback(() => {
    const target = pending.current;
    const top = target === null ? undefined : tops.current[target];
    if (top === undefined) return;
    if (settle.current === undefined) {
      settle.current = setTimeout(() => {
        pending.current = null;
      }, OPEN_SETTLE_MS);
    }
    lock();
    scrollTo(scrollTarget(top), false);
  }, [lock, scrollTo]);

  // The step bar shows the step it opened at, so a scroll that stopped short would go unnoticed:
  // check where it really is once the pause ends, and go again (within OPEN_SETTLE_MS).
  useEffect(() => {
    recheck.current = () => {
      const target = pending.current;
      const top = target === null ? undefined : tops.current[target];
      if (top !== undefined && Math.abs(scrolledTo.current - scrollTarget(top)) > SCROLL_OFFSET) aim();
    };
  }, [aim]);

  const onViewport = useCallback(
    (height: number) => {
      viewport.current = height;
      measure();
      aim();
    },
    [aim, measure],
  );

  const onStepLayout = useCallback(
    (index: number, top: number, height: number) => {
      tops.current[index] = top;
      heights.current[index] = height;
      measure();
      aim();
    },
    [aim, measure],
  );

  const onScroll = useCallback(
    (scrollTop: number, viewportHeight: number) => {
      scrolledTo.current = scrollTop;
      if (locked.current) return;
      // Scrolled by hand: the step it opened at stays where the person put it.
      pending.current = null;
      const measured = tops.current.slice(0, count).map((t) => t ?? Number.POSITIVE_INFINITY);
      setCurrent(currentStep(measured, scrollTop, viewportHeight));
    },
    [count],
  );

  const jump = useCallback(
    (index: number) => {
      const i = Math.min(Math.max(index, 0), count - 1);
      pending.current = null;
      lock();
      setCurrent(i);
      scrollTo(scrollTarget(tops.current[i] ?? 0), true);
    },
    [count, lock, scrollTo],
  );

  return { current, onStepLayout, onViewport, onScroll, jump, snaps, tall };
}
