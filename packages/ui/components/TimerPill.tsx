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
  /** 48 tall in headers (cooking mode), 50 elsewhere. */
  compact?: boolean;
}

/** The most urgent timer, always visible (TimerPill README). Shown from spec 011. */
export function TimerPill({ name, clock, more, label, onPress, compact }: TimerPillProps) {
  return (
    <Pressable
      role="link"
      aria-label={label}
      onPress={onPress}
      className={cn('self-center flex-row items-center gap-10 rounded-pill border-2 border-honey bg-surface-card pl-14 pr-8', compact ? 'h-[48px]' : 'h-[50px]', focusRing)}
      style={{ boxShadow: theme.shadow.float }}
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
  );
}
