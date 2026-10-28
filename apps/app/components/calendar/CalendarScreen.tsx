import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { memberInitials, type Tracker } from '@cocon/schemas';
import type { CalendarView, SlotKey } from '@cocon/schemas/calendar';
import { DEFAULT_SLOT_TIMES, shiftAnchor, type SlotTimes, type WeekStartsOn } from '@cocon/calendar';
import type { StoredEvent } from '@cocon/data';
import { CalendarHeader, type CalendarHeaderChip } from '@cocon/ui';
import { arrowLabels, headerTitle, viewSegments } from '../../lib/calendar-header';
import { useCalendarFilter } from '../../lib/calendar-filter';
import { useMonthHint } from '../../lib/calendar-hint';
import { eventWindow, firstOfMonth } from '../../lib/calendar-month';
import type { ChoiceStorage } from '../../lib/recipe-choices';
import type { Member } from '../../lib/session';
import { strings } from '../../strings/en';
import { OfflineBanner } from '../sync/OfflineBanner';
import { DayView } from './DayView';
import { MonthView } from './MonthView';
import { WeekView } from './WeekView';

const h = strings.calendar.header;

/** What Add event opens with besides the day: Week's tapped hour ("15:00") or Day's empty slot. */
export type AddPrefill = { time: string } | { slot: SlotKey };

export interface CalendarScreenProps {
  userId: string;
  /** In member order (join order, as the session sorts them). */
  members: Member[];
  view: CalendarView;
  /** The day the view shows. */
  anchor: string;
  /** Today in the family's home time zone. */
  today: string;
  /** The family's home time zone (the week's now line). */
  timeZone?: string;
  /** Screen width, for the title's short or long month names. */
  width: number;
  weekStartsOn: WeekStartsOn;
  /** Changes the URL: another view (same day), another day, or both (a day opened from Month). */
  onNavigate: (params: { view: CalendarView } | { date: string } | { view: CalendarView; date: string }) => void;
  tracker: Tracker;
  storage?: ChoiceStorage;
  /** The events for `eventWindow` of the month in view (spec 037); undefined while loading. */
  events?: StoredEvent[];
  /** The days whose events the screen needs; the route loads them into `events`. */
  onEventWindow?: (window: { from: string; to: string }) => void;
  slotTimes?: SlotTimes;
  /** Add event for a day (spec 041), at an hour when Week's grid was tapped there, in a slot from Day's bands. */
  onAddEvent?: (date: string, prefill?: AddPrefill) => void;
  /** An event, on one of its days (spec 042). */
  onOpenEvent?: (id: string, date: string) => void;
}

const noop = () => undefined;

/** Spec 036: the Calendar tab's header; spec 037 the Month view under it, 038 the Week view, 039 the Day view. Agenda comes with 040. */
export function CalendarScreen({
  userId,
  members,
  view,
  anchor,
  today,
  timeZone = 'UTC',
  width,
  weekStartsOn,
  onNavigate,
  tracker,
  storage,
  events,
  onEventWindow = noop,
  slotTimes = DEFAULT_SLOT_TIMES,
  onAddEvent = noop,
  onOpenEvent = noop,
}: CalendarScreenProps) {
  const { hidden, toggle } = useCalendarFilter(userId, storage);
  const hint = useMonthHint(userId, storage);
  const myMemberId = members.find((m) => m.user_id === userId)?.id ?? '';
  // Month view: the month that fills the grid (FR-005), and ‹ › / Today's scroll requests.
  const [shown, setShown] = useState(() => firstOfMonth(anchor));
  const [jump, setJump] = useState<{ month: string; nonce: number }>();
  // Back on Month from another view: open on the day that view showed.
  const [lastView, setLastView] = useState(view);
  if (view !== lastView) {
    setLastView(view);
    if (view === 'month') setShown(firstOfMonth(anchor));
  }
  // Week and the other views load around the month of the day they show.
  const { from, to } = eventWindow(view === 'month' ? shown : firstOfMonth(anchor));
  useEffect(() => onEventWindow({ from, to }), [from, to, onEventWindow]);
  const initials = memberInitials(members);
  const chips: CalendarHeaderChip[] = [
    ...members.map((m) => ({
      key: m.id,
      name: m.display_name,
      initial: initials.get(m.id) ?? '?',
      color: m.color,
      pressed: !hidden.has(m.id),
    })),
    { key: 'everyone', name: h.everyone, initial: h.everyoneInitial, color: 'everyone', pressed: !hidden.has('everyone') },
    { key: 'others', name: h.others, initial: '', color: 'others', pressed: !hidden.has('others') },
  ];
  const arrows = arrowLabels(view);

  const onToggle = (key: string) => {
    const next = toggle(key);
    tracker.track('calendar_member_filter_changed', { members_visible: chips.filter((c) => !next.has(c.key)).length });
  };
  const onView = (next: CalendarView) => {
    if (next === view) return;
    if (view === 'month') onNavigate({ view: next, date: dayInMonth(shown) });
    else onNavigate({ view: next });
    tracker.track('calendar_view_changed', { from: view, to: next });
  };
  // The day other views open on from Month: today in this month, else the 1st.
  const dayInMonth = (month: string) => (firstOfMonth(today) === month ? today : month);
  const goToMonth = (month: string) => {
    setShown(month);
    setJump((j) => ({ month, nonce: (j?.nonce ?? 0) + 1 }));
  };
  const paging =
    view === 'month'
      ? {
          title: headerTitle('month', shown, today, width, weekStartsOn),
          onPrev: () => goToMonth(shiftAnchor('month', shown, -1)),
          onNext: () => goToMonth(shiftAnchor('month', shown, 1)),
          onToday: () => goToMonth(firstOfMonth(today)),
        }
      : {
          title: headerTitle(view, anchor, today, width, weekStartsOn),
          onPrev: () => onNavigate({ date: shiftAnchor(view, anchor, -1) }),
          onNext: () => onNavigate({ date: shiftAnchor(view, anchor, 1) }),
          onToday: () => onNavigate({ date: today }),
        };

  return (
    <View className="flex-1 bg-surface-page">
      <CalendarHeader
        title={paging.title}
        prevLabel={arrows.prev}
        nextLabel={arrows.next}
        onPrev={paging.onPrev}
        onNext={paging.onNext}
        todayLabel={h.today}
        onToday={paging.onToday}
        views={viewSegments}
        view={view}
        onView={onView}
        viewsLabel={h.viewsLabel}
        chips={chips}
        onToggle={onToggle}
        chipsLabel={h.filterLabel}
      />
      <View className="px-20">
        <OfflineBanner screen="calendar" tracker={tracker} />
      </View>
      {view === 'month' ? (
        <MonthView
          members={members}
          myMemberId={myMemberId}
          events={events}
          slotTimes={slotTimes}
          hidden={hidden}
          month={shown}
          today={today}
          weekStartsOn={weekStartsOn}
          jump={jump}
          onMonthShown={setShown}
          onOpenDay={(date) => {
            onNavigate({ view: 'day', date });
            tracker.track('calendar_day_opened', { from_view: 'month' });
          }}
          onAddEvent={onAddEvent}
          onOpenEvent={onOpenEvent}
          showHint={hint.show}
          onDismissHint={() => {
            hint.dismiss();
            tracker.track('calendar_first_hint_dismissed', {});
          }}
        />
      ) : null}
      {view === 'week' ? (
        <WeekView
          members={members}
          myMemberId={myMemberId}
          events={events}
          slotTimes={slotTimes}
          hidden={hidden}
          anchor={anchor}
          today={today}
          timeZone={timeZone}
          weekStartsOn={weekStartsOn}
          onSwipe={(direction) => {
            onNavigate({ date: shiftAnchor('week', anchor, direction) });
            tracker.track('calendar_week_swiped', { direction: direction === 1 ? 'next' : 'previous' });
          }}
          onOpenDay={(date) => {
            onNavigate({ view: 'day', date });
            tracker.track('calendar_day_opened', { from_view: 'week' });
          }}
          onAddEvent={onAddEvent}
          onOpenEvent={onOpenEvent}
        />
      ) : null}
      {view === 'day' ? (
        <DayView
          members={members}
          myMemberId={myMemberId}
          events={events}
          slotTimes={slotTimes}
          hidden={hidden}
          date={anchor}
          today={today}
          timeZone={timeZone}
          onSwipe={(direction) => {
            onNavigate({ date: shiftAnchor('day', anchor, direction) });
            tracker.track('calendar_day_swiped', { direction: direction === 1 ? 'next' : 'previous' });
          }}
          onAddEvent={(date) => onAddEvent(date)}
          onAddInSlot={(date, slot) => {
            onAddEvent(date, { slot });
            tracker.track('calendar_slot_add_tapped', { slot });
          }}
          onOpenEvent={onOpenEvent}
        />
      ) : null}
    </View>
  );
}
