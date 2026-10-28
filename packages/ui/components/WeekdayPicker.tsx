import { Pressable, View } from 'react-native';
import { cn, focusRing } from '../cn';
import { Text } from './Text';

export interface WeekdayPickerProps {
  /** Seven letters from Sunday: "S M T W T F S". */
  letters: readonly string[];
  /** Their full names, for screen readers. */
  names: readonly string[];
  /** Picked days, 0 = Sunday. */
  value: readonly number[];
  onToggle: (day: number) => void;
  label: string;
}

/** WeekdayPicker README: Weekly's "On" days, seven 44 tall tiles (OC-CalAddMore); olive when picked. */
export function WeekdayPicker({ letters, names, value, onToggle, label }: WeekdayPickerProps) {
  return (
    <View role="group" aria-label={label} className="flex-row gap-4">
      {letters.map((letter, day) => {
        const on = value.includes(day);
        return (
          <Pressable
            key={day}
            role="button"
            aria-pressed={on}
            aria-label={names[day]}
            onPress={() => onToggle(day)}
            className={cn('h-control-md flex-1 items-center justify-center rounded-[12px]', on ? 'bg-olive active:bg-olive-pressed' : 'bg-surface-soft active:bg-surface-soft-pressed', focusRing)}
          >
            <Text size={15} weight="900" color={on ? 'on-olive' : 'ink'}>
              {letter}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
