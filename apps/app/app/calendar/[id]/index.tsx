import { Linking, View } from 'react-native';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { loadEvent, setChecklistDone } from '@cocon/data';
import { CalendarDate } from '@cocon/schemas/calendar';
import { PushedScreen, Text } from '@cocon/ui';
import { cachedEvent } from '../../../lib/calendar-header';
import { EventDetail } from '../../../components/calendar/EventDetail';
import { SurpriseDetail } from '../../../components/calendar/SurpriseDetail';
import { deleteOccurrences, duplicateEvent, duplicateInput } from '../../../lib/event-delete';
import { eventOccurrence, isCover, seesInFull } from '../../../lib/event-detail';
import { useOnline } from '../../../lib/online';
import { systemShare } from '../../../lib/system-share';
import { useEventSheet } from '../../../lib/use-event-sheet';
import { strings } from '../../../strings/en';

const e = strings.calendar.event;
const a = strings.calendar.add;

/**
 * /calendar/[id]?date= (spec 042, OC-CalEvent): one date of an event, from any calendar view. The
 * same query as the edit route, so ticks and edits from others show live (lib/sync.tsx). An event
 * this member sees in full opens here; a surprise's cover opens OC-CalSurprise (spec 043); Busy, or
 * a date that isn't one of the event's, says it couldn't open (Busy opens as a sheet over the views).
 * Opened from a view, it shows the copy that view already loaded while the event refetches; from a
 * link with nothing cached, the header bar and skeleton blocks (OC-CalEvent, Loading).
 */
export default function EventRoute() {
  const params = useLocalSearchParams<{ id: string; date?: string }>();
  const id = z.uuid().safeParse(params.id).success ? params.id : null;
  const page = useEventSheet();
  const { state, client, tracker, familyId, myMemberId } = page;
  const online = useOnline();
  const queryClient = useQueryClient();
  const event = useQuery({
    queryKey: ['events', familyId ?? '', 'one', id ?? ''],
    queryFn: () => (id ? loadEvent(client, id) : null),
    enabled: familyId !== null && id !== null,
    placeholderData: () => (familyId && id ? cachedEvent(queryClient, familyId, id) : undefined),
  });
  if (state.status !== 'ready' || !familyId || !myMemberId) return null;
  if (id && event.isPending) {
    return (
      <PushedScreen className="gap-16" topBar={{ back: { label: e.back, onPress: page.close } }}>
        <View role="progressbar" aria-label={e.loading} className="gap-12">
          <View className="h-28 w-2/3 rounded-xs bg-surface-soft" />
          {[0, 1, 2].map((n) => (
            <View key={n} className="h-control-md rounded-md bg-surface-soft" />
          ))}
        </View>
      </PushedScreen>
    );
  }

  const ev = event.data;
  const date = CalendarDate.safeParse(params.date).success ? (params.date as string) : ev?.starts_on;
  const cover = ev && date && isCover(ev, myMemberId) ? eventOccurrence(ev, date) : null;
  if (cover) {
    return <SurpriseDetail occurrence={cover} members={state.members} slotTimes={page.slotTimes} onBack={page.close} onOpenUrl={(url) => void Linking.openURL(url)} onCopy={systemShare.copy} />;
  }
  const occurrence = ev && date && seesInFull(ev, myMemberId) ? eventOccurrence(ev, date) : null;
  if (!ev || !date || !occurrence) {
    return (
      <PushedScreen className="gap-16" topBar={{ back: { label: e.back, onPress: page.close } }}>
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
      readOnly={!online}
      onBack={page.close}
      onEdit={() => router.push(`/calendar/${ev.id}/edit?date=${date}` as Href)}
      onShare={() => router.push(`/calendar/${ev.id}/share?date=${date}` as Href)}
      onOpenUrl={(url) => void Linking.openURL(url)}
      onCopy={systemShare.copy}
      onTick={async (itemId, done) => {
        await setChecklistDone(client, itemId, done);
        page.refreshEvents();
      }}
      onDelete={async (scope) => {
        const undo = await deleteOccurrences(client, { event: ev, date, scope, familyId });
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
