import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, View, type ScrollViewInstance } from 'react-native';
import { cn, focusRing } from '../cn';
import { useReduceMotion } from '../reduceMotion';
import { Icon } from './Icon';
import { Text } from './Text';

export interface CookStepListItem {
  /** The step's name; null when it has none ("Step 3" is then its number alone). */
  name: string | null;
  /** Its timer's time ("12:30"): what's left once started, else its full length; null when it has none. */
  time: string | null;
  /** The timer is counting down now: an ink pill. Otherwise (not started, paused) a beige one. */
  running?: boolean;
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

type Box = { y: number; height: number };

/**
 * Where to scroll the list so the row shows, centred; null when it already shows whole.
 * Exported for tests: jsdom has no layout.
 */
export function stepListScroll(row: Box, view: Box): number | null {
  if (row.y >= view.y && row.y + row.height <= view.y + view.height) return null;
  return Math.max(0, Math.round(row.y - (view.height - row.height) / 2));
}

/**
 * Every step beside cooking mode from 960 (CookStepList README, spec 066 FR-003): a white card,
 * one row per step with a number badge (a tick once done), its name and its timer's time. The
 * current one has a soft fill and an olive border. Tapping a row goes to that step. Scrolls on its own,
 * and to the current row whenever it changes or would be out of sight.
 */
export function CookStepList({ title, steps, current, onSelect, numbered }: CookStepListProps) {
  const reduceMotion = useReduceMotion();
  const scroll = useRef<ScrollViewInstance>(null);
  const rows = useRef<Record<number, Box>>({});
  const view = useRef<Box>({ y: 0, height: 0 });
  const show = (animated: boolean) => {
    const row = rows.current[current];
    if (!row || view.current.height === 0) return;
    const y = stepListScroll(row, view.current);
    if (y !== null) scroll.current?.scrollTo({ y, animated: animated && !reduceMotion });
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- runs on a new current step only
  useEffect(() => show(true), [current]);
  return (
    <View role="navigation" aria-label={title} className="flex-1 rounded-xl bg-surface-card p-10">
      <ScrollView
        ref={scroll}
        showsVerticalScrollIndicator={false}
        contentContainerClassName="gap-4"
        scrollEventThrottle={16}
        onScroll={(e) => {
          view.current = { ...view.current, y: e.nativeEvent.contentOffset.y };
        }}
        // Opening cooking mode on step 10, or a smaller window: the current row comes into view.
        onLayout={(e) => {
          view.current = { ...view.current, height: e.nativeEvent.layout.height };
          show(false);
        }}
      >
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
              onLayout={(e) => {
                rows.current[i] = { y: e.nativeEvent.layout.y, height: e.nativeEvent.layout.height };
                if (now) show(false);
              }}
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
                <View aria-hidden className={cn('rounded-pill px-8 py-[3px]', step.running ? 'bg-ink' : 'bg-line-strong')}>
                  <Text size={13} weight="900" color={step.running ? 'on-ink' : 'ink-muted'} tabular>
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
