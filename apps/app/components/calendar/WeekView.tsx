import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import { addDays, weekRange, type SlotTimes, type WeekStartsOn } from '@cocon/calendar';
import type { StoredEvent } from '@cocon/data';
import { FloatingAdd, HourGrid, Swipeable } from '@cocon/ui';
import { eventWindow, firstOfMonth, memberLook, monthOccurrences, parseOccurrenceKey } from '../../lib/calendar-month';
import { layoutWeekGrid } from '../../lib/calendar-week';
import { isDayEvent, layoutDaySheet } from '../../lib/calendar-day';
import { placeForScreen, reminderCounts, type CalendarReminders } from '../../lib/calendar-reminders';
import { DaySheet } from './DaySheet';
import { useNow } from '../../lib/use-now';
import { useCalendarDisplay } from '../../lib/calendar-prefs';
import type { Member } from '../../lib/session';
import type { AddPrefill } from './CalendarScreen';
import { strings } from '../../strings/en';

const w = strings.calendar.week;

/** TabBar README: screens pad 180 under their content for the floating tab bar. */
const BOTTOM_PAD = 180;

export interface WeekViewProps {
  members: Member[];
  myMemberId: string;
  /** Loaded for `eventWindow` of the anchor's month; undefined while loading (the grid is empty). */
  events: StoredEvent[] | undefined;
  slotTimes: SlotTimes;
  hidden: ReadonlySet<string>;
  /** A day in the week shown. */
  anchor: string;
  today: string;
  /** The family's home time zone, for the now line. */
  timeZone: string;
  weekStartsOn: WeekStartsOn;
  /** A swipe: 1 for next week, -1 for the previous. */
  onSwipe: (direction: 1 | -1) => void;
  /** A day's sheet opened (a tap on its head or an empty part of it, spec 058), with how many events it lists. */
  onDaySheetOpened: (events: number) => void;
  /** Add event on a day, at an hour ("15:00") when one was tapped. */
  onAddEvent: (date: string, prefill?: AddPrefill) => void;
  onOpenEvent: (id: string, date: string) => void;
  /** Spec 058: a mark on days with reminders, and the reminders in the day sheet with its toggle. */
  reminders?: CalendarReminders;
  showReminders?: boolean;
  onShowReminders?: (on: boolean) => void;
}

/** Spec 038 (OC-CalWeek): the week's hour grid, swiped left and right, and the add button; since 058 a tap on a day opens its sheet. */
export function WeekView({
  members,
  myMemberId,
  events,
  slotTimes,
  hidden,
  anchor,
  today,
  timeZone,
  weekStartsOn,
  onSwipe,
  onDaySheetOpened,
  onAddEvent,
  onOpenEvent,
  reminders,
  showReminders = true,
  onShowReminders = () => undefined,
}: WeekViewProps) {
  const now = useNow(timeZone);
  const { use24h } = useCalendarDisplay().prefs;
  const look = useMemo(() => memberLook(members), [members]);
  const { start } = weekRange(anchor, weekStartsOn);
  const { from, to } = eventWindow(firstOfMonth(anchor));
  const occurrences = useMemo(() => monthOccurrences(events ?? [], from, to, myMemberId, hidden), [events, from, to, myMemberId, hidden]);
  const counts = useMemo(
    () => reminderCounts(placeForScreen(showReminders ? reminders : undefined, { from: start, to: addDays(start, 6), today, tz: timeZone, members, use24h, hidden }).values()),
    [showReminders, reminders, start, today, timeZone, members, use24h, hidden],
  );
  const grid = useMemo(
    () => layoutWeekGrid(anchor, occurrences, { weekStartsOn, today, look, slotTimes, now, use24h, reminders: counts }),
    [anchor, occurrences, weekStartsOn, today, look, slotTimes, now, use24h, counts],
  );
  const [sheetDate, setSheetDate] = useState<string | null>(null);
  const dayCtx = useMemo(() => ({ today, now, look, slotTimes, members, use24h }), [today, now, look, slotTimes, members, use24h]);
  const openDay = useCallback(
    (date: string) => {
      setSheetDate(date);
      onDaySheetOpened(layoutDaySheet(date, occurrences, dayCtx).rows.filter(isDayEvent).length);
    },
    [occurrences, dayCtx, onDaySheetOpened],
  );
  // The add button: today when it's in this week, else the week's first day.
  const addDay = today >= start && today <= addDays(start, 6) ? today : start;
  const openEvent = (key: string) => {
    const { id, date } = parseOccurrenceKey(key);
    setSheetDate(null);
    onOpenEvent(id, date);
  };

  return (
    <View className="flex-1">
      {/* The day and All day rows stay put; the hours scroll inside the card. */}
      <View className="flex-1 px-8 pt-4">
        <Swipeable page={start} onSwipe={onSwipe}>
          <HourGrid
            {...grid}
            allDayLabel={w.allDay}
            onDayPress={openDay}
            onBlockPress={openEvent}
            onEmptyLongPress={(date, hour) => onAddEvent(date, hour === null ? undefined : { time: `${String(hour).padStart(2, '0')}:00` })}
            bottomInset={BOTTOM_PAD}
          />
        </Swipeable>
      </View>
      <FloatingAdd label={strings.calendar.month.addEvent} onPress={() => onAddEvent(addDay)} hint={null} />
      {sheetDate ? (
        <DaySheet
          date={sheetDate}
          occurrences={occurrences}
          ctx={dayCtx}
          timeZone={timeZone}
          hidden={hidden}
          reminders={reminders}
          showReminders={showReminders}
          onShowReminders={onShowReminders}
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
