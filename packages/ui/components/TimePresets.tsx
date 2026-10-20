import { Pressable, View } from 'react-native';
import { cn, focusRing } from '../cn';
import { Text } from './Text';

export interface TimePreset {
  /** "5 min". */
  label: string;
  /** "Start a 5 min kitchen timer". */
  a11y: string;
  onPress: () => void;
}

export interface TimePresetsProps {
  /** "Quick kitchen timer": names the group for screen readers too. */
  label: string;
  presets: TimePreset[];
}

/**
 * A row of dashed "add" buttons, one per time (TimePresets README): the quick kitchen timers on the
 * Timers screen (spec 011). Each starts its own timer.
 */
export function TimePresets({ label, presets }: TimePresetsProps) {
  return (
    <View role="group" aria-label={label} className="gap-8">
      <Text size={15} weight="800" color="ink-muted" aria-hidden>
        {label}
      </Text>
      <View className="flex-row gap-8">
        {presets.map((p) => (
          <Pressable
            key={p.label}
            role="button"
            aria-label={p.a11y}
            onPress={p.onPress}
            className={cn('h-control-lg min-w-0 flex-1 items-center justify-center rounded-md border-2 border-dashed border-line-dashed bg-transparent active:bg-surface-soft', focusRing)}
          >
            <Text size={16} weight="800" color="olive-deep" numberOfLines={1} adjustsFontSizeToFit>
              {p.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
