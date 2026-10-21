import { Pressable, type PressableProps } from 'react-native';
import { cn, focusRing } from '../cn';
import { Text } from './Text';

export interface ToggleTileProps extends Omit<PressableProps, 'children' | 'style'> {
  /** "Timer": also its screen-reader name, with its on/off state. */
  label: string;
  /** What shows while it's on: "Timer ✓". */
  selectedLabel: string;
  selected: boolean;
  className?: string;
}

/**
 * An add-on switched on or off in a grid (ToggleTile README; OC-EditSteps › "Add to this step"):
 * 48 tall, radius 14, outlined when off, olive with "✓" when on.
 */
export function ToggleTile({ label, selectedLabel, selected, className, ...props }: ToggleTileProps) {
  return (
    <Pressable
      role="button"
      aria-label={label}
      aria-pressed={selected}
      className={cn(
        'h-[48px] flex-1 items-center justify-center rounded-[14px] px-10',
        selected ? 'bg-olive active:bg-olive-pressed' : 'border-2 border-line-strong bg-surface-card active:bg-surface-soft',
        focusRing,
        className,
      )}
      {...props}
    >
      <Text size={14} weight="800" color={selected ? 'on-olive' : 'ink'} numberOfLines={1}>
        {selected ? selectedLabel : label}
      </Text>
    </Pressable>
  );
}
