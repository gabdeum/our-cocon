import { useCallback, useEffect, useMemo, useRef, type ReactElement } from 'react';
import { FlatList, Platform, Pressable, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent, type TextStyle } from 'react-native';
import { LARGE_TEXT_SCALE, pressedState, useLargeText } from '../a11y';
import { useReduceMotion } from '../reduceMotion';
import { cn, focusRing } from '../cn';
import { tabBottomPad, useLayoutTier } from '../layout';
import { theme } from '../theme';
import { EventBar, EventChip, Fill, MoreCount, type ChipSize, type EventColor } from './EventChip';
import { Icon } from './Icon';
import { Text } from './Text';

/** MonthGrid README › Cell: every day is 120 tall, so a row's offset is its index × 120. */
export const MONTH_ROW_HEIGHT = 120;
/** The title row counts a row as visible once all but its top 24 px have scrolled away (OC-CalMonth). */
const ROW_SLACK = 24;

export type MonthCellItem =
  | { kind: 'chip'; key: string; text: string; colors: readonly EventColor[] }
  /** An empty row: under a bar, or the week's alarm-clock row (spec 058), with the clock when `mark`. */
  | { kind: 'space'; key: string; mark?: boolean };

export interface MonthCell {
  date: string;
  /** "October 25: Baby swim (James), Movie night (Everyone)" or "October 25: nothing planned". */
  label: string;
  /** "25", or "Nov 1" on the 1st (an ink pill). */
  dateText: string;
  first: boolean;
  today: boolean;
  past: boolean;
  /** At most five rows (four with "+N"): chips, or empty space under a multi-day bar. */
  items: MonthCellItem[];
  /** "+2", or null. */
  more: string | null;
  /** Reminders are due that day: the alarm clock beside the date (spec 058); when it doesn't fit there, it's on the first row (a `space` item with `mark`). */
  reminders?: boolean;
}

export interface MonthBar {
  key: string;
  text: string;
  label: string;
  colors: readonly EventColor[];
  column: number;
  days: number;
  lane: number;
  startsHere: boolean;
  endsHere: boolean;
}

export interface MonthWeek {
  key: string;
  cells: MonthCell[];
  bars: MonthBar[];
}

export interface MonthGridProps {
  /** Seven letters, from the first day of the week. */
  weekdays: readonly string[];
  weekCount: number;
  /** Built only for the rows on screen. */
  weekAt: (index: number) => MonthWeek;
  /** The row at the top when the grid opens. */
  initialIndex: number;
  /** A row that must be on screen when the grid opens (today's). */
  keepVisibleIndex?: number;
  /** Scrolls so this row is at the top; a new `nonce` scrolls again to the same row. */
  jump?: { index: number; nonce: number };
  /** The row at the top changed (for the header title). */
  onTopRowChange: (index: number) => void;
  /** A tap anywhere on a day, chips and bars included, opens its day sheet (spec 037 FR-008). */
  onDayPress: (date: string) => void;
  onDayLongPress: (date: string) => void;
  /** Screen readers can't long-press: the same action, named "Add event". */
  addLabel: string;
  /** Past days on surface-page with muted dates (the setting comes with spec 029). */
  mutePast?: boolean;
}

// react-native-web always adds an ellipsis to one-line text, but lets the style override it (iOS uses ellipsizeMode).
const clipOnWeb = (Platform.OS === 'web' ? { textOverflow: 'clip' } : {}) as TextStyle;

/** MonthGrid README › Date: an 18 px row with 11 px text; from 600 (spec 070) a 24 px row with 14 px text. */
const DATE = {
  phone: { row: 'h-[18px]', badge: 'h-[18px] min-w-[18px] rounded-[9px]', text: 11, line: 18 },
  wide: { row: 'h-[24px]', badge: 'h-[24px] min-w-[24px] rounded-[12px]', text: 14, line: 24 },
} as const;

function DateMark({ cell, muted, size }: { cell: MonthCell; muted: boolean; size: ChipSize }) {
  const d = DATE[size];
  const mark = cell.reminders ? <Icon name="alarm" size={13} color={muted ? 'inkMuted' : 'olive'} /> : null;
  // MonthGrid README › Date: today is an olive circle; the 1st an ink pill "Nov 1" (olive when the
  // 1st is today), clipped with no "…". A day with reminders adds a 13 px alarm clock.
  if (cell.first || cell.today) {
    return (
      <View className={cn(d.row, 'max-w-full flex-row items-center gap-[2px] self-start')}>
        <View className={cn(d.badge, 'flex-shrink items-center justify-center', cell.first && 'px-[5px]', cell.today ? 'bg-olive' : 'bg-ink')}>
          <Text size={d.text} weight="900" color={cell.today ? 'on-olive' : 'on-ink'} numberOfLines={1} ellipsizeMode="clip" maxFontSizeMultiplier={LARGE_TEXT_SCALE} style={[{ lineHeight: d.line }, clipOnWeb]}>
            {cell.dateText}
          </Text>
        </View>
        {mark}
      </View>
    );
  }
  return (
    <View className={cn(d.row, 'flex-row items-center gap-[2px] pl-[3px]')}>
      <Text size={d.text} weight="800" color={muted ? 'ink-muted' : 'ink'} maxFontSizeMultiplier={LARGE_TEXT_SCALE} style={{ lineHeight: d.line }}>
        {cell.dateText}
      </Text>
      {mark}
    </View>
  );
}

/** An empty chip row (15 px, 20 from 600); the week's alarm-clock row holds the clock of a day whose date left no room for it (spec 058). */
function SpaceRow({ mark, muted, size = 'phone' }: { mark?: boolean; muted?: boolean; size?: ChipSize }) {
  return <View className={cn(size === 'wide' ? 'h-[20px]' : 'h-[15px]', 'justify-center pl-[3px]')}>{mark ? <Icon name="alarm" size={13} color={muted ? 'inkMuted' : 'olive'} /> : null}</View>;
}

/**
 * Largest text sizes (spec 030 User Story 3): the first chip, then a dot per further event, so nothing
 * is cut mid-word in a 120 px cell. The cell's label still names every event; the day sheet shows them.
 */
function LargeTextItems({ cell, muted, size }: { cell: MonthCell; muted: boolean; size: ChipSize }) {
  const chips = cell.items.filter((i): i is Extract<MonthCellItem, { kind: 'chip' }> => i.kind === 'chip');
  const [first, ...rest] = chips;
  const spaces = cell.items.filter((i): i is Extract<MonthCellItem, { kind: 'space' }> => i.kind === 'space');
  return (
    <>
      {spaces.map((item) => (
        <SpaceRow key={item.key} mark={item.mark} muted={muted} size={size} />
      ))}
      {first ? <EventChip text={first.text} colors={first.colors} size={size} /> : null}
      {rest.length || cell.more ? (
        <View aria-hidden className="flex-row flex-wrap gap-[3px] pl-[3px] pt-[2px]">
          {rest.map((c) => (
            <View key={c.key} className="h-[8px] w-[8px]">
              <Fill colors={c.colors} rounded="rounded-full" />
            </View>
          ))}
          {cell.more ? <MoreCount text={cell.more} size={size} /> : null}
        </View>
      ) : null}
    </>
  );
}

interface CellLook {
  size: ChipSize;
  /** From 600: the row's height, a day outside the month shown (faded) and the selected day (spec 070). */
  height?: number;
  outside?: boolean;
  selected?: boolean;
}

function Cell({
  cell,
  mutePast,
  addLabel,
  onPress,
  onLongPress,
  look = { size: 'phone' },
}: {
  cell: MonthCell;
  mutePast: boolean;
  addLabel: string;
  onPress: () => void;
  onLongPress: () => void;
  look?: CellLook;
}) {
  const wide = look.size === 'wide';
  const muted = (mutePast && cell.past && !cell.today) || !!look.outside;
  const largeText = useLargeText();
  return (
    <Pressable
      role="button"
      // Phone: a tap opens the day sheet. From 600 it selects the day for the panel beside or below.
      aria-haspopup={wide ? undefined : 'dialog'}
      {...(wide ? pressedState(!!look.selected) : {})}
      aria-label={cell.label}
      accessibilityActions={[{ name: 'longpress', label: addLabel }]}
      onAccessibilityAction={(e) => e.nativeEvent.actionName === 'longpress' && onLongPress()}
      onPress={onPress}
      onLongPress={onLongPress}
      className={cn(
        'min-w-0 flex-1 gap-[2px] overflow-hidden border-b border-r border-line',
        wide ? 'p-6' : 'h-[120px] px-[3px] pb-4 pt-[3px]',
        muted && !(wide && look.selected) ? 'bg-surface-page' : 'bg-surface-card',
        focusRing,
      )}
      style={wide ? { height: look.height } : undefined}
    >
      <DateMark cell={cell} muted={muted} size={look.size} />
      {largeText ? (
        <LargeTextItems cell={cell} muted={muted} size={look.size} />
      ) : (
        <>
          {cell.items.map((item) =>
            item.kind === 'chip' ? <EventChip key={item.key} text={item.text} colors={item.colors} size={look.size} /> : <SpaceRow key={item.key} mark={item.mark} muted={muted} size={look.size} />,
          )}
          {cell.more ? <MoreCount text={cell.more} size={look.size} /> : null}
        </>
      )}
      {/* The selected day (from 600) is ringed in ink; today keeps its olive ring otherwise. */}
      {look.selected ? (
        <View aria-hidden pointerEvents="none" className="absolute inset-0 border-ink" style={{ borderWidth: 2.5 }} />
      ) : cell.today ? (
        <View aria-hidden pointerEvents="none" className="absolute inset-0 border-olive" style={{ borderWidth: 2.5 }} />
      ) : null}
    </Pressable>
  );
}

function Week({
  week,
  look,
  ...p
}: { week: MonthWeek; look?: (cell: MonthCell) => CellLook } & Pick<MonthGridProps, 'onDayPress' | 'onDayLongPress' | 'addLabel'> & { mutePast: boolean; height?: number }) {
  const wide = look !== undefined;
  return (
    <View className={cn('bg-surface-card', !wide && 'h-[120px]')} style={wide ? { height: p.height } : undefined}>
      <View className="flex-row">
        {week.cells.map((cell) => (
          <Cell
            key={cell.date}
            cell={cell}
            mutePast={p.mutePast}
            addLabel={p.addLabel}
            onPress={() => p.onDayPress(cell.date)}
            onLongPress={() => p.onDayLongPress(cell.date)}
            look={look?.(cell)}
          />
        ))}
      </View>
      {week.bars.map((bar) => (
        <EventBar {...bar} key={bar.key} size={wide ? 'month-wide' : 'month'} />
      ))}
    </View>
  );
}

export interface MonthPageProps extends Pick<MonthGridProps, 'onDayPress' | 'onDayLongPress' | 'addLabel' | 'mutePast'> {
  /** "Sun" … "Sat", from the first day of the week. */
  weekdays: readonly string[];
  /** The month's rows, from the one holding its 1st to the one holding its last day. */
  weeks: readonly MonthWeek[];
  /** The 1st of the month shown: days around it are faded. */
  month: string;
  /** Each row's height: 124 at medium, sharing the window's height at expanded. */
  rowHeight: number;
  /** The day whose panel is open: ringed in ink. */
  selected: string;
}

/**
 * From 600 wide (spec 070 FR-003/FR-004, MonthGrid README › From 600): one month at a time in a
 * white card, weekday names over the rows, larger dates and 20 px chips. A tap selects a day.
 */
export function MonthPage({ weekdays, weeks, month, rowHeight, selected, mutePast = true, ...p }: MonthPageProps) {
  const inMonth = month.slice(0, 7);
  const look = (cell: MonthCell): CellLook => ({ size: 'wide', height: rowHeight, outside: cell.date.slice(0, 7) !== inMonth, selected: cell.date === selected });
  return (
    <View className="overflow-hidden rounded-[22px] bg-surface-card">
      <View aria-hidden className="flex-row border-b-[1.5px] border-line pb-6 pt-8">
        {weekdays.map((w, i) => (
          <Text key={i} size={13} weight="900" color="ink-muted" align="center" className="flex-1">
            {w}
          </Text>
        ))}
      </View>
      {weeks.map((week) => (
        <Week key={week.key} week={week} look={look} height={rowHeight} mutePast={mutePast} onDayPress={p.onDayPress} onDayLongPress={p.onDayLongPress} addLabel={p.addLabel} />
      ))}
    </View>
  );
}

/**
 * The continuous month grid (MonthGrid README, OC-CalMonth): a fixed weekday row over one
 * virtualised vertical list of week rows, each 120 tall, with multi-day bars drawn over the cells.
 */
export function MonthGrid({ weekdays, weekCount, weekAt, initialIndex, keepVisibleIndex, jump, onTopRowChange, mutePast = true, ...p }: MonthGridProps) {
  const list = useRef<FlatList<number>>(null);
  // Room under the last row for the floating tab bar: 180, or 28 beside the rail (spec 064).
  const bottomPad = tabBottomPad(useLayoutTier().tier);
  const top = useRef(initialIndex);
  const placed = useRef(false);
  const data = useMemo(() => Array.from({ length: weekCount }, (_, i) => i), [weekCount]);
  // Reduce Motion: month jumps are instant (spec 030 FR-004). Read through a ref: only a new jump scrolls.
  const reduce = useReduceMotion();
  const reduceMotion = useRef(reduce);
  useEffect(() => {
    reduceMotion.current = reduce;
  }, [reduce]);

  useEffect(() => {
    if (jump) list.current?.scrollToOffset({ offset: jump.index * MONTH_ROW_HEIGHT, animated: !reduceMotion.current });
  }, [jump]);

  // FR-001: open on the first week of the month, moved down just enough to show today's row.
  const onLayout = (e: LayoutChangeEvent) => {
    if (placed.current) return;
    placed.current = true;
    const visibleRows = Math.floor((e.nativeEvent.layout.height - bottomPad) / MONTH_ROW_HEIGHT);
    let index = initialIndex;
    if (keepVisibleIndex !== undefined && visibleRows > 0 && keepVisibleIndex >= index + visibleRows) index = keepVisibleIndex - visibleRows + 1;
    list.current?.scrollToOffset({ offset: index * MONTH_ROW_HEIGHT, animated: false });
    if (index !== top.current) {
      top.current = index;
      onTopRowChange(index);
    }
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.max(0, Math.floor((e.nativeEvent.contentOffset.y + ROW_SLACK) / MONTH_ROW_HEIGHT));
    if (index === top.current) return;
    top.current = index;
    onTopRowChange(index);
  };

  const renderItem = useCallback(
    ({ item }: { item: number }): ReactElement => <Week week={weekAt(item)} mutePast={mutePast} onDayPress={p.onDayPress} onDayLongPress={p.onDayLongPress} addLabel={p.addLabel} />,
    [weekAt, mutePast, p.onDayPress, p.onDayLongPress, p.addLabel],
  );

  return (
    <View className="flex-1 px-8 pt-4">
      <View aria-hidden className="z-10 flex-row rounded-t-[20px] border-b-[1.5px] border-line bg-surface-card pb-6 pt-8" style={{ boxShadow: theme.shadow.sticky }}>
        {weekdays.map((w, i) => (
          <Text key={i} size={12} weight="900" color="ink-muted" align="center" className="flex-1">
            {w}
          </Text>
        ))}
      </View>
      <FlatList
        ref={list}
        data={data}
        keyExtractor={String}
        renderItem={renderItem}
        getItemLayout={(_, index) => ({ length: MONTH_ROW_HEIGHT, offset: index * MONTH_ROW_HEIGHT, index })}
        initialScrollIndex={initialIndex}
        initialNumToRender={8}
        windowSize={7}
        onLayout={onLayout}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={<View style={{ height: bottomPad }} />}
      />
    </View>
  );
}
