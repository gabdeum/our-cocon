import { Pressable, View } from 'react-native';
import { cn, focusRing } from '../cn';
import { theme } from '../theme';
import { Text } from './Text';

export type SegmentedVariant = 'light' | 'pill' | 'tabs';

export interface Segment<K extends string> {
  key: K;
  label: string;
}

export interface SegmentedControlProps<K extends string> {
  segments: Segment<K>[];
  value: K;
  onChange: (key: K) => void;
  /** light: settings (units, store) · pill: hugs content · tabs: switch the view (Ingredients · 9 / Steps · 6). */
  variant?: SegmentedVariant;
  /** Screen-reader name of the group. */
  label: string;
  /** Offline (Patterns.md › Offline): shows the choice, can't change it. */
  disabled?: boolean;
}

// bundle.css › SegmentedControl
const tracks: Record<SegmentedVariant, string> = {
  light: 'flex-row gap-4 rounded-md bg-surface-soft p-4',
  pill: 'self-start flex-row gap-4 rounded-pill bg-surface-soft p-4',
  tabs: 'flex-row gap-4 rounded-[20px] bg-ink p-[5px]',
};
const items: Record<SegmentedVariant, string> = {
  light: 'h-control-md flex-1 rounded-sm',
  pill: 'h-[36px] rounded-pill px-14',
  tabs: 'h-[48px] flex-1 rounded-lg',
};

/** Two to four exclusive options in one track (SegmentedControl README). */
export function SegmentedControl<K extends string>({ segments, value, onChange, variant = 'light', label, disabled }: SegmentedControlProps<K>) {
  const tabs = variant === 'tabs';
  return (
    <View role={tabs ? 'tablist' : 'group'} aria-label={label} aria-disabled={disabled || undefined} className={cn(tracks[variant], disabled && 'opacity-dimmed')}>
      {segments.map((s) => {
        const on = s.key === value;
        return (
          <Pressable
            key={s.key}
            role={tabs ? 'tab' : 'button'}
            aria-selected={tabs ? on : undefined}
            aria-pressed={tabs ? undefined : on}
            onPress={() => onChange(s.key)}
            disabled={disabled}
            aria-disabled={disabled || undefined}
            // The pill is 36 tall: the touch area still reaches 44.
            hitSlop={variant === 'pill' ? 4 : undefined}
            className={cn('items-center justify-center', items[variant], on && (tabs ? 'bg-honey' : 'bg-surface-card'), focusRing)}
            style={on && !tabs ? { boxShadow: theme.shadow.segment } : undefined}
          >
            <Text size={tabs ? 16 : 14} weight={on ? '900' : '700'} color={on ? 'ink' : tabs ? 'on-ink' : 'ink-muted'} numberOfLines={1}>
              {s.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
