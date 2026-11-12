import { useEffect, useRef } from 'react';
import { Pressable, View } from 'react-native';
import { announce } from '../a11y';
import { cn, focusRing } from '../cn';
import { Text } from './Text';

export interface StepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  /** "Fewer servings" / "More servings". */
  decreaseLabel: string;
  increaseLabel: string;
  /** What to show instead of `value`: "7½" after a scale by an ingredient (spec 013). */
  display?: string;
  /** Said by the screen reader after each change ("5 servings", spec 030 FR-002); the bare number otherwise. */
  announcement?: string;
}

/**
 * Minus / value / plus (Stepper README). At a limit the button stays visible, does nothing and is
 * announced as dimmed (disabled).
 */
export function Stepper({ value, onChange, min = 1, max = 16, decreaseLabel, increaseLabel, display, announcement }: StepperProps) {
  const spoken = announcement ?? display ?? String(value);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) first.current = false;
    else announce(spoken);
  }, [spoken]);
  const atMin = value <= min;
  const atMax = value >= max;
  return (
    <View className="flex-row items-center gap-8">
      <Pressable
        role="button"
        aria-label={decreaseLabel}
        disabled={atMin}
        onPress={() => onChange(value - 1)}
        className={cn('min-h-control-md min-w-control-md items-center justify-center rounded-full bg-surface-soft active:bg-surface-soft-pressed', focusRing)}
      >
        <Text size={22} weight="800" aria-hidden>
          −
        </Text>
      </Pressable>
      <Text size={22} weight="900" tabular align="center" className="min-w-[28px]">
        {display ?? value}
      </Text>
      <Pressable
        role="button"
        aria-label={increaseLabel}
        disabled={atMax}
        onPress={() => onChange(value + 1)}
        className={cn('min-h-control-md min-w-control-md items-center justify-center rounded-full bg-olive active:bg-olive-pressed', focusRing)}
      >
        <Text size={22} weight="800" color="on-olive" aria-hidden>
          +
        </Text>
      </Pressable>
    </View>
  );
}
