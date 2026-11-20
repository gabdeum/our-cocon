import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { PushedScreen, TabHeader, Text } from '@cocon/ui';
import type { Tracker } from '@cocon/schemas';
import { strings } from '../../strings/en';
import { useTimers } from '../../lib/timer-store';
import type { Timer } from '../../lib/timers';
import { stepStillThere } from '../../lib/cooking';
import type { RecipeDetail } from '../../lib/recipe';
import { TimerList, useSeenDone } from './TimerList';

export { QUICK_MINUTES } from './TimerList';

const copy = strings.timersScreen;
export interface TimersScreenProps {
  /** Left out beside the rail from 960, which is the way out there. */
  onBack?: () => void;
  tracker: Tracker;
  /** The step timers' recipes, by id: `undefined` while loading, `null` when gone. */
  recipes?: Readonly<Record<string, RecipeDetail | null | undefined>>;
  /** "Go to step": cooking mode at that step (032-later L19). */
  onGoToStep?: (recipeId: string, stepId: string) => void;
  /** False while another screen is on top (cooking mode from "Go to step"): done timers aren't seen then. */
  focused?: boolean;
}

/**
 * /timers (spec 011 US2, design/ui/OC-Timers.md): every timer on this device, newest first, with
 * −1/+1, Pause/Resume and Stop; done ones offer "Add 1 more minute" and Dismiss. Quick kitchen
 * timers of 5, 10, 15 or 30 min at the bottom. A step timer whose step is still there offers
 * "Go to step" (032-later L19).
 */
export function TimersScreen({ onBack, tracker, recipes = {}, onGoToStep, focused = true }: TimersScreenProps) {
  const { timers } = useTimers();

  // Once per visit, with how many timers there were on arrival.
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    tracker.track('timers_screen_opened', { timer_count: timers.length });
  }, [tracker, timers.length]);
  // Spec 047 FR-001: seen here, unless another screen is on top.
  useSeenDone(focused);

  const running = timers.filter((t) => t.state === 'running').length;

  const goTo = (t: Timer) => {
    const { recipeId, stepId } = t;
    if (!onGoToStep || !recipeId || !stepId || !stepStillThere(recipes[recipeId], stepId)) return undefined;
    return { label: copy.goToStep, a11y: copy.goToStepA11y(t.label), onPress: () => onGoToStep(recipeId, stepId) };
  };

  return (
    // Beside the rail (no back) it is titled like a tab, the summary under the title.
    <PushedScreen className="gap-12" topBar={onBack ? { back: { label: copy.back, onPress: onBack }, title: copy.title } : undefined}>
      {onBack ? (
        <Text size={15} weight="700" color="ink-muted">
          {copy.summary(running, timers.length)}
        </Text>
      ) : (
        <TabHeader title={copy.title} sub={copy.summary(running, timers.length)} />
      )}
      <View className="gap-12 pt-6">
        <TimerList linkFor={goTo} />
        <Text variant="caption" color="ink-muted" align="center">
          {copy.footnote}
        </Text>
      </View>
    </PushedScreen>
  );
}
