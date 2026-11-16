import { Pressable } from 'react-native';
import { pressedState } from '../a11y';
import { cn, focusRing } from '../cn';
import { Text } from './Text';

export interface DayChipProps {
  /** "Today", "Tomorrow", "Other day". */
  label: string;
  /** "Sun 25", or "Pick a date". */
  sub: string;
  selected: boolean;
  onPress: () => void;
  /** `start`: left-aligned, 16/900 over 13/700, as the reminder drawer's snooze tiles (spec 057). */
  align?: 'center' | 'start';
}

/** DayChip README: one of the add sheet's three "When" tiles (OC-CalAdd); olive when picked. */
export function DayChip({ label, sub, selected, onPress, align = 'center' }: DayChipProps) {
  const start = align === 'start';
  return (
    <Pressable
      role="button"
      {...pressedState(selected)}
      aria-label={`${label}, ${sub}`}
      onPress={onPress}
      className={cn(
        'min-h-[60px] flex-1 justify-center gap-2 rounded-[16px] py-6',
        start ? 'items-start px-12' : 'items-center px-8',
        selected ? 'bg-olive active:bg-olive-pressed' : 'bg-surface-card active:bg-surface-card-pressed',
        focusRing,
      )}
    >
      <Text size={start ? 16 : 15} weight="900" color={selected ? 'on-olive' : 'ink'} align={start ? 'left' : 'center'}>
        {label}
      </Text>
      <Text size={start ? 13 : 12} weight="700" color={selected ? 'on-olive' : 'ink-muted'} align={start ? 'left' : 'center'}>
        {sub}
      </Text>
    </Pressable>
  );
}
