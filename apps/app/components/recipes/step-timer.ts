import { useState } from 'react';
import { MAX_TRACKED_STEPS, type Tracker } from '@cocon/schemas';
import { strings } from '../../strings/en';
import type { StepLine } from '../../lib/recipe-view';
import { useStepTimer, useTimerStore } from '../../lib/timer-store';
import { adjusted, clock, MINUTE, type Timer } from '../../lib/timers';

export interface StepTimerInput {
  recipeId: string;
  recipeName: string;
  stepId: string;
  /** 0-based, for `step_timer_started`. */
  index: number;
  timer: NonNullable<StepLine['timer']>;
  tracker: Tracker;
}

export interface StepTimerControl {
  /** `idle` until it's started. */
  state: Timer['state'] | 'idle';
  clock: string;
  /** Start → Pause → Resume, and at 00:00 dismiss. */
  onPress: () => void;
  onMinus: () => void;
  onPlus: () => void;
  /** Said once, politely: "Blind bake is done", "1 minute left". */
  announcement?: string;
}

/**
 * A step's timer, on the recipe page (spec 009 US3) and in cooking mode (012 US2): Start timer →
 * Pause → Resume, and at 00:00 the action dismisses it. −1 / +1 change it even while it runs;
 * before it starts they change only the time it will start with, on this step.
 */
export function useStepTimerControl({ recipeId, recipeName, stepId, index, timer: planned, tracker }: StepTimerInput): StepTimerControl {
  const store = useTimerStore();
  const { timer, left } = useStepTimer(recipeId, stepId);
  // A changed recipe (a variant, an edit) starts over from its own time.
  const [chosen, setChosen] = useState({ planned: planned.seconds, seconds: planned.seconds });
  const startWith = chosen.planned === planned.seconds ? chosen.seconds : planned.seconds;
  const setStartWith = (seconds: number) => setChosen({ planned: planned.seconds, seconds });

  const onPress = () => {
    if (!timer) {
      store.start(planned.label, startWith, 'step', { recipeId, stepId, recipeName });
      tracker.track('step_timer_started', { step_index: Math.min(index, MAX_TRACKED_STEPS - 1) });
      setStartWith(planned.seconds);
    } else if (timer.state === 'running') store.pause(timer.id);
    else if (timer.state === 'paused') store.resume(timer.id);
    else store.dismiss(timer.id);
  };
  const adjust = (delta: number) => () => {
    if (timer) store.add(timer.id, delta);
    else setStartWith(adjusted(startWith, delta));
  };
  const announcement = !timer
    ? undefined
    : timer.state === 'done'
      ? strings.timers.done(timer.label)
      : timer.state === 'running' && left === MINUTE
        ? strings.recipePage.steps.oneMinuteLeft
        : undefined;

  return {
    state: timer ? timer.state : 'idle',
    clock: clock(timer ? left : startWith),
    onPress,
    onMinus: adjust(-MINUTE),
    onPlus: adjust(MINUTE),
    announcement,
  };
}
