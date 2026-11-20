import { useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { daysBetween } from '@cocon/calendar';
import { createReminder, saveEvent, undoCreateEvent } from '@cocon/data';
import { ReminderDraft } from '@cocon/schemas';
import { AddSheet } from '../../components/calendar/AddSheet';
import { newDraft, prefillFrom, toastText } from '../../lib/event-form';
import { useNotifications } from '../../lib/notifications-context';
import { useReminderContext } from '../../lib/reminder-actions';
import { createdProps, newReminderForm } from '../../lib/reminders';
import { useToast } from '../../lib/toast';
import { useEventSheet } from '../../lib/use-event-sheet';

/**
 * /calendar/new?date=&slot=|&time= (spec 041, design/flows.md): the add sheet over the calendar,
 * on the day and slot (or hour) it was opened from. Saved, it closes on a toast with Undo. Its
 * title switches to a new reminder (as /reminders/new saves it), keeping what's typed.
 */
export default function NewEventRoute() {
  const params = useLocalSearchParams<{ date?: string; slot?: string; time?: string }>();
  const sheet = useEventSheet();
  const reminders = useReminderContext();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { maybeAsk } = useNotifications();
  const { state, client, tracker, familyId, myMemberId, today, slotTimes } = sheet;
  // The drafts start once, on the day the sheet opened; later renders keep what's been typed.
  const [initial] = useState(() => (myMemberId ? newDraft(prefillFrom(params), today, sheet.defaultReminder) : null));
  const [initialReminder] = useState(() => (myMemberId ? newReminderForm(myMemberId, today) : null));
  if (state.status !== 'ready' || !familyId || !myMemberId || !initial || !initialReminder) return null;
  return (
    <AddSheet
      slotTimes={slotTimes}
      tracker={tracker}
      event={{
        mode: 'new',
        initial,
        client,
        familyId,
        members: state.members,
        myMemberId,
        today,
        slotTimes,
        weekStartsOn: sheet.weekStartsOn,
        tracker,
        onClose: sheet.close,
        onSave: async (input, meta) => {
          const id = await saveEvent(client, input);
          tracker.track('event_created', {
            source: 'app',
            time_type: input.time_type,
            slot: input.slots?.[0] ?? null,
            member_count: input.members.length,
            has_repeat: input.recurrence != null,
            used_more_options: meta.usedMoreOptions,
            seconds_to_save: meta.secondsToSave,
            days: daysBetween(input.starts_on, input.ends_on) + 1,
            used_suggestion: meta.usedSuggestion,
          });
          sheet.refreshEvents();
          toast.show({
            text: toastText(input, today, slotTimes, sheet.use24h),
            onUndo: () =>
              undoCreateEvent(client, id)
                .then(() => tracker.track('event_create_undone', {}))
                .finally(sheet.refreshEvents),
          });
          sheet.close();
          // Spec 046 FR-002: the first event with a reminder may ask for notifications.
          if (input.reminder && input.reminder !== 'none') maybeAsk('reminder');
        },
      }}
      reminder={{
        mode: 'new',
        initial: initialReminder,
        members: state.members,
        today,
        use24h: sheet.use24h,
        weekStartsOn: sheet.weekStartsOn,
        quietHours: reminders.quietHours,
        onClose: sheet.close,
        onSave: async (draft) => {
          await createReminder(client, familyId, draft, reminders.tz);
          tracker.track('reminder_created', createdProps(ReminderDraft.parse(draft), myMemberId));
          void queryClient.invalidateQueries({ queryKey: ['reminders', familyId] });
          sheet.close();
          // Spec 059: every reminder notifies, so the first one asks (spec 046 FR-002), once the sheet is gone.
          maybeAsk('todo');
        },
      }}
    />
  );
}
