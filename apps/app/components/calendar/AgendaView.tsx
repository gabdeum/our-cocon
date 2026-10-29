import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, View, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollViewInstance } from 'react-native';
import type { SlotTimes } from '@cocon/calendar';
import type { StoredEvent } from '@cocon/data';
import { EventListGroup, EventListRow, FloatingAdd, Text } from '@cocon/ui';
import { AGENDA_EMPTY_PAGES, AGENDA_MAX_PAGES, agendaWindow, layoutAgenda } from '../../lib/calendar-agenda';
import { memberLook, monthOccurrences, parseOccurrenceKey } from '../../lib/calendar-month';
import { getAgendaPlace, setAgendaPlace } from '../../lib/agenda-session';
import { useNow } from '../../lib/use-now';
import type { Member } from '../../lib/session';
import { strings } from '../../strings/en';

/** TabBar README: screens pad 180 under their content for the floating tab bar. */
const BOTTOM_PAD = 180;
/** Load the next 4 weeks when the end of the list is this close. */
const LOAD_AHEAD = 600;

export interface AgendaViewProps {
  userId: string;
  members: Member[];
  myMemberId: string;
  /** Loaded for the window reported through `onEventWindow`; undefined while loading. */
  events: StoredEvent[] | undefined;
  slotTimes: SlotTimes;
  hidden: ReadonlySet<string>;
  /** The day the list starts on (today, or a week on with ›). */
  anchor: string;
  today: string;
  /** The family's home time zone, for "Now". */
  timeZone: string;
  /** Changes when "Today" is pressed on today's list: back to the top. */
  top: number;
  onEventWindow: (window: { from: string; to: string }) => void;
  onAddEvent: (date: string) => void;
  onOpenEvent: (id: string, date: string) => void;
}

/**
 * Spec 040 (OC-CalAgenda): the days with events from `anchor` on, each in a white card, loaded
 * 4 weeks at a time as the list nears its end (FR-001). The list keeps its place for the
 * session when you switch views (FR-003).
 */
export function AgendaView({ userId, members, myMemberId, events, slotTimes, hidden, anchor, today, timeZone, top, onEventWindow, onAddEvent, onOpenEvent }: AgendaViewProps) {
  const now = useNow(timeZone);
  const look = useMemo(() => memberLook(members), [members]);
  const [place] = useState(() => getAgendaPlace(userId, anchor));
  const [pages, setPages] = useState(place.pages);
  const offset = useRef(place.offset);
  const restore = useRef(place.offset);
  const list = useRef<ScrollViewInstance>(null);

  const { from, to } = agendaWindow(anchor, pages);
  useEffect(() => onEventWindow({ from, to }), [from, to, onEventWindow]);
  useEffect(() => setAgendaPlace(userId, anchor, { pages, offset: offset.current }), [userId, anchor, pages]);

  const occurrences = useMemo(() => monthOccurrences(events ?? [], from, to, myMemberId, hidden), [events, from, to, myMemberId, hidden]);
  const groups = useMemo(() => layoutAgenda(from, to, occurrences, { today, now, look, slotTimes, members }), [from, to, occurrences, today, now, look, slotTimes, members]);

  // Nothing in the weeks loaded: look further, up to a year ahead, each time new events arrive.
  const empty = events !== undefined && groups.length === 0;
  const [seen, setSeen] = useState(events);
  // A page asked for by scrolling: no more until its events arrive, so one fling loads one page.
  const [waiting, setWaiting] = useState(false);
  if (events !== seen) {
    setSeen(events);
    setWaiting(false);
    if (empty && pages < AGENDA_EMPTY_PAGES) setPages(pages + 1);
  }

  const lastTop = useRef(top);
  useEffect(() => {
    if (top === lastTop.current) return;
    lastTop.current = top;
    offset.current = 0;
    setAgendaPlace(userId, anchor, { pages, offset: 0 });
    list.current?.scrollTo({ y: 0, animated: true });
  }, [top, userId, anchor, pages]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
    offset.current = contentOffset.y;
    setAgendaPlace(userId, anchor, { pages, offset: contentOffset.y });
    if (waiting || events === undefined || pages >= AGENDA_MAX_PAGES) return;
    if (contentOffset.y + layoutMeasurement.height >= contentSize.height - LOAD_AHEAD) {
      setWaiting(true);
      setPages(pages + 1);
    }
  };
  // Back from another view: once the list is tall enough, return to where it was.
  const onContentSizeChange = (_: number, height: number) => {
    if (restore.current > 0 && height >= restore.current) {
      list.current?.scrollTo({ y: restore.current, animated: false });
      restore.current = 0;
    }
  };
  const openEvent = (key: string) => {
    const { id, date } = parseOccurrenceKey(key);
    onOpenEvent(id, date);
  };

  return (
    <View className="flex-1">
      <ScrollView
        ref={list}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onContentSizeChange={onContentSizeChange}
        contentContainerClassName="gap-18 px-20 pt-4"
        contentContainerStyle={{ paddingBottom: BOTTOM_PAD }}
      >
        {groups.map((g) => (
          <EventListGroup key={g.date} heading={g.heading}>
            {g.events.map((e, i) => (
              <EventListRow key={e.key} event={e} onPress={() => openEvent(e.key)} last={i === g.events.length - 1} />
            ))}
          </EventListGroup>
        ))}
        {empty ? (
          <Text size={16} weight="700" color="ink-muted" className="pt-24 text-center">
            {strings.calendar.agenda.empty}
          </Text>
        ) : null}
      </ScrollView>
      <FloatingAdd label={strings.calendar.month.addEvent} onPress={() => onAddEvent(anchor)} hint={null} />
    </View>
  );
}
