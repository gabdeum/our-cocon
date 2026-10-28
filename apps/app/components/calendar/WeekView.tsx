import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { addDays, timeIn, weekRange, type SlotTimes, type WeekStartsOn } from '@cocon/calendar';
import type { StoredEvent } from '@cocon/data';
import { FloatingAdd, HourGrid, Swipeable } from '@cocon/ui';
import { eventWindow, firstOfMonth, memberLook, monthOccurrences, parseOccurrenceKey } from '../../lib/calendar-month';
import { layoutWeekGrid } from '../../lib/calendar-week';
import type { Member } from '../../lib/session';
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
  onOpenDay: (date: string) => void;
  /** Add event on a day, at an hour ("15:00") when one was tapped. */
  onAddEvent: (date: string, time?: string) => void;
  onOpenEvent: (id: string, date: string) => void;
}

/** The time now in the home time zone, moving each minute (FR-003's now line). */
function useNow(timeZone: string): string {
  const [clock, setClock] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  return timeIn(timeZone, clock);
}

/** Spec 038 (OC-CalWeek): the week's hour grid, swiped left and right, and the add button. */
export function WeekView({ members, myMemberId, events, slotTimes, hidden, anchor, today, timeZone, weekStartsOn, onSwipe, onOpenDay, onAddEvent, onOpenEvent }: WeekViewProps) {
  const now = useNow(timeZone);
  const look = useMemo(() => memberLook(members), [members]);
  const { start } = weekRange(anchor, weekStartsOn);
  const { from, to } = eventWindow(firstOfMonth(anchor));
  const occurrences = useMemo(() => monthOccurrences(events ?? [], from, to, myMemberId, hidden), [events, from, to, myMemberId, hidden]);
  const grid = useMemo(() => layoutWeekGrid(anchor, occurrences, { weekStartsOn, today, look, slotTimes, now }), [anchor, occurrences, weekStartsOn, today, look, slotTimes, now]);
  // The add button: today when it's in this week, else the week's first day.
  const addDay = today >= start && today <= addDays(start, 6) ? today : start;
  const openEvent = (key: string) => {
    const { id, date } = parseOccurrenceKey(key);
    onOpenEvent(id, date);
  };

  return (
    <View className="flex-1">
      <ScrollView contentContainerClassName="px-8 pt-4" contentContainerStyle={{ paddingBottom: BOTTOM_PAD }} showsVerticalScrollIndicator={false}>
        <Swipeable page={start} onSwipe={onSwipe}>
          <HourGrid
            {...grid}
            allDayLabel={w.allDay}
            onDayPress={onOpenDay}
            onBlockPress={openEvent}
            onEmptyPress={(date, hour) => onAddEvent(date, hour === null ? undefined : `${String(hour).padStart(2, '0')}:00`)}
          />
        </Swipeable>
      </ScrollView>
      <FloatingAdd label={strings.calendar.month.addEvent} onPress={() => onAddEvent(addDay)} hint={null} />
    </View>
  );
}
