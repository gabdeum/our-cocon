import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createReminder } from '@cocon/data';
import { ReminderDraft } from '@cocon/schemas';
import { ReminderSheet } from '../../components/reminders/ReminderSheet';
import { closeReminderSheet, useReminderContext } from '../../lib/reminder-actions';
import { createdProps, newReminderForm } from '../../lib/reminders';

/** /reminders/new (spec 057 FR-006): the sheet over Home or the Reminders screen, due today, for me. */
export default function NewReminderRoute() {
  const ctx = useReminderContext();
  const queryClient = useQueryClient();
  const { client, familyId, myMemberId, tz } = ctx;
  // Starts once, on the day it opened; later renders keep what's been typed.
  const [initial] = useState(() => (myMemberId ? newReminderForm(myMemberId, ctx.today) : null));
  if (ctx.state.status !== 'ready' || !familyId || !myMemberId || !initial) return null;
  return (
    <ReminderSheet
      mode="new"
      initial={initial}
      members={ctx.members}
      today={ctx.today}
      use24h={ctx.use24h}
      weekStartsOn={ctx.weekStartsOn}
      quietHours={ctx.quietHours}
      onClose={closeReminderSheet}
      onSave={async (draft) => {
        await createReminder(client, familyId, draft, tz);
        ctx.tracker.track('reminder_created', createdProps(ReminderDraft.parse(draft), myMemberId));
        void queryClient.invalidateQueries({ queryKey: ['reminders', familyId] });
        closeReminderSheet();
      }}
    />
  );
}
