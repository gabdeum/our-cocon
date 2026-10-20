import { Pressable } from 'react-native';
import { cn, focusRing } from '../cn';
import { Mark } from './ListRow';
import { Text } from './Text';

export interface RadioCardProps {
  /** "Bacon lardons". */
  label: string;
  /** On the right, ink-muted: "200 g", "2 (300 g)". */
  value?: string;
  selected: boolean;
  onPress: () => void;
}

/**
 * One choice of a single-choice list, on its own white card (RadioCard README; OC-ScaleIng's
 * "1. Which ingredient?"). Wrap the cards in a `role="radiogroup"` view with a label.
 */
export function RadioCard({ label, value, selected, onPress }: RadioCardProps) {
  return (
    <Pressable
      role="radio"
      aria-checked={selected}
      aria-label={value ? `${label}, ${value}` : label}
      onPress={onPress}
      className={cn(
        'min-h-[52px] flex-row items-center gap-12 rounded-lg border-2 bg-surface-card px-14 py-8 active:bg-surface-soft',
        selected ? 'border-olive' : 'border-transparent',
        focusRing,
      )}
    >
      <Mark kind="radio" checked={selected} />
      <Text size={16} weight={selected ? '800' : '700'} className="flex-1">
        {label}
      </Text>
      {value ? (
        <Text size={16} weight="600" color="ink-muted">
          {value}
        </Text>
      ) : null}
    </Pressable>
  );
}
