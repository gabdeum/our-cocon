import { useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import type { SlotKey } from '@cocon/schemas/calendar';
import type { SlotTimes } from '@cocon/calendar';
import type { StoredEvent } from '@cocon/data';
import { AllDayRow, FloatingAdd, MemberCount, SlotBand, Swipeable, Text } from '@cocon/ui';
import { layoutDayView } from '../../lib/calendar-day';
import { eventWindow, firstOfMonth, memberLook, monthOccurrences, parseOccurrenceKey } from '../../lib/calendar-month';
import { useNow } from '../../lib/use-now';
import type { Member } from '../../lib/session';
import { useToast } from '../../lib/toast';
import { strings } from '../../strings/en';

const d = strings.calendar.day;

/** TabBar README: screens pad 180 under their content for the floating tab bar. */
const BOTTOM_PAD = 180;

export interface DayViewProps {
  members: Member[];
  myMemberId: string;
  /** Loaded for `eventWindow` of the day's month; undefined while loading (every band is empty). */
  events: StoredEvent[] | undefined;
  slotTimes: SlotTimes;
  hidden: ReadonlySet<string>;
  /** The day shown. */
  date: string;
  today: string;
  /** The family's home time zone, for "Now". */
  timeZone: string;
  /** A swipe: 1 for the next day, -1 for the previous. */
  onSwipe: (direction: 1 | -1) => void;
  /** The add button. */
  onAddEvent: (date: string) => void;
  /** An empty band's "+ Add in the …". */
  onAddInSlot: (date: string, slot: SlotKey) => void;
  onOpenEvent: (id: string, date: string) => void;
}

/** Spec 039 (OC-CalDay): who's busy, All day, and the five bands of one day, swiped left and right. */
export function DayView({ members, myMemberId, events, slotTimes, hidden, date, today, timeZone, onSwipe, onAddEvent, onAddInSlot, onOpenEvent }: DayViewProps) {
  // Toast README: the add button hides while the save toast shows (032-later L96).
  const { visible: toastShown } = useToast();
  const now = useNow(timeZone);
  const look = useMemo(() => memberLook(members), [members]);
  const { from, to } = eventWindow(firstOfMonth(date));
  const occurrences = useMemo(() => monthOccurrences(events ?? [], from, to, myMemberId, hidden), [events, from, to, myMemberId, hidden]);
  const day = useMemo(() => layoutDayView(date, occurrences, { today, now, look, slotTimes, members }), [date, occurrences, today, now, look, slotTimes, members]);
  const openEvent = (key: string) => {
    const { id, date: series } = parseOccurrenceKey(key);
    onOpenEvent(id, series);
  };

  return (
    <View className="flex-1">
      <Swipeable page={date} onSwipe={onSwipe}>
        <ScrollView contentContainerClassName="gap-16 px-20 pt-4" contentContainerStyle={{ paddingBottom: BOTTOM_PAD }}>
          {day.busy.length ? (
            <View role="group" aria-label={d.busyLabel} className="flex-row flex-wrap gap-8">
              {day.busy.map((c) => (
                <MemberCount key={c.key} text={c.text} initial={c.initial} color={c.color} />
              ))}
            </View>
          ) : null}
          {day.allDay.length ? (
            <View className="gap-8">
              <Text role="heading" size={18} weight="900">
                {d.allDay}
              </Text>
              {day.allDay.map((a) => (
                <AllDayRow key={a.key} item={a} onPress={() => openEvent(a.key)} />
              ))}
            </View>
          ) : null}
          {day.bands.map((b) => (
            <SlotBand key={b.key} band={b} onEventPress={openEvent} onAdd={() => onAddInSlot(date, b.slot)} />
          ))}
        </ScrollView>
      </Swipeable>
      <FloatingAdd hidden={toastShown} label={strings.calendar.month.addEvent} onPress={() => onAddEvent(date)} hint={null} />
    </View>
  );
}
