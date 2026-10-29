import { useEffect, useMemo, useRef } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { z } from 'zod';
import { loadEvent } from '@cocon/data';
import { CalendarDate } from '@cocon/schemas/calendar';
import { EventShareSheet, type EventShareSheetApi } from '../../../components/calendar/EventShareSheet';
import { eventOccurrence, seesInFull } from '../../../lib/event-detail';
import { openEventShareLink, shareEventLink, stopEventShareLink } from '../../../lib/event-share';
import { useEventSheet } from '../../../lib/use-event-sheet';

/**
 * /calendar/[id]/share?date= (spec 042 FR-005): share one date of a family event as a view-only
 * link, a sheet over the event page. A private or surprise event isn't offered (the database
 * refuses it too).
 */
export default function EventShareRoute() {
  const params = useLocalSearchParams<{ id: string; date?: string }>();
  const id = z.uuid().safeParse(params.id).success ? params.id : null;
  const date = CalendarDate.safeParse(params.date).success ? (params.date as string) : null;
  const sheet = useEventSheet();
  const { client, tracker, familyId, myMemberId } = sheet;
  const event = useQuery({ queryKey: ['events', familyId ?? '', 'one', id ?? ''], queryFn: () => (id ? loadEvent(client, id) : null), enabled: familyId !== null && id !== null });
  const ev = event.data;
  const occurrence = ev && date && myMemberId && seesInFull(ev, myMemberId) && ev.visibility === 'family' ? eventOccurrence(ev, date) : null;
  const title = occurrence?.title ?? '';
  const api = useMemo<EventShareSheetApi | null>(
    () =>
      id && date && title
        ? {
            open: () => openEventShareLink(client, id, date),
            stop: (token) => stopEventShareLink(client, token),
            copy: (text) => Clipboard.setStringAsync(text),
            share: (token) => shareEventLink(title, token),
          }
        : null,
    [client, id, date, title],
  );
  // Nothing to share (a bad link, or an event that can't be shared): back to where it came from.
  const nothing = !api && (id === null || date === null || (familyId !== null && !event.isPending));
  const { close } = sheet;
  const closed = useRef(false);
  useEffect(() => {
    if (!nothing || closed.current) return;
    closed.current = true;
    close();
  }, [nothing, close]);
  if (!api) return null;
  return <EventShareSheet api={api} tracker={tracker} onClose={sheet.close} />;
}
