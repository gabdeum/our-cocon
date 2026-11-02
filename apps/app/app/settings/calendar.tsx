import { router, type Href } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DEFAULT_SLOT_TIMES } from '@cocon/calendar';
import { loadCalendarSettings, setHomeTimeZone, setSlotTimes } from '@cocon/data';
import { CalendarSettings } from '../../components/settings/CalendarSettings';
import { calendarSettingsKey } from '../../lib/calendar-header';
import { useCalendarPrefs } from '../../lib/calendar-prefs';
import { deviceTimeZone } from '../../lib/clock';
import { useOnline } from '../../lib/online';
import { useSession } from '../../lib/session';

/** /settings/calendar (spec 029, OC-CalSettings): the member's calendar, and the family's times of day. */
export default function CalendarSettingsRoute() {
  const { state, client, tracker } = useSession();
  const online = useOnline();
  const queryClient = useQueryClient();
  const { prefs, change } = useCalendarPrefs();
  const familyId = state.status === 'ready' ? state.family.id : null;
  const settings = useQuery({ queryKey: calendarSettingsKey(familyId ?? ''), queryFn: () => loadCalendarSettings(client), enabled: familyId !== null });
  if (state.status !== 'ready') return null;
  // Slot changes can pin events to custom times, so the calendar refetches too.
  const refresh = () => Promise.all([queryClient.invalidateQueries({ queryKey: calendarSettingsKey(state.family.id) }), queryClient.invalidateQueries({ queryKey: ['events'] })]);
  const owner = state.members.find((m) => m.user_id === state.family.owner_id);
  return (
    <CalendarSettings
      prefs={prefs}
      onChange={change}
      slotTimes={settings.data?.slotTimes ?? DEFAULT_SLOT_TIMES}
      homeTimeZone={settings.data?.homeTimeZone ?? null}
      isOwner={state.me.role === 'owner'}
      ownerName={owner?.display_name ?? ''}
      onSaveSlots={async (slotTimes) => {
        await setSlotTimes(client, slotTimes);
        await refresh();
      }}
      onSetTimeZone={async (timeZone) => {
        await setHomeTimeZone(client, timeZone);
        await refresh();
      }}
      phoneTimeZone={deviceTimeZone()}
      onOpenAi={() => router.push('/settings/ai' as Href)}
      tracker={tracker}
      readOnly={!online}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/menu' as Href))}
    />
  );
}
