import { useRef, useState } from 'react';
import type { SlotTimes } from '@cocon/calendar';
import type { Tracker } from '@cocon/schemas';
import { BottomSheet } from '@cocon/ui';
import { changedSince, eventPatch, reminderPatch, sharedFromEvent, sharedFromReminder, type AddKind, type Shared } from '../../lib/add-switch';
import { useReminderForm, type ReminderSheetProps } from '../reminders/ReminderSheet';
import { useEventForm, type EventSheetProps } from './EventSheet';
import { strings } from '../../strings/en';

export interface AddSheetProps {
  event: EventSheetProps;
  reminder: ReminderSheetProps;
  slotTimes: SlotTimes;
  tracker: Tracker;
}

/**
 * The calendar's add sheet: "New event · New reminder" in place of its title. Both forms stay in
 * one sheet, which never closes while switching; the title, day, time and who go across.
 */
export function AddSheet({ event, reminder, slotTimes, tracker }: AddSheetProps) {
  const [kind, setKind] = useState<AddKind>('event');
  const ev = useEventForm(event);
  const rem = useReminderForm(reminder);
  // What each form held when it was last left (or filled), so only what changed since goes across.
  const left = useRef<Record<AddKind, Shared | null>>({ event: null, reminder: null });

  const switchTo = (to: AddKind) => {
    if (to === kind) return;
    const from = kind === 'event' ? sharedFromEvent(ev.draft, slotTimes) : sharedFromReminder(rem.form);
    const diff = changedSince(from, left.current[kind]);
    left.current[kind] = from;
    if (to === 'event') {
      const patch = eventPatch(diff);
      ev.patch(patch);
      left.current.event = sharedFromEvent({ ...ev.draft, ...patch }, slotTimes);
    } else {
      const patch = reminderPatch(diff);
      rem.patch(patch);
      left.current.reminder = sharedFromReminder({ ...rem.form, ...patch });
    }
    setKind(to);
    tracker.track('add_sheet_switched', { to });
  };

  return (
    <BottomSheet
      {...(kind === 'event' ? ev.sheet : rem.sheet)}
      titleSwitch={{
        label: strings.calendar.add.newKind,
        segments: [
          { key: 'event', label: strings.calendar.add.titleNew },
          { key: 'reminder', label: strings.reminders.sheetNew },
        ],
        value: kind,
        onChange: (key) => switchTo(key as AddKind),
      }}
    />
  );
}
