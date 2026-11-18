import { useEffect } from 'react';
import { AppState, View } from 'react-native';
import { Text, TimePresets, TimerCard } from '@cocon/ui';
import { strings } from '../../strings/en';
import { useTimers, useTimerStore } from '../../lib/timer-store';
import { clock, MINUTE, progress, remaining, type Timer } from '../../lib/timers';

const copy = strings.timersScreen;
/** The quick kitchen timers at the bottom (FR-004): 5 · 10 · 15 · 30 min. */
export const QUICK_MINUTES = [5, 10, 15, 30] as const;

const stateLabel = { running: copy.running, paused: copy.paused, done: copy.done } as const;
const actionLabel = { running: copy.pause, paused: copy.resume, done: copy.addMinute } as const;

export interface TimerLink {
  label: string;
  a11y: string;
  onPress: () => void;
}

export interface TimerListProps {
  /** A card's olive link on the right ("Go to step"), if it has one. */
  linkFor?: (t: Timer) => TimerLink | undefined;
}

/**
 * Every timer on this device, newest first, with −1/+1, Pause/Resume and Stop; done ones offer
 * "Add 1 more minute" and Dismiss. Then the quick kitchen timers of 5, 10, 15 or 30 min. On the
 * Timers screen (spec 011) and in cooking mode's Timers sheet (spec 062).
 */
export function TimerList({ linkFor }: TimerListProps) {
  const store = useTimerStore();
  const { timers, now } = useTimers();
  const newestFirst = [...timers].reverse();

  const card = (t: Timer) => (
    <TimerCard
      key={t.id}
      name={t.label}
      sub={copy.sub(t.recipeName ?? copy.noRecipe, stateLabel[t.state])}
      state={t.state}
      clock={clock(remaining(t, now))}
      progress={progress(t, now)}
      actionLabel={actionLabel[t.state]}
      onAction={() => (t.state === 'running' ? store.pause(t.id) : t.state === 'paused' ? store.resume(t.id) : store.add(t.id, MINUTE))}
      actionA11y={copy.forTimer(actionLabel[t.state], t.label)}
      secondaryLabel={t.state === 'done' ? copy.dismiss : copy.stop}
      secondaryA11y={copy.forTimer(t.state === 'done' ? copy.dismiss : copy.stop, t.label)}
      onSecondary={() => (t.state === 'done' ? store.dismiss(t.id) : store.stop(t.id))}
      minusLabel={copy.minus}
      plusLabel={copy.plus}
      minusA11y={copy.forTimer(copy.minusA11y, t.label)}
      plusA11y={copy.forTimer(copy.plusA11y, t.label)}
      onMinus={() => store.add(t.id, -MINUTE)}
      onPlus={() => store.add(t.id, MINUTE)}
      link={linkFor?.(t)}
    />
  );

  return (
    <View className="gap-12">
      {newestFirst.map(card)}
      {timers.length === 0 ? (
        <Text size={16} weight="700" color="ink-muted" align="center" className="px-10 py-40">
          {copy.empty}
        </Text>
      ) : null}
      <TimePresets
        label={copy.quick}
        presets={QUICK_MINUTES.map((m) => ({ label: copy.preset(m), a11y: copy.quickA11y(m), onPress: () => void store.quick(m * MINUTE) }))}
      />
    </View>
  );
}

/**
 * Spec 047 FR-001: done timers shown here are seen, so their Lock Screen alerts and follow-ups go
 * (also once a cold start from a tapped alert has read the saved timers). Only while `shown`.
 */
export function useSeenDone(shown: boolean): void {
  const store = useTimerStore();
  const { timers } = useTimers();
  const done = timers
    .filter((t) => t.state === 'done')
    .map((t) => t.id)
    .join(',');
  useEffect(() => {
    if (!done || !shown) return;
    store.seenDone();
    // Left open behind the Lock Screen: counts once the app is back on screen.
    const sub = AppState.addEventListener('change', (s) => s === 'active' && store.seenDone());
    return () => sub.remove();
  }, [store, done, shown]);
}
