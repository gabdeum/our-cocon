import { ScrollView, View } from 'react-native';
import { Text } from '@cocon/ui';
import { strings } from '../../strings/en';
import { useTimers } from '../../lib/timer-store';
import type { Timer } from '../../lib/timers';
import { TimerList, useSeenDone, type TimerLink } from '../timers/TimerList';

const copy = strings.timersScreen;

export interface CookTimersPanelProps {
  /** A step timer of this recipe goes to its step here ("Go to step"). */
  linkFor: (t: Timer) => TimerLink | undefined;
}

/**
 * Cooking mode's timers panel from 600 (spec 066 FR-002, OC-CookResponsive): the Timers screen,
 * always open. Every timer on this device (all recipes), the quick timers, then the footnote. The
 * title and the running count stay at the top while the rest scrolls.
 */
export function CookTimersPanel({ linkFor }: CookTimersPanelProps) {
  const { timers } = useTimers();
  // Done timers shown here are seen (spec 047 FR-001), as on the Timers screen.
  useSeenDone(true);
  const running = timers.filter((t) => t.state === 'running').length;
  return (
    <View role="region" aria-label={copy.title} className="flex-1">
      <View className="pb-12">
        <Text size={22} weight="900" role="heading" aria-level={2}>
          {copy.title}
        </Text>
        <Text size={15} weight="700" color="ink-muted">
          {copy.summary(running, timers.length)}
        </Text>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} className="flex-1" contentContainerClassName="gap-12">
        <TimerList linkFor={linkFor} panel />
        <Text variant="caption" color="ink-muted" align="center">
          {copy.footnote}
        </Text>
      </ScrollView>
    </View>
  );
}
