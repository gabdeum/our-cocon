import { Pressable, View } from 'react-native';
import { cn, focusRing } from '../cn';
import { useThemeColors } from '../ThemeProvider';
import { avatarFills, type MemberColor } from './Avatar';
import { Icon } from './Icon';
import { Text } from './Text';

/** A member's color, or Everyone (coral, "All") and Others (light sand, person icon). */
export type MemberChipColor = MemberColor | 'everyone' | 'others';

export interface MemberChipProps {
  /** The member's name, "Everyone" or "Others". */
  name: string;
  /** One or two letters; "All" for Everyone. Ignored for Others, which shows a person icon. */
  initial: string;
  color: MemberChipColor;
  /** Pressed = this person's events are shown (spec 036 FR-004). */
  pressed: boolean;
  onPress: () => void;
  /** The last row of the list: no divider under it. */
  last?: boolean;
}

/** A person as a row of the calendar's people filter (MemberChip README › Filter row, CalHeaderPeople screen). */
export function MemberChip({ name, initial, color, pressed, onPress, last = false }: MemberChipProps) {
  return (
    <Pressable
      role="button"
      aria-pressed={pressed}
      onPress={onPress}
      className={cn('min-h-[52px] w-full flex-row items-center gap-12', !last && 'border-b-[1.5px] border-line', focusRing)}
    >
      <MemberDot initial={initial} color={color} size={34} />
      <Text size={16} weight="800" numberOfLines={1} className="min-w-0 flex-1">
        {name}
      </Text>
      <View
        aria-hidden
        className={cn('h-[26px] w-[26px] items-center justify-center rounded-[8px]', pressed ? 'bg-olive' : 'border-2 border-line-dashed')}
      >
        {pressed ? <Icon name="check" size={16} color="onOlive" /> : null}
      </View>
    </Pressable>
  );
}

export interface MemberStackProps {
  /** The first shown people, in order; only three are drawn. */
  people: { key: string; initial: string; color: MemberChipColor }[];
  /** Some people are hidden: the button is sage, and so is the ring. */
  filtered: boolean;
}

/** MemberChip README › Stack: up to 3 dots overlapping by 8, ringed in the button's fill. Not a control. */
export function MemberStack({ people, filtered }: MemberStackProps) {
  const colors = useThemeColors();
  const ring = `0 0 0 2px ${filtered ? colors.sage : colors.surfaceCard}`;
  return (
    <View aria-hidden className="flex-row pl-8">
      {people.slice(0, 3).map((p) => (
        <MemberDot key={p.key} initial={p.initial} color={p.color} size={26} className="-ml-8" style={{ boxShadow: ring }} />
      ))}
    </View>
  );
}

type DotSize = 26 | 28 | 34;
// The screens' dots: box, initial (one letter / "All"), Others' icon.
const dots: Record<DotSize, { box: string; text: number; all: number; icon: number }> = {
  26: { box: 'h-[26px] w-[26px]', text: 12, all: 9, icon: 14 },
  28: { box: 'h-[28px] w-[28px]', text: 13, all: 11, icon: 18 },
  34: { box: 'h-[34px] w-[34px]', text: 14, all: 11, icon: 18 },
};

/** MemberChip README › Dot: the member color with the initial; "All" smaller; Others a person icon. */
function MemberDot({ initial, color, size, className, style }: { initial: string; color: MemberChipColor; size: DotSize; className?: string; style?: { boxShadow: string } }) {
  const d = dots[size];
  return (
    <View aria-hidden className={cn('items-center justify-center rounded-full', d.box, avatarFills[color], className)} style={style}>
      {color === 'others' ? (
        <Icon name="person" size={d.icon} color="inkMuted" />
      ) : (
        <Text size={initial.length > 1 ? d.all : d.text} weight="900">
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
