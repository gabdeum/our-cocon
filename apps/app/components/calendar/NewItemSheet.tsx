import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { daysBetween } from '@cocon/calendar';
import { createReminder, deleteReminder, deleteReminderNow, saveEvent, undoCreateEvent } from '@cocon/data';
import { ReminderDraft } from '@cocon/schemas';
import type { AddKind } from '../../lib/add-switch';
import { newDraft, toastText, type Prefill } from '../../lib/event-form';
import { useNotifications } from '../../lib/notifications-context';
import { useReminderContext } from '../../lib/reminder-actions';
import { createdProps, newReminderForm } from '../../lib/reminders';
import { useToast } from '../../lib/toast';
import { useEventSheet } from '../../lib/use-event-sheet';
import { strings } from '../../strings/en';
import { AddSheet } from './AddSheet';

/**
 * The add sheet as /calendar/new and /reminders/new open it (spec 041, 057 FR-006): one sheet, on
 * an event or a reminder, its title switching between them and keeping what's typed. Saved, it
 * closes on a toast with Undo.
 */
export function NewItemSheet({ initialKind, prefill = {}, close }: { initialKind: AddKind; prefill?: Prefill; close: () => void }) {
  const sheet = useEventSheet();
  const reminders = useReminderContext();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { maybeAsk } = useNotifications();
  const { state, client, tracker, familyId, myMemberId, today, slotTimes } = sheet;
  // The drafts start once, on the day the sheet opened; later renders keep what's been typed.
  const [initial] = useState(() => (myMemberId ? newDraft(prefill, today, sheet.defaultReminder) : null));
  const [initialReminder] = useState(() => (myMemberId ? newReminderForm(myMemberId, prefill.date ?? today) : null));
  if (state.status !== 'ready' || !familyId || !myMemberId || !initial || !initialReminder) return null;
  const refreshReminders = () => void queryClient.invalidateQueries({ queryKey: ['reminders', familyId] });
  return (
    <AddSheet
      initialKind={initialKind}
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
        onClose: close,
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
          close();
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
        suggest: { client, tz: reminders.tz, tracker },
        onClose: close,
        onSave: async (draft) => {
          const id = await createReminder(client, familyId, draft, reminders.tz);
          tracker.track('reminder_created', createdProps(ReminderDraft.parse(draft), myMemberId));
          refreshReminders();
          toast.show({
            text: strings.reminders.createdToast(draft.title),
            // Gone for good, as a new event's Undo: nothing left in Recently deleted.
            onUndo: () =>
              deleteReminder(client, id)
                .then(() => deleteReminderNow(client, id))
                .finally(refreshReminders),
          });
          close();
          // Spec 059: every reminder notifies, so the first one asks (spec 046 FR-002), once the sheet is gone.
          maybeAsk('todo');
        },
      }}
    />
  );
}
