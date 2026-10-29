import { useEffect, useRef } from 'react';
import { strings } from '../../strings/en';
import { useTimerStore } from '../../lib/timer-store';
import { useToast } from '../../lib/toast';

/** The chime plays twice (FR-005), this far apart. */
export const CHIME_GAP_MS = 1400;

export interface TimerAlertsProps {
  /** Plays the kitchen-bell chime once (lib/chime.ts). */
  chime: () => void;
  vibrate: () => void;
  /**
   * "Open timers" on the toast (spec 011): opens the Timers screen. Left out on the shared recipe
   * page (019), which has no Timers screen: the toast then has no button.
   */
  onOpenTimers?: () => void;
}

/**
 * When a timer reaches zero, on any screen (spec 010 US3): the chime twice, a vibration, and the
 * toast "Blind bake is done". A newer one replaces the old one. "Open timers" joins the toast with
 * the Timers screen (spec 011).
 */
export function TimerAlerts({ chime, vibrate, onOpenTimers }: TimerAlertsProps) {
  const store = useTimerStore();
  const toast = useToast();
  // The latest button, without listening again when it changes.
  const open = useRef(onOpenTimers);
  useEffect(() => {
    open.current = onOpenTimers;
  });

  useEffect(() => {
    const timeouts = new Set<ReturnType<typeof setTimeout>>();
    const off = store.onFinished((timer) => {
      chime();
      const t = setTimeout(() => {
        timeouts.delete(t);
        chime();
      }, CHIME_GAP_MS);
      timeouts.add(t);
      vibrate();
      toast.show({
        text: strings.timers.done(timer.label),
        action: open.current ? { label: strings.timers.openTimers, onPress: () => open.current?.() } : undefined,
      });
    });
    return () => {
      off();
      timeouts.forEach(clearTimeout);
    };
  }, [store, chime, vibrate, toast]);

  return null;
}
