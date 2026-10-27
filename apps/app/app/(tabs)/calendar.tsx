import { useCallback, useEffect, useRef } from 'react';
import { useWindowDimensions } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { loadCalendarSettings } from '@cocon/data';
import { todayIn, weekStartFor } from '@cocon/calendar';
import { CalendarScreen } from '../../components/calendar/CalendarScreen';
import { anchorFrom, calendarSettingsKey, deviceRegion, entryFrom, viewFrom } from '../../lib/calendar-header';
import { useSession } from '../../lib/session';

/**
 * /calendar (spec 036; design/flows.md): `?view=month|week|day|agenda&date=YYYY-MM-DD`, and
 * `from=home` when Home's card opened it (spec 028).
 */
export default function CalendarTab() {
  const { state, client, tracker } = useSession();
  const params = useLocalSearchParams<{ view?: string; date?: string; from?: string }>();
  const { width } = useWindowDimensions();
  const familyId = state.status === 'ready' ? state.family.id : null;
  const settings = useQuery({ queryKey: calendarSettingsKey(familyId ?? ''), queryFn: () => loadCalendarSettings(client), enabled: familyId !== null });
  const timeZone = settings.data?.homeTimeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const today = todayIn(timeZone);
  const view = viewFrom(params.view);
  const entry = entryFrom(params.from);

  // Once each time the tab opens, with the view it opens on; switching views sends calendar_view_changed.
  const opened = useRef({ view, entry });
  useEffect(() => {
    opened.current = { view, entry };
  });
  useFocusEffect(useCallback(() => tracker.track('calendar_viewed', opened.current), [tracker]));

  if (state.status !== 'ready') return null;
  return (
    <CalendarScreen
      userId={state.userId}
      members={state.members}
      view={view}
      anchor={anchorFrom(params.date, today)}
      today={today}
      width={width}
      // "Automatic" until spec 029 adds the member's own setting.
      weekStartsOn={weekStartFor('automatic', deviceRegion())}
      onNavigate={(p) => router.setParams(p)}
      tracker={tracker}
    />
  );
}
