import { Platform, Pressable, View, type GestureResponderEvent, type TextStyle } from 'react-native';
import { cn, focusRing } from '../cn';
import { EventBar, Fill, WEEK_BAR_STEP, type EventBarProps, type EventColor } from './EventChip';
import { Text } from './Text';

/** HourGrid README › Grid: 06:00–24:00, 36 px per hour. */
export const GRID_FIRST_HOUR = 6;
export const GRID_HOURS = 18;
export const HOUR_HEIGHT = 36;
export const GRID_HEIGHT = GRID_HOURS * HOUR_HEIGHT;

export interface WeekDayHead {
  date: string;
  /** "S". */
  letter: string;
  /** "25". */
  num: string;
  /** "Sunday October 25". */
  label: string;
  today: boolean;
}

export type WeekAllDayBar = Omit<EventBarProps, 'onPress' | 'size'> & { key: string };

export interface WeekBlock {
  key: string;
  /** "J 14:30", "All Lunch", or initials only when it shares its time ("E·J"). */
  top: string;
  title: string;
  /** "Baby swim, Sunday, 14:30 to 16:30". */
  label: string;
  colors: readonly EventColor[];
  /** Slot events have a soft outline; custom times a 3 px ink left edge. */
  kind: 'slot' | 'custom';
  /** From the top of the grid, and tall, in px. */
  y: number;
  height: number;
  /** 0 is the leftmost lane, out of `lanes` side by side. */
  lane: number;
  lanes: number;
}

export interface WeekColumn {
  date: string;
  /** For screen readers, who can't pick an hour: "Add event, Sunday October 25". */
  addLabel: string;
  today: boolean;
  blocks: WeekBlock[];
}

export interface HourGridProps {
  days: readonly WeekDayHead[];
  /** "All day". */
  allDayLabel: string;
  bars: readonly WeekAllDayBar[];
  columns: readonly WeekColumn[];
  /** "06:00" … "23:00". */
  hourLabels: readonly string[];
  /** The now line's distance from the grid's top, in today's column; null when not shown. */
  nowY: number | null;
  onDayPress: (date: string) => void;
  onBlockPress: (key: string) => void;
  /** An empty part of a day: the hour tapped (6–23), or null when there's no position (screen readers). */
  onEmptyPress: (date: string, hour: number | null) => void;
}

const clipOnWeb = (Platform.OS === 'web' ? { textOverflow: 'clip' } : {}) as TextStyle;

/** The hour under a tap in a day column. */
export function hourAt(y: number | undefined): number | null {
  if (y === undefined || Number.isNaN(y)) return null;
  return Math.min(GRID_FIRST_HOUR + GRID_HOURS - 1, Math.max(GRID_FIRST_HOUR, GRID_FIRST_HOUR + Math.floor(y / HOUR_HEIGHT)));
}

function DayHead({ day, onPress }: { day: WeekDayHead; onPress: () => void }) {
  return (
    <Pressable role="link" aria-label={day.label} onPress={onPress} className={cn('min-h-[44px] min-w-0 flex-1 items-center gap-[2px]', focusRing)}>
      <Text size={12} weight="900" color="ink-muted">
        {day.letter}
      </Text>
      {day.today ? (
        <View className="h-[28px] w-[28px] items-center justify-center rounded-full bg-olive">
          <Text size={15} weight="900" color="on-olive">
            {day.num}
          </Text>
        </View>
      ) : (
        <View className="h-[28px] justify-center">
          <Text size={15} weight="800">
            {day.num}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

function Block({ block, onPress }: { block: WeekBlock; onPress: () => void }) {
  const rounded = 'rounded-[7px]';
  // The outer box is the lane; its 1 px padding keeps blocks apart (no calc() in React Native).
  return (
    <View
      pointerEvents="box-none"
      className="absolute px-[1px]"
      style={{ top: block.y, height: block.height, left: `${(block.lane * 100) / block.lanes}%`, width: `${100 / block.lanes}%` }}
    >
      <Pressable role="link" aria-label={block.label} onPress={onPress} className={cn('flex-1 gap-[1px] overflow-hidden p-[3px]', rounded, focusRing)}>
        <Fill colors={block.colors} rounded={rounded} />
        {/* React Native has no inset shadow: the outline and the left edge are drawn over the fill. */}
        {block.kind === 'slot' ? (
          <View aria-hidden className={cn('absolute inset-0 border-event-outline', rounded)} style={{ borderWidth: 1.5 }} />
        ) : (
          <View aria-hidden className="absolute bottom-0 left-0 top-0 w-[3px] bg-ink" />
        )}
        {block.top ? (
          <Text size={10} weight="900" numberOfLines={1} ellipsizeMode="clip" style={[{ lineHeight: 12 }, clipOnWeb]}>
            {block.top}
          </Text>
        ) : null}
        <Text size={11} weight="800" style={{ lineHeight: 12.65 }}>
          {block.title}
        </Text>
      </Pressable>
    </View>
  );
}

function Column({ column, nowY, onBlockPress, onEmptyPress }: { column: WeekColumn; nowY: number | null } & Pick<HourGridProps, 'onBlockPress' | 'onEmptyPress'>) {
  const onEmpty = (e: GestureResponderEvent) => onEmptyPress(column.date, hourAt(e.nativeEvent?.locationY));
  return (
    <View className={cn('relative min-w-0 flex-1', column.today && 'bg-calendar-today-tint')} style={{ height: GRID_HEIGHT }}>
      <Pressable role="button" aria-label={column.addLabel} onPress={onEmpty} className={cn('absolute inset-0', focusRing)} />
      {column.blocks.map((b) => (
        <Block key={b.key} block={b} onPress={() => onBlockPress(b.key)} />
      ))}
      {column.today && nowY !== null ? (
        <View aria-hidden pointerEvents="none" className="absolute z-10 h-[2px] bg-olive" style={{ top: nowY, left: -2, right: -2 }} />
      ) : null}
    </View>
  );
}

/**
 * The week view's grid (HourGrid README, OC-CalWeek): a row of days (tap → Day view), an "All day"
 * row of bars spanning their days, then 06:00–24:00 at 36 px per hour with each day's events at
 * their times, side by side where they overlap. Today's column is tinted, with the now line.
 */
export function HourGrid({ days, allDayLabel, bars, columns, hourLabels, nowY, onDayPress, onBlockPress, onEmptyPress }: HourGridProps) {
  const barRows = bars.reduce((n, b) => Math.max(n, b.lane + 1), 1);
  return (
    <View className="overflow-hidden rounded-[20px] bg-surface-card">
      <View className="flex-row gap-[2px] border-b-[1.5px] border-line pb-8 pl-[38px] pr-4 pt-8">
        {days.map((d) => (
          <DayHead key={d.date} day={d} onPress={() => onDayPress(d.date)} />
        ))}
      </View>

      <View className="flex-row items-center border-b-[1.5px] border-line pb-8 pr-4 pt-6">
        <View className="w-[38px] flex-none pr-6">
          <Text size={10} weight="900" color="ink-muted" align="right">
            {allDayLabel}
          </Text>
        </View>
        <View className="relative min-w-0 flex-1" style={{ height: barRows * WEEK_BAR_STEP - 2 }}>
          {bars.map(({ key, ...bar }) => (
            <EventBar {...bar} key={key} size="week" onPress={() => onBlockPress(key)} />
          ))}
        </View>
      </View>

      <View className="flex-row pb-10 pr-4 pt-8">
        <View aria-hidden className="relative w-[38px] flex-none" style={{ height: GRID_HEIGHT }}>
          {hourLabels.map((label, i) => (
            <Text key={label} size={10} weight="800" color="ink-muted" className="absolute right-6" style={{ top: i === 0 ? 0 : i * HOUR_HEIGHT - 6 }}>
              {label}
            </Text>
          ))}
        </View>
        <View className="relative min-w-0 flex-1 flex-row gap-[2px]" style={{ height: GRID_HEIGHT }}>
          {hourLabels.map((label, i) => (
            <View key={label} aria-hidden pointerEvents="none" className="absolute left-0 right-0 h-[1px] bg-line" style={{ top: i * HOUR_HEIGHT }} />
          ))}
          {columns.map((c) => (
            <Column key={c.date} column={c} nowY={nowY} onBlockPress={onBlockPress} onEmptyPress={onEmptyPress} />
          ))}
        </View>
      </View>
    </View>
  );
}
