import { useRef, useState } from 'react';
import type { SlotTimes } from '@cocon/calendar';
import type { Tracker } from '@cocon/schemas';
import { BottomSheet, Callout } from '@cocon/ui';
import { changedSince, eventPatch, reminderPatch, sharedFromEvent, sharedFromReminder, type AddKind, type Shared } from '../../lib/add-switch';
import type { EventDraft } from '../../lib/event-form';
import type { ReminderForm } from '../../lib/reminders';
import { useReminderForm, type ReminderSheetProps } from '../reminders/ReminderSheet';
import { useEventForm, type EventSheetProps } from './EventSheet';
import { strings } from '../../strings/en';

const a = strings.calendar.add;

export interface AddSheetProps {
  /** New, or editing what `initialKind` is: the other kind saves by moving it (the route's `onSave`). */
  mode?: 'new' | 'edit';
  /** Which form it opens on: the calendar's "+" an event, the Reminders' "+" a reminder. */
  initialKind?: AddKind;
  /** Off for what can't move (a surprise): no switch, the one form. */
  switchable?: boolean;
  event: EventSheetProps;
  reminder: ReminderSheetProps;
  slotTimes: SlotTimes;
  tracker: Tracker;
}

/** What an event has that a reminder can't hold (spoken before it's saved as one). */
export function lostAsReminder(d: EventDraft): string[] {
  const lost = a.lostParts;
  const parts: (string | null)[] = [
    d.who.length > 1 || d.who.includes('others') ? lost.people : null,
    d.location.trim() ? lost.place : null,
    d.category ? lost.type : null,
    d.responsible ? lost.who_takes : null,
    d.checklist.length ? lost.checklist : null,
  ];
  return parts.filter((x): x is string => x !== null);
}

/** A rollover picked by hand ("If it's not done") is the reminder's own. */
const lostAsEvent = (f: ReminderForm) => f.rollover !== null;

/**
 * The calendar's add and edit sheet: "New event · New reminder" (or "Edit event · Edit reminder")
 * in place of its title. Both forms stay in one sheet, which never closes while switching; the
 * title, day, time, who, repeat and notes go across. Editing, saving the other kind moves the item.
 */
export function AddSheet({ mode = 'new', initialKind = 'event', switchable = true, event, reminder, slotTimes, tracker }: AddSheetProps) {
  const [kind, setKind] = useState<AddKind>(initialKind);
  const ev = useEventForm(event);
  // The notes toolbar's `note_format_applied` goes through the sheet's tracker (spec 074).
  const rem = useReminderForm({ ...reminder, tracker: reminder.tracker ?? tracker });
  // What each form held when it was last left (or filled), so only what changed since goes across.
  const left = useRef<Record<AddKind, Shared | null>>({ event: null, reminder: null });

  const switchTo = (to: AddKind) => {
    if (to === kind) return;
    const from = kind === 'event' ? sharedFromEvent(ev.draft, slotTimes, event.occurrenceOnly) : sharedFromReminder(rem.form);
    const diff = changedSince(from, left.current[kind]);
    left.current[kind] = from;
    if (to === 'event') {
      const patch = eventPatch(diff);
      ev.patch(patch);
      left.current.event = sharedFromEvent({ ...ev.draft, ...patch }, slotTimes, event.occurrenceOnly);
    } else {
      const patch = reminderPatch(diff, rem.form.date);
      rem.patch(patch);
      left.current.reminder = sharedFromReminder({ ...rem.form, ...patch });
    }
    setKind(to);
    tracker.track('add_sheet_switched', { to, mode });
  };

  const sheet = kind === 'event' ? ev.sheet : rem.sheet;
  // Moving an edited item: say what the other kind can't keep.
  const moving = mode === 'edit' && kind !== initialKind;
  const lost = moving ? (kind === 'reminder' ? lostAsReminder(ev.draft) : []) : [];
  const note = lost.length ? a.losesAsReminder(lost) : moving && kind === 'event' && lostAsEvent(rem.form) ? a.losesAsEvent : null;
  const edit = mode === 'edit';
  return (
    <BottomSheet
      {...sheet}
      children={
        <>
          {note ? <Callout variant="warn" text={note} /> : null}
          {sheet.children}
        </>
      }
      titleSwitch={
        switchable
          ? {
              label: edit ? a.editKind : a.newKind,
              segments: [
                { key: 'event', label: edit ? a.titleEdit : a.titleNew },
                { key: 'reminder', label: edit ? strings.reminders.sheetEdit : strings.reminders.sheetNew },
              ],
              value: kind,
              onChange: (key) => switchTo(key as AddKind),
            }
          : undefined
      }
    />
  );
}
