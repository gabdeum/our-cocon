import { router, type Href } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DEFAULT_SLOT_TIMES, todayIn, weekStartFor } from '@cocon/calendar';
import { loadCalendarSettings } from '@cocon/data';
import { calendarSettingsKey, deviceRegion } from './calendar-header';
import { useSession } from './session';

/**
 * What the add and edit sheet routes share (spec 041): the family's slot times and "today" in the
 * home time zone (as the Calendar tab reads them), my member id, the week start, and closing.
 */
export function useEventSheet() {
  const session = useSession();
  const { state, client } = session;
  const queryClient = useQueryClient();
  const familyId = state.status === 'ready' ? state.family.id : null;
  const settings = useQuery({ queryKey: calendarSettingsKey(familyId ?? ''), queryFn: () => loadCalendarSettings(client), enabled: familyId !== null });
  const timeZone = settings.data?.homeTimeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const myMemberId = state.status === 'ready' ? (state.members.find((m) => m.user_id === state.userId)?.id ?? state.me.id) : null;
  return {
    ...session,
    familyId,
    myMemberId,
    today: todayIn(timeZone),
    slotTimes: settings.data?.slotTimes ?? DEFAULT_SLOT_TIMES,
    // "Automatic" until spec 029 adds the member's own setting (as the Calendar tab).
    weekStartsOn: weekStartFor('automatic', deviceRegion()),
    /** The calendar's queries start with `events` (lib/sync.tsx refetches them live too). */
    refreshEvents: () => void queryClient.invalidateQueries({ queryKey: ['events'] }),
    // Opened straight from a link there's nothing to go back to: the calendar.
    close: () => (router.canGoBack() ? router.back() : router.replace('/calendar' as Href)),
  };
}
