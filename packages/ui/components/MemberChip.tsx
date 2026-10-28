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
      <MemberDot initial={initial} color={color} size={30} dimmed={!pressed} />
      <Text size={14} weight="800" color={pressed ? 'ink' : 'ink-muted'} numberOfLines={1}>
        {name}
      </Text>
    </Pressable>
  );
}

/** MemberChip README › Dot: the member color with the initial; "All" smaller; Others a person icon. */
function MemberDot({ initial, color, size, dimmed = false }: { initial: string; color: MemberChipColor; size: 28 | 30; dimmed?: boolean }) {
  return (
    <View aria-hidden className={cn('items-center justify-center rounded-full', size === 28 ? 'h-[28px] w-[28px]' : 'h-[30px] w-[30px]', avatarFills[color], dimmed && 'opacity-dimmed')}>
      {color === 'others' ? (
        <Icon name="person" size={18} color="inkMuted" />
      ) : (
        <Text size={initial.length > 1 ? 11 : size === 28 ? 13 : 14} weight="900">
          {initial}
        </Text>
      )}
    </View>
  );
}

export interface MemberCountProps {
  /** "Gabriel 2", "Everyone 1". */
  text: string;
  initial: string;
  color: MemberChipColor;
}

/** MemberChip README › Count: who's busy in the day view (spec 039). Not a control. */
export function MemberCount({ text, initial, color }: MemberCountProps) {
  return (
    <View className="h-[36px] flex-none flex-row items-center gap-6 rounded-pill bg-surface-card pl-4 pr-12">
      <MemberDot initial={initial} color={color} size={28} />
      <Text size={14} weight="800" numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}
