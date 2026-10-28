import { Pressable } from 'react-native';
import { cn, focusRing } from '../cn';
import { Text } from './Text';

export interface SlotChipProps {
  /** "Evening", "All day", "Custom". */
  label: string;
  /** "18–22", "Whole day", "Pick times". */
  hours: string;
  selected: boolean;
  onPress: () => void;
}

/** SlotChip README: a time of day in the add sheet's scrolling row (OC-CalAdd); olive when picked. */
export function SlotChip({ label, hours, selected, onPress }: SlotChipProps) {
  return (
    <Pressable
      role="button"
      aria-pressed={selected}
      aria-label={`${label}, ${hours}`}
      onPress={onPress}
      className={cn(
        'h-[66px] min-w-[92px] flex-none items-center justify-center gap-2 rounded-[18px] px-12',
        selected ? 'bg-olive active:bg-olive-pressed' : 'bg-surface-card active:bg-surface-card-pressed',
        focusRing,
      )}
    >
      <Text size={15} weight="900" color={selected ? 'on-olive' : 'ink'} numberOfLines={1}>
        {label}
      </Text>
      <Text size={12} weight="700" color={selected ? 'on-olive' : 'ink-muted'} numberOfLines={1}>
        {hours}
      </Text>
    </Pressable>
  );
}
