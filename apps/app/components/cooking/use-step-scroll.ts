import { useCallback, useEffect, useRef, useState } from 'react';
import { currentStep, SCROLL_LOCK_MS, scrollTarget } from '../../lib/cooking';

export interface StepScroll {
  /** 0-based. */
  current: number;
  /** A step section's top in the scroll content, from its onLayout. */
  onStepLayout: (index: number, top: number) => void;
  /** From the ScrollView: how far it's scrolled and how tall it is. */
  onScroll: (scrollTop: number, viewportHeight: number) => void;
  /** Next, Back and segment taps (OC-Cook › Behaviour). */
  jump: (index: number) => void;
  /** Where each step lands (its top − 8), for snapping on the iPhone. */
  tops: number[];
}

/**
 * Which step is current, and the scrolling to it (spec 012 US1, FR-004). The step whose top passes
 * 35% of the scroll area is current; Next, Back and segments scroll smoothly to a step's top − 8,
 * and scroll tracking pauses 700 ms meanwhile so the bar doesn't flicker through the steps between.
 * `initial` (a step opened from the Timers screen) is scrolled to, without animation, once measured.
 */
export function useStepScroll(count: number, initial: number, scrollTo: (y: number, animated: boolean) => void): StepScroll {
  const [current, setCurrent] = useState(initial);
  const tops = useRef<number[]>([]);
  const [snaps, setSnaps] = useState<number[]>([]);
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

  const onStepLayout = useCallback(
    (index: number, top: number) => {
      tops.current[index] = top;
      setSnaps(tops.current.filter((t) => t !== undefined).map(scrollTarget));
      const target = pending.current;
      if (target === null || tops.current[target] === undefined) return;
      pending.current = null;
      lock();
      scrollTo(scrollTarget(tops.current[target]), false);
    },
    [lock, scrollTo],
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

  return { current, onStepLayout, onScroll, jump, tops: snaps };
}
