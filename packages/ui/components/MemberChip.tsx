import { Pressable, View } from 'react-native';
import { cn, focusRing } from '../cn';
import { avatarFills, type MemberColor } from './Avatar';
import { Icon } from './Icon';
import { Text } from './Text';

/** A member's color, or Everyone (coral, "All") and Others (light sand, person icon). */
export type MemberChipColor = MemberColor | 'everyone' | 'others';

// MemberChip README › Filter: a 2 px border in the member color; Others uses line-handle.
const borders: Record<MemberChipColor, string> = {
  honey: 'border-member-honey',
  rose: 'border-member-rose',
  sky: 'border-member-sky',
  mint: 'border-member-mint',
  lilac: 'border-member-lilac',
  peach: 'border-member-peach',
  pistachio: 'border-member-pistachio',
  clay: 'border-member-clay',
  everyone: 'border-member-everyone',
  others: 'border-line-handle',
};

export interface MemberChipProps {
  /** The member's name, "Everyone" or "Others". */
  name: string;
  /** One or two letters; "All" for Everyone. Ignored for Others, which shows a person icon. */
  initial: string;
  color: MemberChipColor;
  /** Pressed = this person's events are shown (spec 036 FR-004). */
  pressed: boolean;
  onPress: () => void;
}

/**
 * A person as a filter chip (MemberChip README › Filter, CalHeader screen). The hidden look isn't
 * drawn: it follows the Pill's unselected look (soft fill, no colored border, dimmed dot), and the
 * initial or icon always stays visible.
 */
export function MemberChip({ name, initial, color, pressed, onPress }: MemberChipProps) {
  const others = color === 'others';
  return (
    <Pressable
      role="button"
      aria-pressed={pressed}
      onPress={onPress}
      className={cn(
        'h-control-md flex-none flex-row items-center gap-8 rounded-pill border-2 pl-6 pr-14',
        pressed ? cn('bg-surface-card active:bg-surface-card-pressed', borders[color]) : 'border-transparent bg-surface-soft active:bg-surface-soft-pressed',
        focusRing,
      )}
    >
      <View aria-hidden className={cn('h-[30px] w-[30px] items-center justify-center rounded-full', avatarFills[color], !pressed && 'opacity-dimmed')}>
        {others ? (
          <Icon name="person" size={18} color="inkMuted" />
        ) : (
          <Text size={initial.length > 1 ? 11 : 14} weight="900">
            {initial}
          </Text>
        )}
      </View>
      <Text size={14} weight="800" color={pressed ? 'ink' : 'ink-muted'} numberOfLines={1}>
        {name}
      </Text>
    </Pressable>
  );
}
