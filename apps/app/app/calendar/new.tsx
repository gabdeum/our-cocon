import { useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { saveEvent, undoCreateEvent } from '@cocon/data';
import { EventSheet } from '../../components/calendar/EventSheet';
import { newDraft, prefillFrom, toastText } from '../../lib/event-form';
import { useToast } from '../../lib/toast';
import { useEventSheet } from '../../lib/use-event-sheet';

/**
 * /calendar/new?date=&slot=|&time= (spec 041, design/flows.md): the add sheet over the calendar,
 * on the day and slot (or hour) it was opened from. Saved, it closes on a toast with Undo.
 */
export default function NewEventRoute() {
  const params = useLocalSearchParams<{ date?: string; slot?: string; time?: string }>();
  const sheet = useEventSheet();
  const toast = useToast();
  const { state, client, tracker, familyId, myMemberId, today, slotTimes } = sheet;
  // The draft starts once, on the day the sheet opened; later renders keep what's been typed.
  const [initial] = useState(() => (myMemberId ? newDraft(prefillFrom(params), today, myMemberId) : null));
  if (state.status !== 'ready' || !familyId || !myMemberId || !initial) return null;
  return (
    <EventSheet
      mode="new"
      initial={initial}
      client={client}
      familyId={familyId}
      members={state.members}
      myMemberId={myMemberId}
      today={today}
      slotTimes={slotTimes}
      weekStartsOn={sheet.weekStartsOn}
      tracker={tracker}
      onClose={sheet.close}
      onSave={async (input, meta) => {
        const id = await saveEvent(client, input);
        tracker.track('event_created', {
          source: 'app',
          time_type: input.time_type,
          slot: input.slots?.[0] ?? null,
          member_count: input.members.length,
          has_repeat: input.recurrence != null,
          used_more_options: meta.usedMoreOptions,
          seconds_to_save: meta.secondsToSave,
        });
        sheet.refreshEvents();
        toast.show({
          text: toastText(input, today, slotTimes),
          onUndo: () =>
            undoCreateEvent(client, id)
              .then(() => tracker.track('event_create_undone', {}))
              .finally(sheet.refreshEvents),
        });
        sheet.close();
      }}
    />
  );
}
