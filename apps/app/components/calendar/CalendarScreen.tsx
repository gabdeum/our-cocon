import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { memberInitials, type Tracker } from '@cocon/schemas';
import type { CalendarView, SlotKey } from '@cocon/schemas/calendar';
import { DEFAULT_SLOT_TIMES, addDays, shiftAnchor, viewFor, weekRange, type SlotTimes, type WeekStartsOn } from '@cocon/calendar';
import type { StoredEvent } from '@cocon/data';
import { CalendarHeader, useLayoutTier, useSheetPresentation, type CalendarHeaderChip } from '@cocon/ui';
import { arrowLabels, headerTitle, viewSegments } from '../../lib/calendar-header';
import { useCalendarFilter } from '../../lib/calendar-filter';
import { useCalendarDisplay } from '../../lib/calendar-prefs';
import { eventWindow, firstOfMonth } from '../../lib/calendar-month';
import { eventOccurrence } from '../../lib/event-detail';
import { useAgendaReminders, type CalendarReminders } from '../../lib/calendar-reminders';
import type { ChoiceStorage } from '../../lib/recipe-choices';
import type { Member } from '../../lib/session';
import { strings } from '../../strings';
import { OfflineBanner } from '../sync/OfflineBanner';
import { AgendaView } from './AgendaView';
import { BusySheet } from './BusySheet';
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
  /** Screen width, for the title's short or long month names and the month chips' initials. */
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
  /** OC-CalMonth's first-visit hint (spec 037), kept in the member's settings (spec 029, L94). */
  monthHint?: { show: boolean; onDismiss: () => void };
  /** Spec 058: reminders in Agenda and Day (the route loads them for the days `onEventWindow` asks for). */
  reminders?: CalendarReminders;
}

const noop = () => undefined;

/** Spec 036: the Calendar tab's header; spec 037 the Month view under it, 038 the Week view, 039 the Day view, 040 the Agenda. */
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
  onEventWindow = noop,
  slotTimes = DEFAULT_SLOT_TIMES,
  onAddEvent = noop,
  onOpenEvent: openEventPage = noop,
  monthHint = { show: false, onDismiss: noop },
  events: allEvents,
  reminders,
}: CalendarScreenProps) {
  // Spec 058 FR-004: the "Reminders" toggle (Agenda's and Day's header, the day sheet), remembered per person on this device.
  const [showReminders, setShowReminders] = useAgendaReminders(userId, storage);
  const onShowReminders = (on: boolean) => {
    setShowReminders(on);
    tracker.track('calendar_reminders_toggled', { on });
  };
  const shownReminders = showReminders ? reminders : undefined;
  const listView = view === 'agenda' || view === 'day';
  // The day sheet is a flow: a centred card from 600 (spec 065).
  const daySheetAs = useSheetPresentation('flow');
  const { hidden, toggle, showAll, showOnly } = useCalendarFilter(userId, storage);
  // "Show birthdays" off (spec 029): birthdays leave every view.
  const showBirthdays = useCalendarDisplay().prefs.show_birthdays;
  const events = showBirthdays ? allEvents : allEvents?.filter((e) => e.category !== 'birthday');
  const myMemberId = members.find((m) => m.user_id === userId)?.id ?? '';
  // OC-CalBusy (spec 043): someone else's private event opens a sheet here, not the event page.
  const [busy, setBusy] = useState<StoredEvent | null>(null);
  const onOpenEvent = (id: string, date: string) => {
    const event = events?.find((e) => e.id === id);
    const occurrence = event ? eventOccurrence(event, date) : null;
    if (occurrence && viewFor(occurrence, myMemberId).view === 'busy') setBusy(occurrence);
    else openEventPage(id, date);
  };
  const { tier } = useLayoutTier();
  const wide = tier !== 'compact';
  // Month view: the month that fills the grid (FR-005), and ‹ › / Today's scroll requests.
  const [shown, setShown] = useState(() => firstOfMonth(anchor));
  const [jump, setJump] = useState<{ month: string; toToday?: boolean; nonce: number }>();
  // The day other views open on from Month: today in this month, else the 1st.
  const dayInMonth = (month: string) => (firstOfMonth(today) === month ? today : month);
  // Spec 070: from 600 Month shows a selected day's panel; it starts on the day the URL names.
  const [selected, setSelected] = useState(() => (firstOfMonth(anchor) === firstOfMonth(today) ? today : anchor));
  // Back on Month from another view: open on the day that view showed.
  const [lastView, setLastView] = useState(view);
  if (view !== lastView) {
    setLastView(view);
    if (view === 'month') {
      setShown(firstOfMonth(anchor));
      setSelected(anchor);
    }
  }
  // Week and Day load around the month of the day they show; Agenda asks for its own weeks.
  const { from, to } = eventWindow(view === 'month' ? shown : firstOfMonth(anchor));
  const agenda = view === 'agenda';
  useEffect(() => {
    if (!agenda) onEventWindow({ from, to });
  }, [agenda, from, to, onEventWindow]);
  // Agenda: "Today" on today's list goes back to the top.
  const [agendaTop, setAgendaTop] = useState(0);
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
    tracker.track('calendar_member_filter_changed', { members_visible: chips.filter((c) => !next.has(c.key)).length, source: 'menu' });
  };
  const shownChips = chips.filter((c) => c.pressed);
  const filtered = shownChips.length < chips.length;
  const keys = chips.map((c) => c.key);
  // The phone's menu: Show all once someone is hidden, Show none while everyone shows.
  const onShowAll = () => {
    if (filtered) showAll();
    else showOnly(keys);
    tracker.track('calendar_member_filter_changed', { members_visible: filtered ? chips.length : 0, source: 'menu' });
  };
  // From 600: with everyone shown, a chip shows only that person; hiding the last one shows everyone again.
  const onChip = (key: string) => {
    const last = shownChips.length === 1 && shownChips[0]?.key === key;
    const next = !filtered ? showOnly(keys, key) : last ? showOnly([]) : toggle(key);
    tracker.track('calendar_member_filter_changed', { members_visible: chips.filter((c) => !next.has(c.key)).length, source: 'chips' });
  };
  const onView = (next: CalendarView) => {
    if (next === view) return;
    // From 600 the selected day; on the phone today in the month shown, else its 1st.
    if (view === 'month') onNavigate({ view: next, date: wide ? selected : dayInMonth(shown) });
    else onNavigate({ view: next });
    tracker.track('calendar_view_changed', { from: view, to: next });
  };
  const goToMonth = (month: string, toToday = false) => {
    setShown(month);
    setSelected(dayInMonth(month));
    setJump((j) => ({ month, toToday, nonce: (j?.nonce ?? 0) + 1 }));
  };
  // Spec 070 FR-002: "+ Event" adds where the floating button did: the day shown in Day, today in
  // a week that holds it (else its first day), and today in Month and Agenda.
  const addDay = () => {
    if (view === 'day') return anchor;
    if (view !== 'week') return today;
    const { start } = weekRange(anchor, weekStartsOn);
    return today >= start && today <= addDays(start, 6) ? today : start;
  };
  const paging =
    view === 'month'
      ? {
          title: headerTitle('month', shown, today, width, weekStartsOn, tier),
          onPrev: () => goToMonth(shiftAnchor('month', shown, -1)),
          onNext: () => goToMonth(shiftAnchor('month', shown, 1)),
          onToday: () => goToMonth(firstOfMonth(today), true),
        }
      : {
          title: headerTitle(view, anchor, today, width, weekStartsOn, tier),
          onPrev: () => onNavigate({ date: shiftAnchor(view, anchor, -1) }),
          onNext: () => onNavigate({ date: shiftAnchor(view, anchor, 1) }),
          onToday: () => (agenda && anchor === today ? setAgendaTop((n) => n + 1) : onNavigate({ date: today })),
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
        viewButtonLabel={h.viewButton(h.views[view])}
        chips={chips}
        onToggle={onToggle}
        onToggleChip={onChip}
        onShowAll={onShowAll}
        peopleLabel={filtered ? h.peopleCount(shownChips.length, chips.length) : h.peopleAll}
        peopleButtonLabel={h.peopleButton(filtered ? shownChips.map((c) => c.name) : null)}
        filterLabel={h.filterLabel}
        showAllLabel={filtered ? h.showAll : h.showNone}
        closeLabel={h.close}
        toggle={reminders && listView ? { label: strings.calendar.reminders.toggle, icon: 'alarm', pressed: showReminders, onPress: () => onShowReminders(!showReminders) } : undefined}
        arrows={!(reminders && listView)}
        add={{ label: h.addEvent, a11yLabel: h.addEventLabel, onPress: () => onAddEvent(addDay()) }}
      />
      <View className="px-20">
        <OfflineBanner screen="calendar" tracker={tracker} />
      </View>
      {view === 'month' ? (
        <MonthView
          width={width}
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
          timeZone={timeZone}
          onDaySheetOpened={(count) => tracker.track('calendar_day_sheet_opened', { events: count, presentation: daySheetAs })}
          onAddEvent={onAddEvent}
          onOpenEvent={onOpenEvent}
          reminders={reminders}
          showReminders={showReminders}
          onShowReminders={onShowReminders}
          // The hint points at the floating add button, which isn't there from 600.
          showHint={monthHint.show && !wide}
          selected={selected}
          onSelect={(date) => {
            setSelected(date);
            tracker.track('calendar_day_selected', { view: 'month', source: 'grid' });
          }}
          onDismissHint={() => {
            monthHint.onDismiss();
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
          onDaySheetOpened={(count) => tracker.track('calendar_day_sheet_opened', { events: count, presentation: daySheetAs })}
          onAddEvent={onAddEvent}
          onOpenEvent={onOpenEvent}
          reminders={reminders}
          showReminders={showReminders}
          onShowReminders={onShowReminders}
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
          reminders={shownReminders}
          weekStartsOn={weekStartsOn}
          onPickDay={(date, source) => {
            onNavigate({ date });
            tracker.track('calendar_day_selected', { view: 'day', source });
          }}
        />
      ) : null}
      {agenda ? (
        <AgendaView
          key={anchor}
          userId={userId}
          members={members}
          myMemberId={myMemberId}
          events={events}
          slotTimes={slotTimes}
          hidden={hidden}
          anchor={anchor}
          today={today}
          timeZone={timeZone}
          top={agendaTop}
          onEventWindow={onEventWindow}
          onAddEvent={(date) => onAddEvent(date)}
          onOpenEvent={onOpenEvent}
          reminders={shownReminders}
        />
      ) : null}
      {busy ? <BusySheet occurrence={busy} members={members} slotTimes={slotTimes} onClose={() => setBusy(null)} /> : null}
    </View>
  );
}
