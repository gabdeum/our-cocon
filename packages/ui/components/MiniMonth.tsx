import { Pressable, View } from 'react-native';
import { cn, focusRing } from '../cn';
import { Text } from './Text';

export interface MiniMonthDay {
  date: string;
  /** "25". */
  num: string;
  /** "October 25, has events". */
  label: string;
  /** The day the Day view shows: ink. */
  selected: boolean;
  /** Olive, unless it's also the selected day. */
  today: boolean;
  /** Before or after the month: ink-soft. */
  outside: boolean;
  /** A 5 px dot under the number. */
  hasEvents: boolean;
}

export interface MiniMonthProps {
  /** "October", "January 2027". */
  title: string;
  /** Seven letters from the first day of the week. */
  weekdays: readonly string[];
  /** Whole weeks, seven days each. */
  days: readonly MiniMonthDay[];
  onPress: (date: string) => void;
}

/**
 * MiniMonth README: a small month beside Day view from 960 wide (spec 070 FR-007) to jump to
 * another day. White card, radius 22; 38 px cells, the day shown ink, today olive, a dot on days with events.
 */
export function MiniMonth({ title, weekdays, days, onPress }: MiniMonthProps) {
  const weeks = Array.from({ length: Math.ceil(days.length / 7) }, (_, i) => days.slice(i * 7, i * 7 + 7));
  return (
    <View className="rounded-[22px] bg-surface-card px-12 pb-10 pt-12">
      <Text role="heading" aria-level={2} size={16} weight="900" className="px-4 pb-6">
        {title}
      </Text>
      <View aria-hidden className="flex-row gap-[2px] pb-[2px]">
        {weekdays.map((w, i) => (
          <Text key={i} size={12} weight="900" color="ink-muted" align="center" className="flex-1">
            {w}
          </Text>
        ))}
      </View>
      <View className="gap-[2px]">
        {weeks.map((week) => (
          <View key={week[0]?.date} className="flex-row gap-[2px]">
            {week.map((d) => {
              const dark = d.selected || d.today;
              return (
                <Pressable
                  key={d.date}
                  role="button"
                  aria-label={d.label}
                  aria-current={d.selected ? 'date' : undefined}
                  onPress={() => onPress(d.date)}
                  // 38 tall: the row of seven reaches 44 with the 2 px gaps and hit slop.
                  hitSlop={3}
                  className={cn(
                    'h-[38px] min-w-0 flex-1 items-center justify-center gap-[2px] rounded-[12px]',
                    d.selected ? 'bg-ink' : d.today ? 'bg-olive' : 'active:bg-surface-soft',
                    focusRing,
                  )}
                >
                  <Text size={14} weight={d.selected ? '900' : '700'} color={dark ? 'on-olive' : d.outside ? 'ink-soft' : 'ink'} style={{ lineHeight: 16 }}>
                    {d.num}
                  </Text>
                  <View aria-hidden className={cn('h-[5px] w-[5px] rounded-full', d.hasEvents ? (dark ? 'bg-honey' : 'bg-olive') : 'bg-transparent')} />
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

export interface ComingUpRowProps {
  /** "Mon". */
  weekday: string;
  /** "26". */
  num: string;
  /** "Run · Baby yoga", or "Nothing planned". */
  text: string;
  /** "Monday October 26: Run · Baby yoga". */
  label: string;
  onPress: () => void;
}

/** ComingUpRow README: one of the next days under the mini month (spec 070 FR-007); opens that day. */
export function ComingUpRow({ weekday, num, text, label, onPress }: ComingUpRowProps) {
  return (
    <Pressable
      role="button"
      aria-label={label}
      onPress={onPress}
      className={cn('min-h-[44px] flex-row items-center gap-10 rounded-[18px] bg-surface-card px-12 py-10 active:bg-surface-card-pressed', focusRing)}
    >
      <View aria-hidden className="w-[44px] flex-none items-center">
        <Text size={12} weight="900" color="ink-muted">
          {weekday}
        </Text>
        <Text size={20} weight="900" style={{ lineHeight: 22 }}>
          {num}
        </Text>
      </View>
      <Text aria-hidden size={14} weight="700" color="ink-muted" className="min-w-0 flex-1" style={{ lineHeight: 20 }}>
        {text}
      </Text>
    </Pressable>
  );
}
