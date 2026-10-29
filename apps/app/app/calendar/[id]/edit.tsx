import { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { loadEvent, saveEventChange } from '@cocon/data';
import { CalendarDate, type EventInput } from '@cocon/schemas/calendar';
import { BottomSheet, Button, Link } from '@cocon/ui';
import { EventSheet } from '../../../components/calendar/EventSheet';
import { eventOccurrence, seesInFull } from '../../../lib/event-detail';
import { changedFields, draftFromEvent, scopeBody, toInput } from '../../../lib/event-form';
import { useEventSheet } from '../../../lib/use-event-sheet';
import { strings } from '../../../strings/en';

const a = strings.calendar.add;
type Scope = 'all' | 'this' | 'future';

/**
 * /calendar/[id]/edit?date= (spec 041 FR-008): the add sheet filled in. A repeating event asks
 * first: "This event only" (an exception for `date`) or "All future events" (the series splits
 * there). Only an event this member sees in full opens; a surprise's cover, or Busy, says it couldn't
 * open (032-later L101). Only the creator splits a private or surprise series, or changes who can
 * see it (spec 043 FR-005); anyone else edits that date only.
 */
export default function EditEventRoute() {
  const params = useLocalSearchParams<{ id: string; date?: string }>();
  const id = z.uuid().safeParse(params.id).success ? params.id : null;
  const sheet = useEventSheet();
  const { state, client, tracker, familyId, myMemberId } = sheet;
  const event = useQuery({ queryKey: ['events', familyId ?? '', 'one', id ?? ''], queryFn: () => (id ? loadEvent(client, id) : null), enabled: familyId !== null && id !== null, staleTime: 0 });
  const [scope, setScope] = useState<Scope | null>(null);
  if (state.status !== 'ready' || !familyId || !myMemberId) return null;
  if (id && event.isPending) return null;

  const e = event.data;
  const date = CalendarDate.safeParse(params.date).success ? (params.date as string) : e?.starts_on;
  const occurrence = e && date && seesInFull(e, myMemberId) ? eventOccurrence(e, date) : null;
  if (!e || !date || !occurrence) {
    return (
      <BottomSheet visible onClose={sheet.close} title={a.loadFailedTitle} lead={a.loadFailedBody} closeLabel={a.close} footer={<Button label={a.cancel} variant="soft" block onPress={sheet.close} />}>
        <View />
      </BottomSheet>
    );
  }
  const repeats = e.recurrence != null;
  // Only the creator splits a private or surprise series (split_event): others change one date.
  const canSplit = e.visibility === 'family' || e.creator_member_id === myMemberId;
  if (repeats && canSplit && scope === null) {
    return (
      <BottomSheet visible onClose={sheet.close} title={a.scopeTitle} lead={scopeBody(e, date)} closeLabel={a.close}>
        <Button label={a.thisOnly} block onPress={() => setScope('this')} />
        <Button label={a.allFuture} variant="outline" block onPress={() => setScope('future')} />
        <Link label={a.cancel} tone="quiet" size={16} className="self-center" onPress={sheet.close} />
      </BottomSheet>
    );
  }
  const chosen: Scope = scope ?? (repeats ? 'this' : 'all');
  const initial = draftFromEvent(occurrence, occurrence.starts_on);
  const before = toInput(initial, state.members, { occurrence: chosen === 'this' });

  const save = (input: EventInput): Promise<Scope> => saveEventChange(client, { event: e, date, scope: chosen, familyId, before, input });

  return (
    <EventSheet
      mode="edit"
      initial={initial}
      occurrenceOnly={chosen === 'this'}
      editingId={e.id}
      canChangeVisibility={e.creator_member_id === myMemberId}
      client={client}
      familyId={familyId}
      members={state.members}
      myMemberId={myMemberId}
      today={sheet.today}
      slotTimes={sheet.slotTimes}
      weekStartsOn={sheet.weekStartsOn}
      tracker={tracker}
      onClose={sheet.close}
      onSave={async (input) => {
        const done = await save(input);
        const fields = changedFields(before, input);
        if (fields.length) tracker.track('event_updated', { fields_changed: fields, scope: done });
        sheet.refreshEvents();
        sheet.close();
      }}
    />
  );
}
