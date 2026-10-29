import { useCallback, useEffect, useMemo, useRef, type ReactElement } from 'react';
import { FlatList, Pressable, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { cn, focusRing } from '../cn';
import { theme } from '../theme';
import { EventBar, EventChip, MoreCount, type EventColor } from './EventChip';
import { Text } from './Text';

/** MonthGrid README › Cell: every day is 96 tall, so a row's offset is its index × 96. */
export const MONTH_ROW_HEIGHT = 96;
/** Room under the last row for the floating tab bar (TabBar README: screens pad 180). */
const BOTTOM_PAD = 180;
/** The title row counts a row as visible once all but its top 24 px have scrolled away (OC-CalMonth). */
const ROW_SLACK = 24;

export type MonthCellItem = { kind: 'chip'; key: string; text: string; colors: readonly EventColor[] } | { kind: 'space'; key: string };

export interface MonthCell {
  date: string;
  /** "October 25: Baby swim, Movie night" or "October 25: nothing planned". */
  label: string;
  /** "25", or "Nov 1" on the 1st (an ink pill). */
  dateText: string;
  first: boolean;
  today: boolean;
  past: boolean;
  /** At most two rows: chips, or empty space under a multi-day bar. */
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
  onDayPress: (date: string) => void;
  onDayLongPress: (date: string) => void;
  onBarPress: (key: string) => void;
  /** A chip tapped: its event opens (decided 2026-10-28); anywhere else in the cell opens the day. */
  onChipPress: (key: string) => void;
  /** Screen readers can't long-press: the same action, named "Add event". */
  addLabel: string;
  /** Past days on surface-page with muted dates (the setting comes with spec 029). */
  mutePast?: boolean;
}

function DateMark({ cell, muted }: { cell: MonthCell; muted: boolean }) {
  if (cell.today || cell.first) {
    return (
      <View className={cn('h-[22px] items-center justify-center self-start rounded-sm', cell.today ? 'min-w-[22px] bg-olive' : 'bg-ink px-[7px]')}>
        <Text size={12} weight="900" color="on-olive" numberOfLines={1}>
          {cell.dateText}
        </Text>
      </View>
    );
  }
  return (
    <View className="h-[22px] justify-center pl-[3px]">
      <Text size={12} weight="800" color={muted ? 'ink-muted' : 'ink'}>
        {cell.dateText}
      </Text>
    </View>
  );
}

function Cell({ cell, mutePast, addLabel, onPress, onLongPress, onChipPress }: { cell: MonthCell; mutePast: boolean; addLabel: string; onPress: () => void; onLongPress: () => void; onChipPress: (key: string) => void }) {
  const muted = mutePast && cell.past && !cell.today;
  return (
    <Pressable
      role="link"
      aria-label={cell.label}
      accessibilityActions={[{ name: 'longpress', label: addLabel }]}
      onAccessibilityAction={(e) => e.nativeEvent.actionName === 'longpress' && onLongPress()}
      onPress={onPress}
      onLongPress={onLongPress}
      className={cn('h-[96px] min-w-0 flex-1 gap-[3px] overflow-hidden border-b border-r border-line px-4 pb-6 pt-4', muted ? 'bg-surface-page' : 'bg-surface-card', focusRing)}
    >
      <DateMark cell={cell} muted={muted} />
      {cell.items.map((item) => (item.kind === 'chip' ? <EventChip key={item.key} text={item.text} colors={item.colors} onPress={() => onChipPress(item.key)} /> : <View key={item.key} className="h-[20px]" />))}
      {cell.more ? <MoreCount text={cell.more} /> : null}
      {cell.today ? <View aria-hidden pointerEvents="none" className="absolute inset-0 border-olive" style={{ borderWidth: 2.5 }} /> : null}
    </Pressable>
  );
}

function Week({ week, ...p }: { week: MonthWeek } & Pick<MonthGridProps, 'onDayPress' | 'onDayLongPress' | 'onBarPress' | 'onChipPress' | 'addLabel'> & { mutePast: boolean }) {
  return (
    <View className="h-[96px] bg-surface-card">
      <View className="flex-row">
        {week.cells.map((cell) => (
          <Cell key={cell.date} cell={cell} mutePast={p.mutePast} addLabel={p.addLabel} onPress={() => p.onDayPress(cell.date)} onLongPress={() => p.onDayLongPress(cell.date)} onChipPress={p.onChipPress} />
        ))}
      </View>
      {week.bars.map((bar) => (
        <EventBar {...bar} key={bar.key} onPress={() => p.onBarPress(bar.key)} />
      ))}
    </View>
  );
}

/**
 * The continuous month grid (MonthGrid README, OC-CalMonth): a fixed weekday row over one
 * virtualised vertical list of week rows, each 96 tall, with multi-day bars drawn over the cells.
 */
export function MonthGrid({ weekdays, weekCount, weekAt, initialIndex, keepVisibleIndex, jump, onTopRowChange, mutePast = true, ...p }: MonthGridProps) {
  const list = useRef<FlatList<number>>(null);
  const top = useRef(initialIndex);
  const placed = useRef(false);
  const data = useMemo(() => Array.from({ length: weekCount }, (_, i) => i), [weekCount]);

  useEffect(() => {
    if (jump) list.current?.scrollToOffset({ offset: jump.index * MONTH_ROW_HEIGHT, animated: true });
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
    ({ item }: { item: number }): ReactElement => <Week week={weekAt(item)} mutePast={mutePast} onDayPress={p.onDayPress} onDayLongPress={p.onDayLongPress} onBarPress={p.onBarPress} onChipPress={p.onChipPress} addLabel={p.addLabel} />,
    [weekAt, mutePast, p.onDayPress, p.onDayLongPress, p.onBarPress, p.onChipPress, p.addLabel],
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
