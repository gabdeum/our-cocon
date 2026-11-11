import { useCallback, useEffect, useMemo, useRef, type ReactElement } from 'react';
import { FlatList, Platform, Pressable, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent, type TextStyle } from 'react-native';
import { LARGE_TEXT_SCALE, useLargeText } from '../a11y';
import { useReduceMotion } from '../reduceMotion';
import { cn, focusRing } from '../cn';
import { theme } from '../theme';
import { EventBar, EventChip, Fill, MoreCount, type EventColor } from './EventChip';
import { Text } from './Text';

/** MonthGrid README › Cell: every day is 120 tall, so a row's offset is its index × 120. */
export const MONTH_ROW_HEIGHT = 120;
/** Room under the last row for the floating tab bar (TabBar README: screens pad 180). */
const BOTTOM_PAD = 180;
/** The title row counts a row as visible once all but its top 24 px have scrolled away (OC-CalMonth). */
const ROW_SLACK = 24;

export type MonthCellItem = { kind: 'chip'; key: string; text: string; colors: readonly EventColor[] } | { kind: 'space'; key: string };

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

function DateMark({ cell, muted }: { cell: MonthCell; muted: boolean }) {
  // MonthGrid README › Date: an 18 px row. Today is an olive circle; the 1st an ink pill "Nov 1"
  // (olive when the 1st is today), clipped with no "…".
  if (cell.first || cell.today) {
    return (
      <View className={cn('h-[18px] min-w-[18px] items-center justify-center self-start rounded-[9px]', cell.first && 'max-w-full px-[5px]', cell.today ? 'bg-olive' : 'bg-ink')}>
        <Text size={11} weight="900" color={cell.today ? 'on-olive' : 'on-ink'} numberOfLines={1} ellipsizeMode="clip" maxFontSizeMultiplier={LARGE_TEXT_SCALE} style={[{ lineHeight: 18 }, clipOnWeb]}>
          {cell.dateText}
        </Text>
      </View>
    );
  }
  return (
    <View className="h-[18px] justify-center pl-[3px]">
      <Text size={11} weight="800" color={muted ? 'ink-muted' : 'ink'} maxFontSizeMultiplier={LARGE_TEXT_SCALE} style={{ lineHeight: 18 }}>
        {cell.dateText}
      </Text>
    </View>
  );
}

/**
 * Largest text sizes (spec 030 User Story 3): the first chip, then a dot per further event, so nothing
 * is cut mid-word in a 120 px cell. The cell's label still names every event; the day sheet shows them.
 */
function LargeTextItems({ cell }: { cell: MonthCell }) {
  const chips = cell.items.filter((i): i is Extract<MonthCellItem, { kind: 'chip' }> => i.kind === 'chip');
  const [first, ...rest] = chips;
  const spaces = cell.items.length - chips.length;
  return (
    <>
      {Array.from({ length: spaces }, (_, i) => (
        <View key={`space-${i}`} className="h-[15px]" />
      ))}
      {first ? <EventChip text={first.text} colors={first.colors} /> : null}
      {rest.length || cell.more ? (
        <View aria-hidden className="flex-row flex-wrap gap-[3px] pl-[3px] pt-[2px]">
          {rest.map((c) => (
            <View key={c.key} className="h-[8px] w-[8px]">
              <Fill colors={c.colors} rounded="rounded-full" />
            </View>
          ))}
          {cell.more ? <MoreCount text={cell.more} /> : null}
        </View>
      ) : null}
    </>
  );
}

function Cell({ cell, mutePast, addLabel, onPress, onLongPress }: { cell: MonthCell; mutePast: boolean; addLabel: string; onPress: () => void; onLongPress: () => void }) {
  const muted = mutePast && cell.past && !cell.today;
  const largeText = useLargeText();
  return (
    <Pressable
      role="button"
      aria-haspopup="dialog"
      aria-label={cell.label}
      accessibilityActions={[{ name: 'longpress', label: addLabel }]}
      onAccessibilityAction={(e) => e.nativeEvent.actionName === 'longpress' && onLongPress()}
      onPress={onPress}
      onLongPress={onLongPress}
      className={cn('h-[120px] min-w-0 flex-1 gap-[2px] overflow-hidden border-b border-r border-line px-[3px] pb-4 pt-[3px]', muted ? 'bg-surface-page' : 'bg-surface-card', focusRing)}
    >
      <DateMark cell={cell} muted={muted} />
      {largeText ? (
        <LargeTextItems cell={cell} />
      ) : (
        <>
          {cell.items.map((item) => (item.kind === 'chip' ? <EventChip key={item.key} text={item.text} colors={item.colors} /> : <View key={item.key} className="h-[15px]" />))}
          {cell.more ? <MoreCount text={cell.more} /> : null}
        </>
      )}
      {cell.today ? <View aria-hidden pointerEvents="none" className="absolute inset-0 border-olive" style={{ borderWidth: 2.5 }} /> : null}
    </Pressable>
  );
}

function Week({ week, ...p }: { week: MonthWeek } & Pick<MonthGridProps, 'onDayPress' | 'onDayLongPress' | 'addLabel'> & { mutePast: boolean }) {
  return (
    <View className="h-[120px] bg-surface-card">
      <View className="flex-row">
        {week.cells.map((cell) => (
          <Cell key={cell.date} cell={cell} mutePast={p.mutePast} addLabel={p.addLabel} onPress={() => p.onDayPress(cell.date)} onLongPress={() => p.onDayLongPress(cell.date)} />
        ))}
      </View>
      {week.bars.map((bar) => (
        <EventBar {...bar} key={bar.key} />
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
    const visibleRows = Math.floor((e.nativeEvent.layout.height - BOTTOM_PAD) / MONTH_ROW_HEIGHT);
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
        ListFooterComponent={<View style={{ height: BOTTOM_PAD }} />}
      />
    </View>
  );
}
