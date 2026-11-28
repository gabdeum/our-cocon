import { useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { convertReminderToEvent, deleteReminder, loadReminder, updateReminder } from '@cocon/data';
import { Dialog } from '@cocon/ui';
import { AddSheet } from '../../../components/calendar/AddSheet';
import { newDraft } from '../../../lib/event-form';
import { useEventSheet } from '../../../lib/use-event-sheet';
import { closeReminderSheet, useReminderContext } from '../../../lib/reminder-actions';
import { formFromReminder, reminderKey } from '../../../lib/reminders';
import { useToast } from '../../../lib/toast';
import { strings } from '../../../strings';

const r = strings.reminders;

/**
 * /reminders/[id]/edit?focus=notes (spec 057 FR-006): the sheet filled in, with "Delete reminder"
 * at the bottom (a repeating one asks first: the whole series goes). `focus=notes`: "+ Add a note".
 * Its title switches to "Edit event": saved that way, the reminder moves to the calendar (Gabriel).
 */
export default function EditReminderRoute() {
  const params = useLocalSearchParams<{ id: string; focus?: string }>();
  const id = z.uuid().safeParse(params.id).success ? params.id : null;
  const ctx = useReminderContext();
  const sheet = useEventSheet();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { client, familyId, tz } = ctx;
  const stored = useQuery({ queryKey: reminderKey(familyId ?? '', id ?? ''), queryFn: () => loadReminder(client, id ?? ''), enabled: familyId !== null && id !== null, staleTime: 0, retry: false });
  const [confirm, setConfirm] = useState(false);
  // Deleted or done meanwhile (or a bad link): say so and close.
  const gone = familyId !== null && (!id || stored.isError || stored.data?.completed === true);
  useEffect(() => {
    if (!gone) return;
    toast.show({ text: r.gone, tone: 'warn' });
    closeReminderSheet();
  }, [gone, toast]);
  const x = stored.data;
  if (ctx.state.status !== 'ready' || !familyId || !sheet.myMemberId || gone || !x) return null;
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['reminders', familyId] });
  const remove = async () => {
    try {
      await deleteReminder(client, x.id);
      refresh();
      toast.show({ text: r.deleted, onUndo: () => deleteReminder(client, x.id, false).then(refresh) });
      closeReminderSheet();
    } catch {
      toast.show({ text: r.saveFailed, tone: 'warn' });
    }
  };
  return (
    <>
      <AddSheet
        mode="edit"
        initialKind="reminder"
        slotTimes={sheet.slotTimes}
        tracker={ctx.tracker}
        reminder={{
          mode: 'edit',
          initial: formFromReminder(x, tz),
          members: ctx.members,
          today: ctx.today,
          use24h: ctx.use24h,
          weekStartsOn: ctx.weekStartsOn,
          quietHours: ctx.quietHours,
          focusNotes: params.focus === 'notes',
          onClose: closeReminderSheet,
          onSave: async (draft) => {
            await updateReminder(client, x.id, draft, tz);
            refresh();
            closeReminderSheet();
          },
          onDelete: () => (x.repeat_rule ? setConfirm(true) : void remove()),
        }}
        event={{
          mode: 'edit',
          initial: newDraft({ date: formFromReminder(x, tz).date }, sheet.today, sheet.defaultReminder),
          client,
          familyId,
          members: ctx.members,
          myMemberId: sheet.myMemberId ?? '',
          today: sheet.today,
          slotTimes: sheet.slotTimes,
          weekStartsOn: sheet.weekStartsOn,
          tracker: ctx.tracker,
          onClose: closeReminderSheet,
          // Saved as an event: the reminder (its whole series) moves to the calendar.
          onSave: async (input) => {
            const moved = await convertReminderToEvent(client, { reminderId: x.id, input });
            ctx.tracker.track('calendar_item_converted', { from: 'reminder', to: 'event' });
            refresh();
            sheet.refreshEvents();
            toast.show({
              text: strings.calendar.add.movedToCalendar,
              onUndo: () =>
                moved.undo().finally(() => {
                  refresh();
                  sheet.refreshEvents();
                }),
            });
            closeReminderSheet();
          },
        }}
      />
      <Dialog
        visible={confirm}
        title={r.deleteAllTitle}
        body={r.deleteAllBody(x.title)}
        confirmLabel={r.deleteConfirm}
        onConfirm={() => {
          setConfirm(false);
          void remove();
        }}
        cancelLabel={r.keep}
        onCancel={() => setConfirm(false)}
      />
    </>
  );
}
