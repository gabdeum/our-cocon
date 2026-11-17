import { useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { deleteReminder, loadReminder, updateReminder } from '@cocon/data';
import { Dialog } from '@cocon/ui';
import { ReminderSheet } from '../../../components/reminders/ReminderSheet';
import { closeReminderSheet, useReminderContext } from '../../../lib/reminder-actions';
import { formFromReminder, reminderKey } from '../../../lib/reminders';
import { useToast } from '../../../lib/toast';
import { strings } from '../../../strings/en';

const r = strings.reminders;

/**
 * /reminders/[id]/edit?focus=notes (spec 057 FR-006): the sheet filled in, with "Delete reminder"
 * at the bottom (a repeating one asks first: the whole series goes). `focus=notes`: "+ Add a note".
 */
export default function EditReminderRoute() {
  const params = useLocalSearchParams<{ id: string; focus?: string }>();
  const id = z.uuid().safeParse(params.id).success ? params.id : null;
  const ctx = useReminderContext();
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
  if (ctx.state.status !== 'ready' || !familyId || gone || !x) return null;
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
      <ReminderSheet
        mode="edit"
        initial={formFromReminder(x, tz)}
        members={ctx.members}
        today={ctx.today}
        use24h={ctx.use24h}
        weekStartsOn={ctx.weekStartsOn}
        quietHours={ctx.quietHours}
        focusNotes={params.focus === 'notes'}
        onClose={closeReminderSheet}
        onSave={async (draft) => {
          await updateReminder(client, x.id, draft, tz);
          refresh();
          closeReminderSheet();
        }}
        onDelete={() => (x.repeat_rule ? setConfirm(true) : void remove())}
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
