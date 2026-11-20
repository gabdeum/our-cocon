import { useCallback, useMemo, useState } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import type { SlotTimes, WeekStartsOn } from '@cocon/calendar';
import type { StoredEvent } from '@cocon/data';
import { FloatingAdd, MonthGrid, tabBottomPad, theme, useLayoutTier } from '@cocon/ui';
import { isDayEvent, layoutDaySheet } from '../../lib/calendar-day';
import { placeForScreen, reminderCounts, type CalendarReminders } from '../../lib/calendar-reminders';
import {
  INITIALS_MIN_WIDTH,
  chipRowsFor,
  eventWindow,
  firstWeekOfMonth,
  layoutWeek,
  memberLook,
  monthOccurrences,
  monthRange,
  monthRowHeight,
  monthShownAt,
  parseOccurrenceKey,
  weekIndexOf,
  weekdayLetters,
  weekdayShort,
} from '../../lib/calendar-month';
import type { Member } from '../../lib/session';
import { useNow } from '../../lib/use-now';
import { useCalendarDisplay } from '../../lib/calendar-prefs';
import { strings } from '../../strings/en';
import { DayPanel } from './DayPanel';
import { DaySheet } from './DaySheet';

const m = strings.calendar.month;

export interface MonthViewProps {
  /** Screen width: chips carry initials from 430 px up (FR-003). */
  width: number;
  members: Member[];
  myMemberId: string;
  /** Loaded for `eventWindow(month)`; undefined while loading (the grid shows empty days). */
  events: StoredEvent[] | undefined;
  slotTimes: SlotTimes;
  /** Hidden in the header's filter: member ids, "everyone", "others". */
  hidden: ReadonlySet<string>;
  /** The 1st of the month the grid opens on. */
  month: string;
  today: string;
  /** The family's home time zone, for "Now" in the day sheet. */
  timeZone: string;
  weekStartsOn: WeekStartsOn;
  /** ‹ ›: scroll so this month's first week is at the top. Today (`toToday`): today's week is the second row (spec 053 FR-008). */
  jump?: { month: string; toToday?: boolean; nonce: number };
  /** The month that fills the grid changed (FR-005), as its 1st. */
  onMonthShown: (month: string) => void;
  /** FR-008: a day's sheet opened, with how many events it lists (`calendar_day_sheet_opened`). */
  onDaySheetOpened: (events: number) => void;
  onAddEvent: (date: string) => void;
  onOpenEvent: (id: string, date: string) => void;
  showHint: boolean;
  onDismissHint: () => void;
  /** Spec 058: a mark on days with reminders, and the reminders in the day sheet with its toggle. */
  reminders?: CalendarReminders;
  showReminders?: boolean;
  onShowReminders?: (on: boolean) => void;
  /** From 600 (spec 070): the day whose panel is open, and a tap on another day. */
  selected?: string;
  onSelect?: (date: string) => void;
}

/**
 * Spec 037 (OC-CalMonth): the continuous month grid, the first-visit hint and the add button. From
 * 600 wide (spec 070) the same scroll with larger rows, the selected day's panel under it (medium)
 * or beside it (expanded), and no add button (the header has "+ Event").
 */
export function MonthView({
  width,
  members,
  myMemberId,
  events,
  slotTimes,
  hidden,
  month,
  today,
  timeZone,
  weekStartsOn,
  jump,
  onMonthShown,
  onDaySheetOpened,
  onAddEvent,
  onOpenEvent,
  showHint,
  onDismissHint,
  reminders,
  showReminders = true,
  onShowReminders = () => undefined,
  selected = month,
  onSelect = () => undefined,
}: MonthViewProps) {
  const { tier } = useLayoutTier();
  const range = useMemo(() => monthRange(today, weekStartsOn), [today, weekStartsOn]);
  const look = useMemo(() => memberLook(members), [members]);
  const { from, to } = eventWindow(month);
  const occurrences = useMemo(() => monthOccurrences(events ?? [], from, to, myMemberId, hidden), [events, from, to, myMemberId, hidden]);
  // FR-003: narrow phones show the title alone on chips and bars.
  const initials = width >= INITIALS_MIN_WIDTH;
  // Spec 058: whether a day's alarm clock fits beside its date depends on the cell's real width and the text size.
  const [gridWidth, setGridWidth] = useState<number | undefined>(undefined);
  const { fontScale } = useWindowDimensions();
  const cellWidth = gridWidth === undefined ? undefined : gridWidth / 7;
  const { use24h, fade_past: fadePast } = useCalendarDisplay().prefs;
  const counts = useMemo(
    () => reminderCounts(placeForScreen(showReminders ? reminders : undefined, { from, to, today, tz: timeZone, members, use24h, hidden }).values()),
    [showReminders, reminders, from, to, today, timeZone, members, use24h, hidden],
  );
  const weekAt = useCallback(
    (index: number) => layoutWeek(index, occurrences, { range, today, look, slotTimes, initials, reminders: counts, cellWidth, textScale: fontScale }),
    [occurrences, range, today, look, slotTimes, initials, counts, cellWidth, fontScale],
  );
  // Opens with the month's first week at the top, and today on screen when it's this month.
  const [initialIndex] = useState(() => firstWeekOfMonth(range, month));
  const keepVisibleIndex = month === `${today.slice(0, 8)}01` ? weekIndexOf(range, today) : undefined;
  // FR-008/FR-009: a tap on a day opens its sheet; the sheet closes before an event or Add opens.
  const now = useNow(timeZone);
  const [sheetDate, setSheetDate] = useState<string | null>(null);
  const dayCtx = useMemo(() => ({ today, now, look, slotTimes, members, use24h }), [today, now, look, slotTimes, members, use24h]);
  const openDay = useCallback(
    (date: string) => {
      setSheetDate(date);
      onDaySheetOpened(layoutDaySheet(date, occurrences, dayCtx).rows.filter(isDayEvent).length);
    },
    [occurrences, dayCtx, onDaySheetOpened],
  );
  const openEvent = (key: string) => {
    const { id, date } = parseOccurrenceKey(key);
    setSheetDate(null);
    onOpenEvent(id, date);
  };
  const gridJump = useMemo(
    () => (jump ? { index: jump.toToday ? Math.max(0, weekIndexOf(range, today) - 1) : firstWeekOfMonth(range, jump.month), nonce: jump.nonce } : undefined),
    [jump, range, today],
  );
  const content = { occurrences, ctx: dayCtx, timeZone, hidden, reminders, showReminders, onShowReminders, onOpenEvent: openEvent };
  // From 600: rows 124 (medium), or sharing the grid's height five weeks at a time (expanded, 124 until it's measured; the grid keeps its top week).
  const [gridHeight, setGridHeight] = useState<number | undefined>(undefined);
  const rowHeight = monthRowHeight(tier, gridHeight, 5);
  const wideWeekAt = useCallback(
    (index: number) =>
      layoutWeek(index, occurrences, { range, today, look, slotTimes, initials: true, reminders: counts, textScale: fontScale, rows: chipRowsFor(rowHeight), wide: true, cellWidth }),
    [occurrences, range, today, look, slotTimes, counts, fontScale, rowHeight, cellWidth],
  );
  const grid = (weekAtIndex: typeof weekAt, wide?: { rowHeight: number; selected: string }) => (
    <MonthGrid
      mutePast={fadePast}
      weekdays={wide ? weekdayShort(weekStartsOn) : weekdayLetters(weekStartsOn)}
      weekCount={range.weekCount}
      weekAt={weekAtIndex}
      initialIndex={initialIndex}
      keepVisibleIndex={keepVisibleIndex}
      jump={gridJump}
      onTopRowChange={(top) => onMonthShown(monthShownAt(range, top))}
      // From 600 a tap selects the day for the panel (spec 070, L161); on the phone it opens the day sheet.
      onDayPress={wide ? onSelect : openDay}
      onDayLongPress={onAddEvent}
      addLabel={m.addEvent}
      wide={wide}
    />
  );

  if (tier !== 'compact') {
    const bottom = tabBottomPad(tier);
    const panel = (columns: 1 | 2) => <DayPanel date={selected} columns={columns} {...content} onAdd={() => onAddEvent(selected)} />;
    const measure = (e: { nativeEvent: { layout: { width: number; height: number } } }) => {
      setGridWidth(e.nativeEvent.layout.width);
      setGridHeight(e.nativeEvent.layout.height);
    };
    const wideGrid = grid(wideWeekAt, { rowHeight, selected });
    // Spec 070 FR-003/FR-004 (OC-CalendarResponsive): the panel under the grid (medium) or 320 beside it (expanded).
    if (tier === 'medium') {
      return (
        <View className="flex-1 gap-16 px-24 pt-4">
          <View className="min-h-0" style={{ flex: 3 }} onLayout={measure}>
            {wideGrid}
          </View>
          <ScrollView style={{ flex: 2 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: bottom }}>
            {panel(2)}
          </ScrollView>
        </View>
      );
    }
    return (
      <View className="flex-1 flex-row items-start gap-16 px-24 pt-4" style={{ paddingBottom: bottom }}>
        <View className="min-w-0 flex-1 self-stretch" onLayout={measure}>
          {wideGrid}
        </View>
        <ScrollView className="self-stretch" style={{ width: theme.layout.panelExpanded, flexGrow: 0 }} showsVerticalScrollIndicator={false}>
          {panel(1)}
        </ScrollView>
      </View>
    );
  }

  return (
    <View className="flex-1" onLayout={(e) => setGridWidth(e.nativeEvent.layout.width)}>
      {grid(weekAt)}
      <FloatingAdd label={m.addEvent} onPress={() => onAddEvent(today)} hint={showHint ? { text: m.hint, actionLabel: m.gotIt, onAction: onDismissHint } : null} />
      {sheetDate ? (
        <DaySheet
          date={sheetDate}
          {...content}
          onClose={() => setSheetDate(null)}
          onAdd={() => {
            setSheetDate(null);
            onAddEvent(sheetDate);
          }}
        />
      ) : null}
    </View>
  );
}
