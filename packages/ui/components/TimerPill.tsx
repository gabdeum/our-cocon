import { Pressable } from 'react-native';
import { cn, focusRing } from '../cn';
import { theme } from '../theme';
import { Icon } from './Icon';
import { Text } from './Text';
import { View } from 'react-native';

export interface TimerPillProps {
  /** "Blind bake". */
  name: string;
  clock: string;
  /** "+1" when other timers exist. */
  more?: string;
  /** "2 timers running. Open timers". */
  label: string;
  onPress: () => void;
  /** The ✕ that hides the pill without touching timers (spec 011 FR-008), and its label. */
  onHide?: () => void;
  hideLabel?: string;
  /** 48 tall in headers (cooking mode), 50 elsewhere. */
  compact?: boolean;
}

/**
 * The most urgent timer, always visible (TimerPill README). Right padding 14, or 8 beside the "+N"
 * chip; with a ✕, the link ends at 6, then a divider and the 40 × 44 ✕ (pill padding right 3).
 */
export function TimerPill({ name, clock, more, label, onPress, onHide, hideLabel, compact }: TimerPillProps) {
  return (
    <View
      className={cn('self-center flex-row items-center rounded-pill border-2 border-honey bg-surface-card', onHide && 'pr-[3px]', compact ? 'h-[48px]' : 'h-[50px]')}
      style={{ boxShadow: theme.shadow.float }}
    >
      <Pressable
        role="link"
        aria-label={label}
        onPress={onPress}
        className={cn('h-full flex-row items-center gap-10 rounded-pill pl-14', onHide ? 'pr-6' : more ? 'pr-8' : 'pr-14', focusRing)}
      >
        <Icon name="timer" color="olive" />
        <Text size={15} weight="800" numberOfLines={1}>
          {name}
        </Text>
        <Text size={17} weight="900" tabular>
          {clock}
        </Text>
        {more ? (
          <View className="rounded-pill bg-honey px-10 py-6">
            <Text size={13} weight="900">
              {more}
            </Text>
          </View>
        ) : null}
      </Pressable>
      {onHide ? (
        <>
          <View aria-hidden className="h-[24px] w-[1.5px] bg-line" />
          <Pressable
            role="button"
            aria-label={hideLabel}
            onPress={onHide}
            className={cn('h-[44px] w-[40px] flex-none items-center justify-center rounded-pill', focusRing)}
          >
            <Icon name="close" size={16} color="inkMuted" />
          </Pressable>
        </>
      ) : null}
    </View>
  );
}
