import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { BackHeader, Button, PushedScreen, Text, TimerCard } from '@cocon/ui';
import type { Tracker } from '@cocon/schemas';
import { strings } from '../../strings/en';
import { useTimers, useTimerStore } from '../../lib/timer-store';
import { clock, MINUTE, progress, remaining, type Timer } from '../../lib/timers';

const copy = strings.timersScreen;
/** "Set to" (FR-002 of spec 010): 5 · 10 · 15 · 30 min. */
export const PRESET_MINUTES = [5, 10, 15, 30] as const;

const stateLabel = { running: copy.running, paused: copy.paused, done: copy.done } as const;
const actionLabel = { running: copy.pause, paused: copy.resume, done: copy.addMinute } as const;

export interface TimersScreenProps {
  onBack: () => void;
  tracker: Tracker;
}

/**
 * /timers (spec 011 US2, design/ui/OC-Timers.md): every timer on this device, newest first, with
 * −1/+1, Edit presets, Pause/Resume and Stop; done ones offer "Add 1 more minute" and Dismiss.
 */
export function TimersScreen({ onBack, tracker }: TimersScreenProps) {
  const store = useTimerStore();
  const { timers, now } = useTimers();
  const [editing, setEditing] = useState<string | null>(null);

  // Once per visit, with how many timers there were on arrival.
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    tracker.track('timers_screen_opened', { timer_count: timers.length });
  }, [tracker, timers.length]);

  const running = timers.filter((t) => t.state === 'running').length;
  const newestFirst = [...timers].reverse();

  const card = (t: Timer) => {
    const open = editing === t.id;
    return (
      <TimerCard
        key={t.id}
        name={t.label}
        sub={copy.sub(t.recipeName ?? copy.noRecipe, stateLabel[t.state])}
        state={t.state}
        clock={clock(remaining(t, now))}
        progress={progress(t, now)}
        actionLabel={actionLabel[t.state]}
        onAction={() => (t.state === 'running' ? store.pause(t.id) : t.state === 'paused' ? store.resume(t.id) : store.add(t.id, MINUTE))}
        secondaryLabel={t.state === 'done' ? copy.dismiss : copy.stop}
        onSecondary={() => (t.state === 'done' ? store.dismiss(t.id) : store.stop(t.id))}
        editLabel={open ? copy.close : copy.edit}
        editing={open}
        onEdit={() => setEditing(open ? null : t.id)}
        setToLabel={copy.setTo}
        presets={PRESET_MINUTES.map((m) => ({
          label: copy.preset(m),
          onPress: () => {
            store.set(t.id, m * MINUTE);
            setEditing(null);
          },
        }))}
        minusLabel={copy.minus}
        plusLabel={copy.plus}
        minusA11y={copy.minusA11y}
        plusA11y={copy.plusA11y}
        onMinus={() => store.add(t.id, -MINUTE)}
        onPlus={() => store.add(t.id, MINUTE)}
      />
    );
  };

  return (
    <PushedScreen className="gap-12">
      <BackHeader backLabel={copy.back} onBack={onBack} title={copy.title} aside={copy.summary(running, timers.length)} />
      <View className="gap-12 pt-6">
        {newestFirst.map(card)}
        {timers.length === 0 ? (
          <Text size={16} weight="700" color="ink-muted" align="center" className="px-10 py-40">
            {copy.empty}
          </Text>
        ) : null}
        <Button variant="dashed" label={copy.quick} onPress={() => void store.quick()} block />
        <Text variant="caption" color="ink-muted" align="center">
          {copy.footnote}
        </Text>
      </View>
    </PushedScreen>
  );
}
