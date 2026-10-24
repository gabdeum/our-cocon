import { useCallback, useEffect, useRef, useState } from 'react';
import { currentStep, isTall, SCROLL_LOCK_MS, scrollTarget, snapPoints } from '../../lib/cooking';

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
 * animation, once measured. Scrolling by hand rests on `snapPoints`: step tops, and the end of a
 * step taller than the screen.
 */
export function useStepScroll(count: number, initial: number, scrollTo: (y: number, animated: boolean) => void): StepScroll {
  const [current, setCurrent] = useState(initial);
  const tops = useRef<number[]>([]);
  const heights = useRef<number[]>([]);
  const viewport = useRef(0);
  const [snaps, setSnaps] = useState<number[]>([]);
  const [tall, setTall] = useState<boolean[]>([]);
  const pending = useRef<number | null>(initial > 0 ? initial : null);
  const locked = useRef(false);
  const unlock = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(unlock.current), []);

  const lock = useCallback(() => {
    locked.current = true;
    clearTimeout(unlock.current);
    unlock.current = setTimeout(() => {
      locked.current = false;
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

  const onViewport = useCallback(
    (height: number) => {
      viewport.current = height;
      measure();
    },
    [measure],
  );

  const onStepLayout = useCallback(
    (index: number, top: number, height: number) => {
      tops.current[index] = top;
      heights.current[index] = height;
      measure();
      const target = pending.current;
      if (target === null || tops.current[target] === undefined) return;
      pending.current = null;
      lock();
      scrollTo(scrollTarget(tops.current[target]), false);
    },
    [lock, measure, scrollTo],
  );

  const onScroll = useCallback(
    (scrollTop: number, viewportHeight: number) => {
      if (locked.current) return;
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
