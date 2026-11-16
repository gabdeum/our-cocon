import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams, type Href } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { loadCalendarSettings, loadEvents, loadRemindersInRange, type PlacedReminder } from '@cocon/data';
import { addDays, dateLabel, todayIn } from '@cocon/calendar';
import { CalendarScreen } from '../../components/calendar/CalendarScreen';
import { ReminderDrawerHost, type OpenDrawer } from '../../components/reminders/ReminderDrawerHost';
import { calendarRemindersKey, type CalendarReminders } from '../../lib/calendar-reminders';
import { useOnline } from '../../lib/online';
import { useReminderActions, useReminderContext } from '../../lib/reminder-actions';
import { useToast } from '../../lib/toast';
import { strings } from '../../strings/en';
import { anchorFrom, calendarSettingsKey, entryFrom, eventsKey, viewFrom } from '../../lib/calendar-header';
import { useCalendarPrefs } from '../../lib/calendar-prefs';
import { useSession } from '../../lib/session';
import type { AddPrefill } from '../../components/calendar/CalendarScreen';

/** `reminders_in_range` takes at most 366 days: Agenda's later pages past a year show events only. */
const REMINDER_DAYS = 366;
/** Before today only "Leave it" reminders show, on their day: half a year back is plenty. */
const REMINDER_PAST_DAYS = 183;

/** Add event's extra query (design/flows.md): `&slot=` from Day's bands, `&time=` from Week's grid. */
const addParams = (prefill?: AddPrefill) => (!prefill ? '' : 'slot' in prefill ? `&slot=${prefill.slot}` : `&time=${prefill.time}`);

/**
 * /calendar (spec 036; design/flows.md): `?view=month|week|day|agenda&date=YYYY-MM-DD`, and
 * `from=home` when Home's card opened it (spec 028). Without `view`, the member's "Opens on"
 * (spec 029, L88); tapping the tab again keeps the view and day it was on.
 */
export default function CalendarTab() {
  const { state, client, tracker } = useSession();
  const params = useLocalSearchParams<{ view?: string; date?: string; from?: string }>();
  const { width } = useWindowDimensions();
  const familyId = state.status === 'ready' ? state.family.id : null;
  const settings = useQuery({ queryKey: calendarSettingsKey(familyId ?? ''), queryFn: () => loadCalendarSettings(client), enabled: familyId !== null });
  const timeZone = settings.data?.homeTimeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const today = todayIn(timeZone);
  const { prefs, loaded, change } = useCalendarPrefs();
  const view = viewFrom(params.view ?? prefs.opens_on);
  const entry = entryFrom(params.from);
  // The days the view needs (spec 037: the month in view ±6 months); live through spec 035's sync.
  const [eventDays, setEventDays] = useState<{ from: string; to: string } | null>(null);
  const events = useQuery({
    queryKey: eventsKey(familyId ?? '', eventDays?.from ?? '', eventDays?.to ?? ''),
    queryFn: () => loadEvents(client, eventDays?.from ?? '', eventDays?.to ?? ''),
    enabled: familyId !== null && eventDays !== null,
    placeholderData: (previous) => previous,
  });
  const onEventWindow = useCallback((w: { from: string; to: string }) => setEventDays((prev) => (prev?.from === w.from && prev.to === w.to ? prev : w)), []);

  // Spec 058: reminders in every view, over the same days (live: 057's ticks and spec 056's sync refetch them).
  const ctx = useReminderContext();
  const actions = useReminderActions(ctx);
  const online = useOnline();
  const toast = useToast();
  const [drawer, setDrawer] = useState<OpenDrawer | null>(null);
  const earliest = addDays(today, -REMINDER_PAST_DAYS);
  const remindersFrom = eventDays ? (eventDays.from > earliest ? eventDays.from : earliest) : '';
  const remindersTo = eventDays ? (eventDays.to < addDays(remindersFrom, REMINDER_DAYS) ? eventDays.to : addDays(remindersFrom, REMINDER_DAYS)) : '';
  const reminderRows = useQuery({
    queryKey: calendarRemindersKey(familyId ?? '', remindersFrom, remindersTo, timeZone),
    queryFn: () => loadRemindersInRange(client, remindersFrom, remindersTo, timeZone),
    enabled: familyId !== null && eventDays !== null && remindersFrom <= remindersTo,
    placeholderData: (previous) => previous,
  });
  // The actions change every render; the views only need to redraw when the reminders do.
  const latest = useRef(actions);
  useEffect(() => {
    latest.current = actions;
  });
  const { ticked, hidden: gone } = actions;
  const reminders = useMemo<CalendarReminders>(
    () => ({
      rows: reminderRows.data,
      ticked,
      gone,
      readOnly: !online,
      onTick: (row: PlacedReminder) => void latest.current.tick(row, 'calendar'),
      onUntick: (id) => void latest.current.untick(id),
      onNotYet: (date) => toast.show({ text: strings.calendar.reminders.notYet(dateLabel(date)) }),
      onOpen: (row) => setDrawer({ row, source: 'calendar' }),
    }),
    [reminderRows.data, ticked, gone, online, toast, setDrawer],
  );

  // Once each time the tab opens, with the view it opens on; switching views sends calendar_view_changed.
  const opened = useRef({ view, entry });
  useEffect(() => {
    opened.current = { view, entry };
  });
  useFocusEffect(useCallback(() => tracker.track('calendar_viewed', opened.current), [tracker]));

  if (state.status !== 'ready') return null;
  return (
    <>
    <CalendarScreen
      userId={state.userId}
      members={state.members}
      view={view}
      anchor={anchorFrom(params.date, today)}
      today={today}
      timeZone={timeZone}
      width={width}
      weekStartsOn={prefs.weekStartsOn}
      onNavigate={(p) => router.setParams(p)}
      tracker={tracker}
      events={events.data}
      onEventWindow={onEventWindow}
      slotTimes={settings.data?.slotTimes}
      // Casts: the typed routes file (.expo/types) is generated by `expo start`; 041 and 042 add these screens.
      onAddEvent={(date, prefill) => router.push(`/calendar/new?date=${date}${addParams(prefill)}` as Href)}
      onOpenEvent={(id, date) => router.push(`/calendar/${id}?date=${date}` as Href)}
      monthHint={{ show: loaded && !prefs.month_hint_seen, onDismiss: () => void change({ month_hint_seen: true }) }}
      reminders={reminders}
    />
    {drawer ? <ReminderDrawerHost open={drawer} ctx={ctx} actions={actions} onClose={() => setDrawer(null)} /> : null}
    </>
  );
}
