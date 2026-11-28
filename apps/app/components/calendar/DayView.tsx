import { useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import type { SlotKey } from '@cocon/schemas/calendar';
import type { SlotTimes, WeekStartsOn } from '@cocon/calendar';
import type { StoredEvent } from '@cocon/data';
import { AllDayRow, ComingUpRow, DayReminderRow, FloatingAdd, MemberCount, MiniMonth, SlotBand, splitColumns, Swipeable, Text, tabBottomPad, theme, useLayoutTier, type DayBand } from '@cocon/ui';
import { comingUp, miniMonth } from '../../lib/calendar-aside';
import { layoutDayView } from '../../lib/calendar-day';
import { placeForScreen, pressReminderBox, type CalendarReminders } from '../../lib/calendar-reminders';
import { eventWindow, firstOfMonth, memberLook, monthOccurrences, monthRange, parseOccurrenceKey, weekdayLetters, type MonthOccurrence } from '../../lib/calendar-month';
import { useNow } from '../../lib/use-now';
import { useCalendarDisplay } from '../../lib/calendar-prefs';
import type { Member } from '../../lib/session';
import { strings } from '../../strings';

const d = strings.calendar.day;


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
  /** Spec 058: the day's reminders; none while the header's toggle hides them. */
  reminders?: CalendarReminders;
  /** Spec 070 FR-007: the mini month's weeks, from 960. */
  weekStartsOn?: WeekStartsOn;
  /** Spec 070 FR-007: a day picked in the mini month or "Coming up". */
  onPickDay?: (date: string, source: 'mini_month' | 'coming_up') => void;
}

/** Spec 070 FR-006: a band's share of its column, so the two columns end near each other. */
const bandWeight = (b: DayBand) => 1 + Math.max(1, b.events.length);

/**
 * Spec 039 (OC-CalDay): who's busy, All day, and the five bands of one day, swiped left and right;
 * 058 its reminders. From 600 (spec 070) the bands sit in two columns read by column and "+ Event"
 * is in the header; from 960 a mini month and "Coming up" are beside them.
 */
export function DayView({ members, myMemberId, events, slotTimes, hidden, date, today, timeZone, onSwipe, onAddEvent, onAddInSlot, onOpenEvent, reminders, weekStartsOn = 0, onPickDay = () => undefined }: DayViewProps) {
  const now = useNow(timeZone);
  const { tier } = useLayoutTier();
  // TabBar README: 180 under the content for the floating tab bar; 28 beside the rail (spec 064).
  const bottomPad = tabBottomPad(tier);
  const wide = tier !== 'compact';
  const { use24h } = useCalendarDisplay().prefs;
  const look = useMemo(() => memberLook(members), [members]);
  const { from, to } = eventWindow(firstOfMonth(date));
  const occurrences = useMemo(() => monthOccurrences(events ?? [], from, to, myMemberId, hidden), [events, from, to, myMemberId, hidden]);
  const placed = useMemo(() => placeForScreen(reminders, { from: date, to: date, today, tz: timeZone, members, use24h, hidden }), [reminders, date, today, timeZone, members, use24h, hidden]);
  const day = useMemo(
    () => layoutDayView(date, occurrences, { today, now, look, slotTimes, members, use24h }, [...placed.values()]),
    [date, occurrences, today, now, look, slotTimes, members, use24h, placed],
  );
  const toggleReminder = (key: string) => {
    const x = placed.get(key);
    if (x && reminders) pressReminderBox(x, reminders);
  };
  const openReminder = (key: string) => {
    const x = placed.get(key);
    if (x) reminders?.onOpen(x.row);
  };
  const openEvent = (key: string) => {
    const { id, date: series } = parseOccurrenceKey(key);
    onOpenEvent(id, series);
  };
  const band = (b: (typeof day.bands)[number]) => (
    <SlotBand
      key={b.key}
      band={b}
      onEventPress={openEvent}
      onAdd={() => onAddInSlot(date, b.slot)}
      onReminderToggle={toggleReminder}
      onReminderOpen={openReminder}
      readOnly={reminders?.readOnly}
    />
  );

  return (
    <View className={tier === 'expanded' ? 'flex-1 flex-row' : 'flex-1'}>
      <View className="min-w-0 flex-1">
      <Swipeable page={date} onSwipe={onSwipe}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName={wide ? 'gap-16 px-24 pt-4' : 'gap-16 px-20 pt-4'} contentContainerStyle={{ paddingBottom: bottomPad }}>
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
              {day.allDay.map((a) =>
                a.kind === 'reminder' ? (
                  <DayReminderRow key={a.key} item={a} onToggle={() => toggleReminder(a.key)} onOpen={() => openReminder(a.key)} disabled={reminders?.readOnly} />
                ) : (
                  <AllDayRow key={a.key} item={a} onPress={(key) => openEvent(key)} />
                ),
              )}
            </View>
          ) : null}
          {wide ? (
            <View className="flex-row gap-16">
              {splitColumns(day.bands, 2, bandWeight).map((bands, i) => (
                <View key={i} testID={`band-column-${i}`} className="min-w-0 flex-1 gap-16">
                  {bands.map(band)}
                </View>
              ))}
            </View>
          ) : (
            day.bands.map(band)
          )}
          {day.done.length ? (
            <View className="gap-8">
              <Text role="heading" size={18} weight="900">
                {strings.calendar.reminders.doneHeading}
              </Text>
              {day.done.map((x) => (
                <DayReminderRow key={x.key} item={x} onToggle={() => toggleReminder(x.key)} onOpen={() => undefined} disabled={reminders?.readOnly} />
              ))}
            </View>
          ) : null}
        </ScrollView>
      </Swipeable>
      </View>
      {tier === 'expanded' ? <DayAside date={date} today={today} occurrences={occurrences} slotTimes={slotTimes} weekStartsOn={weekStartsOn} onPickDay={onPickDay} bottomPad={bottomPad} /> : null}
      {wide ? null : <FloatingAdd label={strings.calendar.month.addEvent} onPress={() => onAddEvent(date)} hint={null} />}
    </View>
  );
}

/** Spec 070 FR-007 (OC-CalendarResponsive at 1180): a 300 px column with the mini month and the next three days. */
function DayAside({
  date,
  today,
  occurrences,
  slotTimes,
  weekStartsOn,
  onPickDay,
  bottomPad,
}: {
  date: string;
  today: string;
  occurrences: readonly MonthOccurrence[];
  slotTimes: SlotTimes;
  weekStartsOn: WeekStartsOn;
  onPickDay: (date: string, source: 'mini_month' | 'coming_up') => void;
  bottomPad: number;
}) {
  const range = useMemo(() => monthRange(today, weekStartsOn), [today, weekStartsOn]);
  const mini = useMemo(() => miniMonth(date, today, occurrences, range), [date, today, occurrences, range]);
  const next = useMemo(() => comingUp(date, occurrences, slotTimes), [date, occurrences, slotTimes]);
  return (
    <ScrollView style={{ width: theme.layout.dayAside, flexGrow: 0 }} contentContainerClassName="gap-14 pr-24 pt-4" contentContainerStyle={{ paddingBottom: bottomPad }} showsVerticalScrollIndicator={false}>
      <MiniMonth title={mini.title} weekdays={weekdayLetters(weekStartsOn)} days={mini.days} onPress={(d) => onPickDay(d, 'mini_month')} />
      <View className="gap-8">
        <Text role="heading" aria-level={2} size={13} weight="900" color="ink-muted" className="uppercase">
          {d.aside.comingUp}
        </Text>
        {next.map((x) => (
          <ComingUpRow key={x.date} weekday={x.weekday} num={x.num} text={x.text} label={x.label} onPress={() => onPickDay(x.date, 'coming_up')} />
        ))}
      </View>
    </ScrollView>
  );
}
