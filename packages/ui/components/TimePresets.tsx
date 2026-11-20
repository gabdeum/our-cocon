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
  /** The label as a small uppercase eyebrow (13/900): cooking mode's timers panel (spec 066). */
  eyebrow?: boolean;
}

/**
 * A row of dashed "add" buttons, one per time (TimePresets README): the quick kitchen timers on the
 * Timers screen (spec 011) and cooking mode's timers panel (spec 066). Each starts its own timer.
 */
export function TimePresets({ label, presets, eyebrow }: TimePresetsProps) {
  return (
    <View role="group" aria-label={label} className={eyebrow ? 'gap-6' : 'gap-8'}>
      <Text size={eyebrow ? 13 : 15} weight={eyebrow ? '900' : '800'} color="ink-muted" uppercase={eyebrow} aria-hidden>
        {label}
      </Text>
      <View className={eyebrow ? 'flex-row gap-6' : 'flex-row gap-8'}>
        {presets.map((p) => (
          <Pressable
            key={p.label}
            role="button"
            aria-label={p.a11y}
            onPress={p.onPress}
            className={cn('min-w-0 flex-1 items-center justify-center rounded-md border-2 border-dashed border-line-dashed bg-transparent active:bg-surface-soft', eyebrow ? 'h-[48px]' : 'h-control-lg', focusRing)}
          >
            <Text size={eyebrow ? 15 : 16} weight={eyebrow ? '900' : '800'} color="olive-deep" numberOfLines={1} adjustsFontSizeToFit>
              {p.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
