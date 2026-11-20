import {
  Platform,
  Pressable,
  ScrollView,
  View,
  type GestureResponderEvent,
  type TextStyle,
} from "react-native";
import { cn, focusRing } from "../cn";
import { theme } from "../theme";
import {
  EventBar,
  Fill,
  WEEK_BAR_STEP,
  WIDE_WEEK_BAR_STEP,
  type EventBarProps,
  type EventColor,
} from "./EventChip";
import { Icon } from "./Icon";
import { Text } from "./Text";

/** HourGrid README › Grid: 06:00–24:00, 36 px per hour. */
export const GRID_FIRST_HOUR = 6;
export const GRID_HOURS = 18;
export const HOUR_HEIGHT = 36;
export const GRID_HEIGHT = GRID_HOURS * HOUR_HEIGHT;
/** From 600 wide (spec 070 FR-005): 44 px per hour. */
export const WIDE_HOUR_HEIGHT = 44;

export type HourGridSize = "phone" | "wide";

/** HourGrid README: the phone's sizes, then from 600 (OC-LargeScreens › Calendar › Week). */
const SIZES = {
  phone: { hour: HOUR_HEIGHT, gutter: "w-[38px]", pad: "pl-[38px]", label: 10, head: 12, num: 15, circle: "h-[28px] w-[28px]", numRow: "h-[28px]", block: "p-[3px]", radius: "rounded-[7px]", top: 10, topLine: 12, title: 11, titleLine: 12.65, barStep: WEEK_BAR_STEP, bar: "week", labelTop: 6 },
  wide: { hour: WIDE_HOUR_HEIGHT, gutter: "w-[52px]", pad: "pl-[52px]", label: 12, head: 13, num: 18, circle: "h-[34px] w-[34px]", numRow: "h-[34px]", block: "px-6 py-[5px]", radius: "rounded-[10px]", top: 12, topLine: 15, title: 14, titleLine: 17, barStep: WIDE_WEEK_BAR_STEP, bar: "week-wide", labelTop: 7 },
} as const;

export interface WeekDayHead {
  date: string;
  /** "S". */
  letter: string;
  /** "25". */
  num: string;
  /** "Sunday October 25". */
  label: string;
  today: boolean;
  /** Reminders are due that day: an alarm clock beside the number (spec 058). */
  reminders?: boolean;
  /** The week's alarm clocks go under the numbers (one didn't fit beside its number). */
  markBelow?: boolean;
}

export type WeekAllDayBar = Omit<EventBarProps, "onPress" | "size"> & {
  key: string;
};

export interface WeekBlock {
  key: string;
  /** "J 14:30", "All Lunch", or initials only when it shares its time ("E·J"). */
  top: string;
  title: string;
  /** "Baby swim, Sunday, 14:30 to 16:30". */
  label: string;
  colors: readonly EventColor[];
  /** Slot events have a soft outline; custom times a 3 px ink left edge. */
  kind: "slot" | "custom";
  /** From the top of the grid, and tall, in px. */
  y: number;
  height: number;
  /** 0 is the leftmost lane, out of `lanes` side by side. */
  lane: number;
  lanes: number;
}

export interface WeekColumn {
  date: string;
  /** The day, for screen readers: "Sunday October 25" (a tap opens it). */
  label: string;
  /** Screen readers' stand-in for the long press: "Add event, Sunday October 25". */
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
  /**
   * A long press on an empty part of a day adds an event: the hour pressed (6–23), or null when
   * there's no position (screen readers). A tap there opens the day (`onDayPress`, decided 2026-10-28).
   */
  onEmptyLongPress: (date: string, hour: number | null) => void;
  /** Room under the last hour, for the floating tab bar (TabBar README: screens pad 180). */
  bottomInset?: number;
  /** From 600 wide (spec 070): 44 px hours, a 52 px gutter, larger heads and cards. */
  size?: HourGridSize;
}

const clipOnWeb = (
  Platform.OS === "web" ? { textOverflow: "clip" } : {}
) as TextStyle;

/** The hour under a tap in a day column. */
export function hourAt(y: number | undefined, hourHeight: number = HOUR_HEIGHT): number | null {
  if (y === undefined || Number.isNaN(y)) return null;
  return Math.min(
    GRID_FIRST_HOUR + GRID_HOURS - 1,
    Math.max(GRID_FIRST_HOUR, GRID_FIRST_HOUR + Math.floor(y / hourHeight)),
  );
}

function DayHead({ day, onPress, size }: { day: WeekDayHead; onPress: () => void; size: HourGridSize }) {
  const z = SIZES[size];
  return (
    <Pressable
      role="link"
      aria-label={day.label}
      onPress={onPress}
      className={cn(
        "min-h-[44px] min-w-0 flex-1 items-center gap-[2px]",
        focusRing,
      )}
    >
      <Text size={z.head} weight="900" color="ink-muted">
        {day.letter}
      </Text>
      {/* Spec 058: the alarm clock beside the number, or under it for the whole week when one doesn't fit. */}
      <View className={cn('items-center justify-center gap-[1px]', !day.markBelow && 'flex-row')}>
        {day.today ? (
          <View className={cn(z.circle, "items-center justify-center rounded-full bg-olive")}>
            <Text size={z.num} weight="900" color="on-olive">
              {day.num}
            </Text>
          </View>
        ) : (
          <View className={cn(z.numRow, "justify-center")}>
            <Text size={z.num} weight="800">
              {day.num}
            </Text>
          </View>
        )}
        {day.reminders ? <Icon name="alarm" size={17} color="olive" /> : null}
      </View>
    </Pressable>
  );
}

function Block({ block, onPress, size }: { block: WeekBlock; onPress: () => void; size: HourGridSize }) {
  const z = SIZES[size];
  const rounded = z.radius;
  // The outer box is the lane; its 1 px padding keeps blocks apart (no calc() in React Native).
  return (
    <View
      pointerEvents="box-none"
      className="absolute px-[1px]"
      style={{
        top: block.y,
        height: block.height,
        left: `${(block.lane * 100) / block.lanes}%`,
        width: `${100 / block.lanes}%`,
      }}
    >
      <Pressable
        role="link"
        aria-label={block.label}
        onPress={onPress}
        className={cn(
          "flex-1 gap-[1px] overflow-hidden",
          z.block,
          rounded,
          focusRing,
        )}
      >
        <Fill colors={block.colors} rounded={rounded} />
        {/* React Native has no inset shadow: the outline and the left edge are drawn over the fill. */}
        {block.kind === "slot" ? (
          <View
            aria-hidden
            className={cn("absolute inset-0 border-event-outline", rounded)}
            style={{ borderWidth: 1.5 }}
          />
        ) : (
          <View
            aria-hidden
            className="absolute bottom-0 left-0 top-0 w-[3px] bg-ink"
          />
        )}
        {block.top ? (
          <Text
            size={z.top}
            weight="900"
            numberOfLines={1}
            ellipsizeMode="clip"
            style={[{ lineHeight: z.topLine }, clipOnWeb]}
          >
            {block.top}
          </Text>
        ) : null}
        <Text size={z.title} weight="800" style={{ lineHeight: z.titleLine }}>
          {block.title}
        </Text>
      </Pressable>
    </View>
  );
}

function Column({
  column,
  nowY,
  onBlockPress,
  onDayPress,
  onEmptyLongPress,
  size,
}: { column: WeekColumn; nowY: number | null; size: HourGridSize } & Pick<
  HourGridProps,
  "onBlockPress" | "onDayPress" | "onEmptyLongPress"
>) {
  const hour = SIZES[size].hour;
  const onLongPress = (e: GestureResponderEvent) =>
    onEmptyLongPress(column.date, hourAt(e.nativeEvent?.locationY, hour));
  return (
    <View
      className={cn(
        "relative min-w-0 flex-1",
        column.today && "bg-calendar-today-tint",
      )}
      style={{ height: GRID_HOURS * hour }}
    >
      <Pressable
        role="link"
        aria-label={column.label}
        accessibilityActions={[{ name: "longpress", label: column.addLabel }]}
        onAccessibilityAction={(e) =>
          e.nativeEvent.actionName === "longpress" &&
          onEmptyLongPress(column.date, null)
        }
        onPress={() => onDayPress(column.date)}
        onLongPress={onLongPress}
        className={cn("absolute inset-0", focusRing)}
      />
      {column.blocks.map((b) => (
        <Block key={b.key} block={b} onPress={() => onBlockPress(b.key)} size={size} />
      ))}
      {column.today && nowY !== null ? (
        <View
          aria-hidden
          pointerEvents="none"
          className="absolute z-10 h-[2px] bg-olive"
          style={{ top: nowY, left: -2, right: -2 }}
        />
      ) : null}
    </View>
  );
}

/**
 * The week view's grid (HourGrid README, OC-CalWeek): a row of days (tap → Day view), an "All day"
 * row of bars spanning their days, then 06:00–24:00 at 36 px per hour (44 from 600) with each day's events at
 * their times, side by side where they overlap. Today's column is tinted, with the now line. The
 * day and All day rows stay at the top; the hours scroll under them, so the card fills its parent.
 */
export function HourGrid({
  days,
  allDayLabel,
  bars,
  columns,
  hourLabels,
  nowY,
  onDayPress,
  onBlockPress,
  onEmptyLongPress,
  bottomInset = 0,
  size = "phone",
}: HourGridProps) {
  const z = SIZES[size];
  const gridHeight = GRID_HOURS * z.hour;
  const barRows = bars.reduce((n, b) => Math.max(n, b.lane + 1), 1);
  return (
    <View className="flex-1 overflow-hidden rounded-t-[20px] bg-surface-card">
      <View
        className="z-10 bg-surface-card"
        style={{ boxShadow: theme.shadow.sticky }}
      >
        <View className={cn("flex-row gap-[2px] border-b-[1.5px] border-line pb-8 pr-4 pt-8", z.pad)}>
          {days.map((d) => (
            <DayHead key={d.date} day={d} onPress={() => onDayPress(d.date)} size={size} />
          ))}
        </View>

        <View className="flex-row items-center border-b-[1.5px] border-line pb-8 pr-4 pt-6">
          <View className={cn(z.gutter, "flex-none pr-6")}>
            <Text size={z.label} weight="900" color="ink-muted" align="right">
              {allDayLabel}
            </Text>
          </View>
          <View
            className="relative min-w-0 flex-1"
            style={{ height: barRows * z.barStep - 2 }}
          >
            {bars.map(({ key, ...bar }) => (
              <EventBar
                {...bar}
                key={key}
                size={z.bar}
                onPress={() => onBlockPress(key)}
              />
            ))}
          </View>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: bottomInset }}
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-row pb-10 pr-4 pt-8">
          <View
            aria-hidden
            className={cn("relative flex-none", z.gutter)}
            style={{ height: gridHeight }}
          >
            {hourLabels.map((label, i) => (
              <Text
                key={label}
                size={z.label}
                weight="800"
                color="ink-muted"
                className="absolute right-6"
                style={{ top: i === 0 ? 0 : i * z.hour - z.labelTop }}
              >
                {label}
              </Text>
            ))}
          </View>
          <View
            className="relative min-w-0 flex-1 flex-row gap-[2px]"
            style={{ height: gridHeight }}
          >
            {hourLabels.map((label, i) => (
              <View
                key={label}
                aria-hidden
                pointerEvents="none"
                className="absolute left-0 right-0 h-[1px] bg-line"
                style={{ top: i * z.hour }}
              />
            ))}
            {columns.map((c) => (
              <Column
                key={c.date}
                column={c}
                nowY={nowY}
                onBlockPress={onBlockPress}
                onDayPress={onDayPress}
                onEmptyLongPress={onEmptyLongPress}
                size={size}
              />
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
