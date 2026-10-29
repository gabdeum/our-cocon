import { Pressable } from 'react-native';
import { cn, focusRing } from '../cn';
import { Text } from './Text';

export interface DayChipProps {
  /** "Today", "Tomorrow", "Other day". */
  label: string;
  /** "Sun 25", or "Pick a date". */
  sub: string;
  selected: boolean;
  onPress: () => void;
}

/** DayChip README: one of the add sheet's three "When" tiles (OC-CalAdd); olive when picked. */
export function DayChip({ label, sub, selected, onPress }: DayChipProps) {
  return (
    <Pressable
      role="button"
      aria-pressed={selected}
      aria-label={`${label}, ${sub}`}
      onPress={onPress}
      className={cn(
        'min-h-[60px] flex-1 items-center justify-center gap-2 rounded-[16px] px-8 py-6',
        selected ? 'bg-olive active:bg-olive-pressed' : 'bg-surface-card active:bg-surface-card-pressed',
        focusRing,
      )}
    >
      <Text size={15} weight="900" color={selected ? 'on-olive' : 'ink'} align="center">
        {label}
      </Text>
      <Text size={12} weight="700" color={selected ? 'on-olive' : 'ink-muted'} align="center">
        {sub}
      </Text>
    </Pressable>
  );
}
