import { TimerPill } from '@cocon/ui';
import type { Tracker } from '@cocon/schemas';
import { strings } from '../../strings/en';
import { useMostUrgent } from '../../lib/timer-store';
import { clock, pillName } from '../../lib/timers';

const copy = strings.timerPill;

export interface AppTimerPillProps {
  /** Opens the Timers screen (`/timers`). */
  onOpen: () => void;
  tracker: Tracker;
  /** 48 tall in the cooking-mode header (spec 012). */
  compact?: boolean;
}

/**
 * The running timer with the least time left, live, on tab screens and the recipe page (spec 011
 * US1), "+N" for the other running ones. Nothing while no timer is running (paused and done ones
 * don't count). Tapping it opens Timers and sends `timer_pill_tapped`.
 */
export function AppTimerPill({ onOpen, tracker, compact }: AppTimerPillProps) {
  const { timer, left, count, running } = useMostUrgent();
  if (!timer) return null;
  const open = () => {
    tracker.track('timer_pill_tapped', { timer_count: count });
    onOpen();
  };
  const others = running - 1;
  return (
    <TimerPill
      name={pillName(timer.label)}
      clock={clock(left)}
      more={others > 0 ? copy.more(others) : undefined}
      label={copy.label(running)}
      onPress={open}
      compact={compact}
    />
  );
}

/** Whether a pill is showing, so the TabBar can reserve its height (160 rather than 100). */
export function useHasTimers(): boolean {
  return useMostUrgent().running > 0;
}
