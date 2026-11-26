import { useLocalSearchParams } from 'expo-router';
import { NewItemSheet } from '../../components/calendar/NewItemSheet';
import { prefillFrom } from '../../lib/event-form';
import { useEventSheet } from '../../lib/use-event-sheet';

/**
 * /calendar/new?date=&slot=|&time= (spec 041, design/flows.md): the add sheet over the calendar,
 * on the day and slot (or hour) it was opened from, starting on a new event.
 */
export default function NewEventRoute() {
  const params = useLocalSearchParams<{ date?: string; slot?: string; time?: string }>();
  const { close } = useEventSheet();
  return <NewItemSheet initialKind="event" prefill={prefillFrom(params)} close={close} />;
}
