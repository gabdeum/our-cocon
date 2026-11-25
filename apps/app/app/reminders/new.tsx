import { NewItemSheet } from '../../components/calendar/NewItemSheet';
import { closeReminderSheet } from '../../lib/reminder-actions';

/**
 * /reminders/new (spec 057 FR-006): the add sheet over Home or the Reminders screen, starting on a
 * new reminder due today, for me; its title switches to a new event as on the calendar (Gabriel).
 */
export default function NewReminderRoute() {
  return <NewItemSheet initialKind="reminder" close={closeReminderSheet} />;
}
