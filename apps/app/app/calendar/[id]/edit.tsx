import { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { convertEventToReminder, loadEvent, saveEventChange } from '@cocon/data';
import { CalendarDate, type EventInput } from '@cocon/schemas/calendar';
import { BottomSheet, Button, Link } from '@cocon/ui';
import { AddSheet } from '../../../components/calendar/AddSheet';
import { eventOccurrence, seesInFull } from '../../../lib/event-detail';
import { changedFields, draftFromEvent, scopeBody, toInput } from '../../../lib/event-form';
import { useNotifications } from '../../../lib/notifications-context';
import { useReminderContext } from '../../../lib/reminder-actions';
import { newReminderForm } from '../../../lib/reminders';
import { useToast } from '../../../lib/toast';
import { useEventSheet } from '../../../lib/use-event-sheet';
import { strings } from '../../../strings';

const a = strings.calendar.add;
type Scope = 'all' | 'this' | 'future';

/**
 * /calendar/[id]/edit?date= (spec 041 FR-008): the add sheet filled in. A repeating event asks
 * first: "This event only" (an exception for `date`) or "All future events" (the series splits
 * there). Only an event this member sees in full opens; a surprise's cover, or Busy, says it couldn't
 * open (032-later L101). Only the creator splits a private or surprise series, or changes who can
 * see it (spec 043 FR-005); anyone else edits that date only. Its title switches to "Edit reminder":
 * saved that way, the dates the edit covers move to the reminders (Gabriel, 2026-11-25).
 */
export default function EditEventRoute() {
  const params = useLocalSearchParams<{ id: string; date?: string }>();
  const id = z.uuid().safeParse(params.id).success ? params.id : null;
  const sheet = useEventSheet();
  const { maybeAsk } = useNotifications();
  const reminders = useReminderContext();
  const queryClient = useQueryClient();
  const toast = useToast();
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

  const refreshReminders = () => void queryClient.invalidateQueries({ queryKey: ['reminders', familyId] });

  return (
    <AddSheet
      mode="edit"
      initialKind="event"
      // Only a family event becomes a reminder: everyone sees reminders, so a private event or a
      // surprise would be shown to the people it's kept from.
      switchable={e.visibility === 'family'}
      slotTimes={sheet.slotTimes}
      tracker={tracker}
      event={{
        mode: 'edit',
        initial,
        occurrenceOnly: chosen === 'this',
        editingId: e.id,
        canChangeVisibility: e.creator_member_id === myMemberId,
        creatorMemberId: e.creator_member_id,
        client,
        familyId,
        members: state.members,
        myMemberId,
        today: sheet.today,
        slotTimes: sheet.slotTimes,
        weekStartsOn: sheet.weekStartsOn,
        tracker,
        onClose: sheet.close,
        onSave: async (input) => {
          const done = await save(input);
          const fields = changedFields(before, input);
          if (fields.length) tracker.track('event_updated', { fields_changed: fields, scope: done });
          sheet.refreshEvents();
          sheet.close();
          if (input.reminder && input.reminder !== 'none') maybeAsk('reminder');
        },
      }}
      reminder={{
        mode: 'edit',
        initial: newReminderForm(myMemberId, date),
        members: state.members,
        today: sheet.today,
        use24h: sheet.use24h,
        weekStartsOn: sheet.weekStartsOn,
        quietHours: reminders.quietHours,
        onClose: sheet.close,
        // Saved as a reminder: the dates this edit covers (as Delete takes them) move to the reminders.
        onSave: async (draft) => {
          const moved = await convertEventToReminder(client, { event: e, date, scope: chosen, familyId, draft, tz: reminders.tz });
          tracker.track('calendar_item_converted', { from: 'event', to: 'reminder' });
          sheet.refreshEvents();
          refreshReminders();
          toast.show({
            text: a.movedToReminders,
            onUndo: () =>
              moved.undo().finally(() => {
                sheet.refreshEvents();
                refreshReminders();
              }),
          });
          sheet.close();
        },
      }}
    />
  );
}
