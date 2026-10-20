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
 * The most urgent timer, live, on tab screens and the recipe page (spec 011 US1), "+N" for the
 * others. Nothing while there are no timers. Tapping it opens Timers and sends `timer_pill_tapped`.
 */
export function AppTimerPill({ onOpen, tracker, compact }: AppTimerPillProps) {
  const { timer, left, count } = useMostUrgent();
  if (!timer) return null;
  const open = () => {
    tracker.track('timer_pill_tapped', { timer_count: count });
    onOpen();
  };
  return (
    <TimerPill
      name={pillName(timer.label)}
      clock={clock(left)}
      more={count > 1 ? copy.more(count - 1) : undefined}
      label={copy.label(count)}
      onPress={open}
      compact={compact}
    />
  );
}

/** Whether a pill is showing, so the TabBar can reserve its height (160 rather than 100). */
export function useHasTimers(): boolean {
  return useMostUrgent().count > 0;
}
