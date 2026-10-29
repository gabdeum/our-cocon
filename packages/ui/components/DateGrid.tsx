import { Pressable, View } from 'react-native';
import { cn, focusRing } from '../cn';
import { IconButton } from './IconButton';
import { Text } from './Text';

export interface DateGridDay {
  /** "YYYY-MM-DD". */
  date: string;
  /** 1–31. */
  day: number;
  /** What a screen reader says: "Saturday, Oct 31". */
  label: string;
  today: boolean;
  /** Before the first allowed date ("Ends on a date" can't end before the event starts). */
  disabled?: boolean;
}

export interface DateGridProps {
  /** "November 2026". */
  title: string;
  /** Seven letters in the member's week order. */
  weekdays: readonly string[];
  /** The month's days in weeks of seven; null pads the first and last week. */
  weeks: readonly (readonly (DateGridDay | null)[])[];
  selected: string | null;
  onSelect: (date: string) => void;
  previous: { label: string; onPress: () => void };
  next: { label: string; onPress: () => void };
}

/**
 * DateGrid README: one month to pick a day from, inside a BottomSheet ("Other day" and "Ends on a
 * date" in the add sheet, spec 041). Selected olive; today ringed in olive.
 */
export function DateGrid({ title, weekdays, weeks, selected, onSelect, previous, next }: DateGridProps) {
  return (
    <View className="gap-8">
      <View className="flex-row items-center justify-between">
        <IconButton variant="soft" icon="back" label={previous.label} onPress={previous.onPress} />
        <Text size={17} weight="900" role="heading" aria-live="polite">
          {title}
        </Text>
        <IconButton variant="soft" icon="chevron-right" label={next.label} onPress={next.onPress} />
      </View>
      <View aria-hidden className="flex-row">
        {weekdays.map((w, i) => (
          <Text key={i} size={12} weight="900" color="ink-muted" align="center" className="flex-1">
            {w}
          </Text>
        ))}
      </View>
      <View role="grid" aria-label={title} className="gap-4">
        {weeks.map((week, i) => (
          <View key={i} role="row" className="flex-row">
            {week.map((d, j) => (
              <View key={d?.date ?? `pad-${j}`} className="flex-1 items-center">
                {d ? <Day day={d} selected={d.date === selected} onPress={() => onSelect(d.date)} /> : null}
              </View>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

function Day({ day, selected, onPress }: { day: DateGridDay; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      role="button"
      aria-pressed={selected}
      aria-label={day.label}
      aria-current={day.today ? 'date' : undefined}
      disabled={day.disabled}
      onPress={onPress}
      className={cn(
        'h-control-md w-control-md items-center justify-center rounded-full',
        selected ? 'bg-olive active:bg-olive-pressed' : 'active:bg-surface-soft',
        day.today && !selected && 'border-[2.5px] border-olive',
        day.disabled && 'opacity-dimmed',
        focusRing,
      )}
    >
      <Text size={16} weight={selected || day.today ? '900' : '700'} color={selected ? 'on-olive' : 'ink'} tabular>
        {day.day}
      </Text>
    </Pressable>
  );
}
