import { Linking, Platform, View } from 'react-native';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { loadEvent, setChecklistDone } from '@cocon/data';
import { CalendarDate } from '@cocon/schemas/calendar';
import { BackLink, PushedScreen, Text } from '@cocon/ui';
import { EventDetail } from '../../../components/calendar/EventDetail';
import { deleteOccurrences, duplicateEvent, duplicateInput } from '../../../lib/event-delete';
import { eventOccurrence, seesInFull } from '../../../lib/event-detail';
import { useOnline } from '../../../lib/online';
import { useEventSheet } from '../../../lib/use-event-sheet';
import { strings } from '../../../strings/en';

const e = strings.calendar.event;
const a = strings.calendar.add;

/**
 * /calendar/[id]?date= (spec 042, OC-CalEvent): one date of an event, from any calendar view. The
 * same query as the edit route, so ticks and edits from others show live (lib/sync.tsx). Only an
 * event this member sees in full opens here; a date that isn't one of the event's says it couldn't
 * open (the Busy and surprise pages are spec 043).
 */
export default function EventRoute() {
  const params = useLocalSearchParams<{ id: string; date?: string }>();
  const id = z.uuid().safeParse(params.id).success ? params.id : null;
  const page = useEventSheet();
  const { state, client, tracker, familyId, myMemberId } = page;
  const online = useOnline();
  const event = useQuery({ queryKey: ['events', familyId ?? '', 'one', id ?? ''], queryFn: () => (id ? loadEvent(client, id) : null), enabled: familyId !== null && id !== null });
  if (state.status !== 'ready' || !familyId || !myMemberId) return null;
  if (id && event.isPending) return null;

  const ev = event.data;
  const date = CalendarDate.safeParse(params.date).success ? (params.date as string) : ev?.starts_on;
  const occurrence = ev && date && seesInFull(ev, myMemberId) ? eventOccurrence(ev, date) : null;
  if (!ev || !date || !occurrence) {
    return (
      <PushedScreen className="gap-16">
        <BackLink label={e.back} onPress={page.close} />
        <View className="gap-6">
          <Text size={22} weight="900" role="heading" aria-level={1}>
            {a.loadFailedTitle}
          </Text>
          <Text color="ink-muted">{a.loadFailedBody}</Text>
        </View>
      </PushedScreen>
    );
  }

  return (
    <EventDetail
      event={ev}
      occurrence={occurrence}
      date={date}
      members={state.members}
      myMemberId={myMemberId}
      slotTimes={page.slotTimes}
      today={page.today}
      weekStartsOn={page.weekStartsOn}
      tracker={tracker}
      os={Platform.OS}
      readOnly={!online}
      onBack={page.close}
      onEdit={() => router.push(`/calendar/${ev.id}/edit?date=${date}` as Href)}
      onShare={() => router.push(`/calendar/${ev.id}/share?date=${date}` as Href)}
      onOpenUrl={(url) => void Linking.openURL(url)}
      onTick={async (itemId, done) => {
        await setChecklistDone(client, itemId, done);
        page.refreshEvents();
      }}
      onDelete={async (scope) => {
        const undo = await deleteOccurrences(client, { event: ev, date, scope, familyId, members: state.members });
        page.refreshEvents();
        page.close();
        return undo;
      }}
      onDuplicate={async (day) => {
        const copy = await duplicateEvent(client, duplicateInput(occurrence, day, state.members));
        page.refreshEvents();
        return copy.undo;
      }}
      onChanged={page.refreshEvents}
    />
  );
}
