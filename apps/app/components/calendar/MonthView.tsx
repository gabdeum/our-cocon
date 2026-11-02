import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import type { SlotTimes, WeekStartsOn } from '@cocon/calendar';
import type { StoredEvent } from '@cocon/data';
import { FloatingAdd, MonthGrid } from '@cocon/ui';
import { layoutDaySheet } from '../../lib/calendar-day';
import {
  eventWindow,
  firstWeekOfMonth,
  layoutWeek,
  memberLook,
  monthOccurrences,
  monthRange,
  monthShownAt,
  parseOccurrenceKey,
  weekIndexOf,
  weekdayLetters,
} from '../../lib/calendar-month';
import type { Member } from '../../lib/session';
import { useNow } from '../../lib/use-now';
import { strings } from '../../strings/en';
import { DaySheet } from './DaySheet';

const m = strings.calendar.month;

export interface MonthViewProps {
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
  /** ‹ › and Today: scroll so this month's first week is at the top. */
  jump?: { month: string; nonce: number };
  /** The month that fills the grid changed (FR-005), as its 1st. */
  onMonthShown: (month: string) => void;
  /** FR-008: a day's sheet opened, with how many events it lists (`calendar_day_sheet_opened`). */
  onDaySheetOpened: (events: number) => void;
  onAddEvent: (date: string) => void;
  onOpenEvent: (id: string, date: string) => void;
  showHint: boolean;
  onDismissHint: () => void;
}

/** Spec 037 (OC-CalMonth): the continuous month grid, the first-visit hint and the add button. */
export function MonthView({ members, myMemberId, events, slotTimes, hidden, month, today, timeZone, weekStartsOn, jump, onMonthShown, onDaySheetOpened, onAddEvent, onOpenEvent, showHint, onDismissHint }: MonthViewProps) {
  const range = useMemo(() => monthRange(today, weekStartsOn), [today, weekStartsOn]);
  const look = useMemo(() => memberLook(members), [members]);
  const { from, to } = eventWindow(month);
  const occurrences = useMemo(() => monthOccurrences(events ?? [], from, to, myMemberId, hidden), [events, from, to, myMemberId, hidden]);
  const weekAt = useCallback((index: number) => layoutWeek(index, occurrences, { range, today, look, slotTimes }), [occurrences, range, today, look, slotTimes]);
  // Opens with the month's first week at the top, and today on screen when it's this month.
  const [initialIndex] = useState(() => firstWeekOfMonth(range, month));
  const keepVisibleIndex = month === `${today.slice(0, 8)}01` ? weekIndexOf(range, today) : undefined;
  // FR-008/FR-009: a tap on a day opens its sheet; the sheet closes before an event or Add opens.
  const now = useNow(timeZone);
  const [sheetDate, setSheetDate] = useState<string | null>(null);
  const sheet = useMemo(
    () => (sheetDate ? layoutDaySheet(sheetDate, occurrences, { today, now, look, slotTimes, members }) : null),
    [sheetDate, occurrences, today, now, look, slotTimes, members],
  );
  const openDay = useCallback(
    (date: string) => {
      setSheetDate(date);
      onDaySheetOpened(layoutDaySheet(date, occurrences, { today, now, look, slotTimes, members }).rows.length);
    },
    [occurrences, today, now, look, slotTimes, members, onDaySheetOpened],
  );
  const openEvent = (key: string) => {
    const { id, date } = parseOccurrenceKey(key);
    setSheetDate(null);
    onOpenEvent(id, date);
  };
  const gridJump = useMemo(() => (jump ? { index: firstWeekOfMonth(range, jump.month), nonce: jump.nonce } : undefined), [jump, range]);

  return (
    <View className="flex-1">
      <MonthGrid
        weekdays={weekdayLetters(weekStartsOn)}
        weekCount={range.weekCount}
        weekAt={weekAt}
        initialIndex={initialIndex}
        keepVisibleIndex={keepVisibleIndex}
        jump={gridJump}
        onTopRowChange={(top) => onMonthShown(monthShownAt(range, top))}
        onDayPress={openDay}
        onDayLongPress={onAddEvent}
        addLabel={m.addEvent}
      />
      <FloatingAdd label={m.addEvent} onPress={() => onAddEvent(today)} hint={showHint ? { text: m.hint, actionLabel: m.gotIt, onAction: onDismissHint } : null} />
      {sheet && sheetDate ? (
        <DaySheet
          sheet={sheet}
          onClose={() => setSheetDate(null)}
          onOpenEvent={openEvent}
          onAdd={() => {
            setSheetDate(null);
            onAddEvent(sheetDate);
          }}
        />
      ) : null}
    </View>
  );
}
