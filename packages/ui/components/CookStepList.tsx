import { Pressable, ScrollView, View } from 'react-native';
import { theme } from '../theme';
import { cn, focusRing } from '../cn';
import { Icon } from './Icon';
import { Text } from './Text';

export interface CookStepListItem {
  /** The step's name; null when it has none ("Step 3" is then its number alone). */
  name: string | null;
  /** Its timer's time while running or paused ("12:30"), else null. */
  time: string | null;
  /** Screen-reader label: "Go to step 3: Bake, timer 12:30". */
  label: string;
}

export interface CookStepListProps {
  /** "All steps": the heading and the list's name for screen readers. */
  title: string;
  steps: CookStepListItem[];
  /** 0-based. */
  current: number;
  onSelect: (index: number) => void;
  /** The step-name fallback: (n) => "Step 3". */
  numbered: (n: number) => string;
}

/**
 * Every step beside cooking mode from 960 (CookStepList README, spec 066 FR-003): a white card,
 * one row per step with a number badge (a tick once done), its name and its timer's time. The
 * current one has a soft fill and an olive border. Tapping a row goes to that step. Scrolls on its own.
 */
export function CookStepList({ title, steps, current, onSelect, numbered }: CookStepListProps) {
  return (
    <View role="navigation" aria-label={title} className="flex-1 rounded-xl bg-surface-card p-10" style={{ width: theme.layout.stepList }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="gap-4">
        <Text size={13} weight="900" color="ink-muted" uppercase aria-hidden className="px-8 pb-4 pt-6" style={{ letterSpacing: 0.7 }}>
          {title}
        </Text>
        {steps.map((step, i) => {
          const now = i === current;
          const done = i < current;
          return (
            <Pressable
              key={i}
              role="button"
              aria-label={step.label}
              aria-current={now ? 'step' : undefined}
              onPress={() => onSelect(i)}
              className={cn('min-h-[56px] flex-row items-center gap-12 rounded-lg border-2 px-10 py-6', now ? 'border-olive bg-surface-soft' : 'border-transparent active:bg-surface-soft', focusRing)}
            >
              <View aria-hidden className={cn('h-[32px] w-[32px] items-center justify-center rounded-full', now ? 'bg-olive' : done ? 'bg-olive-muted' : 'bg-surface-soft')}>
                {done ? (
                  <Icon name="check" size={16} color="ink" />
                ) : (
                  <Text size={15} weight="900" color={now ? 'on-olive' : 'ink'}>
                    {i + 1}
                  </Text>
                )}
              </View>
              <Text size={16} weight={now ? '900' : '800'} color={done ? 'ink-muted' : 'ink'} className="min-w-0 flex-1" aria-hidden>
                {step.name ?? numbered(i + 1)}
              </Text>
              {step.time ? (
                <View aria-hidden className="rounded-pill bg-ink px-8 py-[3px]">
                  <Text size={13} weight="900" color="on-ink" tabular>
                    {step.time}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
