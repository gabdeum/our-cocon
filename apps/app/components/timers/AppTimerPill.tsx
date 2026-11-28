import { TimerPill } from '@cocon/ui';
import type { Tracker } from '@cocon/schemas';
import { strings } from '../../strings';
import { useMostUrgent, useTimerStore } from '../../lib/timer-store';
import { clock, pillName } from '../../lib/timers';

const copy = strings.timerPill;

export interface AppTimerPillProps {
  /** Opens the Timers screen (`/timers`). */
  onOpen: () => void;
  tracker: Tracker;
  /** The side rail's form (spec 064): the time and "+N" only, no ✕, the name in its label. */
  vertical?: boolean;
}

/**
 * The running timer with the least time left, live, on tab screens, the recipe page and cooking mode (spec 011
 * US1, 066), "+N" for the other running ones. Nothing while no timer is running (paused and done ones
 * don't count). Tapping it opens Timers and sends `timer_pill_tapped`; its ✕ hides it on every
 * screen, timers untouched, until one starts or finishes (FR-008), and sends `timer_pill_hidden`.
 */
export function AppTimerPill({ onOpen, tracker, vertical }: AppTimerPillProps) {
  const store = useTimerStore();
  const { timer, left, count, running } = useMostUrgent();
  if (!timer) return null;
  const open = () => {
    tracker.track('timer_pill_tapped', { timer_count: count });
    onOpen();
  };
  const hide = () => {
    tracker.track('timer_pill_hidden', { timer_count: count });
    store.hidePill();
  };
  const others = running - 1;
  const name = pillName(timer.label);
  const time = clock(left);
  return (
    <TimerPill
      name={name}
      clock={time}
      more={others > 0 ? copy.more(others) : undefined}
      label={vertical ? copy.railLabel(running, name, time) : copy.label(running)}
      onPress={open}
      onHide={vertical ? undefined : hide}
      hideLabel={copy.hide}
      vertical={vertical}
    />
  );
}

/** Whether a pill is showing, so the TabBar can reserve its height (160 rather than 100). */
export function useHasTimers(): boolean {
  return useMostUrgent().timer !== null;
}
