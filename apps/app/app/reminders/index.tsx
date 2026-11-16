import { useEffect, useRef, useState } from 'react';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useInfiniteQuery, useQuery, type InfiniteData } from '@tanstack/react-query';
import { addDays, dateLabel } from '@cocon/calendar';
import { catchUpReminders, loadReminderSection, type PlacedReminder, type ReminderPage } from '@cocon/data';
import type { ReminderSection } from '@cocon/schemas';
import { ReminderDrawerHost, type OpenDrawer } from '../../components/reminders/ReminderDrawerHost';
import { RemindersScreen, type ScreenSection } from '../../components/reminders/RemindersScreen';
import { useOnline } from '../../lib/online';
import { useFailureToast } from '../../lib/toast';
import { useReminderActions, useReminderContext, useReminderMine } from '../../lib/reminder-actions';
import { LIST_SECTIONS, reminderSectionKey } from '../../lib/reminders';
import { strings } from '../../strings/en';

const r = strings.reminders;

/**
 * /reminders (spec 057 FR-003; `?open={id}` opens that reminder's drawer, design/flows.md): from
 * Home's card and the calendar. Missed repeats are closed once, then each section loads its first
 * page in one request; "Show more" loads the next 20 (SC-001).
 */
export default function RemindersRoute() {
  const params = useLocalSearchParams<{ open?: string }>();
  const ctx = useReminderContext();
  const online = useOnline();
  const { client, familyId, tz } = ctx;
  const [mine, setMine] = useReminderMine(ctx.userId);
  const actions = useReminderActions(ctx);
  const [snoozedOpen, setSnoozedOpen] = useState(false);
  const [drawer, setDrawer] = useState<OpenDrawer | null>(null);

  // FR-005 of 056 once for the screen, not once per section; not live, so a tick doesn't rerun it.
  const caughtUp = useQuery({ queryKey: ['reminders-catch-up', familyId ?? '', tz], queryFn: () => catchUpReminders(client, tz), enabled: familyId !== null, staleTime: 60_000 });
  const ready = familyId !== null && mine !== null && caughtUp.isFetched;
  const section = (key: ReminderSection) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks -- one per section, always the same five, in order
    useInfiniteQuery({
      queryKey: reminderSectionKey(familyId ?? '', key, mine ?? false, tz),
      queryFn: ({ pageParam }) => loadReminderSection(client, { section: key, mine: mine ?? false, tz, cursor: pageParam, caughtUp: true }),
      initialPageParam: null as string | null,
      getNextPageParam: (last: ReminderPage) => last.nextCursor,
      enabled: ready,
    });
  const lists = { overdue: section('overdue'), today: section('today'), tomorrow: section('tomorrow'), later: section('later'), snoozed: section('snoozed') };
  const rowsOf = (data: InfiniteData<ReminderPage> | undefined): PlacedReminder[] => data?.pages.flatMap((p) => p.rows) ?? [];

  const viewed = useRef<boolean | null>(null);
  useEffect(() => {
    if (mine === null || viewed.current === mine) return;
    viewed.current = mine;
    ctx.tracker.track('reminders_list_viewed', { filter: mine ? 'mine' : 'everyone' });
  }, [mine, ctx.tracker]);

  const loaded = LIST_SECTIONS.every((k) => lists[k].data) && lists.snoozed.data;
  // Spec 053 FR-015: a failed load is a warn toast with Try again, never a spinner that stays.
  const failed = Object.values(lists).some((l) => l.isError && !l.data);
  useFailureToast(failed && r.loadFailed, () => Object.values(lists).forEach((l) => l.isError && void l.refetch()));
  const labels: Record<(typeof LIST_SECTIONS)[number], string> = {
    overdue: r.overdue,
    today: r.todayOn(dateLabel(ctx.today)),
    tomorrow: r.tomorrowOn(dateLabel(addDays(ctx.today, 1))),
    later: r.later,
  };
  // A ticked row stays where it was, struck through, until the screen is left; a snoozed or deleted one goes.
  const sections: ScreenSection[] | undefined = loaded
    ? LIST_SECTIONS.map((key) => {
        const ticked = [...actions.ticked.values()].filter((t) => t.row.section === key);
        const live = rowsOf(lists[key].data).filter((x) => !actions.hidden.has(x.id) && !actions.ticked.has(x.id));
        const rows = [...live.map((row) => ({ row, done: false })), ...ticked.map((t) => ({ row: t.row, done: true }))].sort((a, b) => (a.row.sort_at < b.row.sort_at ? -1 : a.row.sort_at > b.row.sort_at ? 1 : 0));
        return { key, label: labels[key], rows, canMore: lists[key].hasNextPage, loadingMore: lists[key].isFetchingNextPage };
      }).filter((s) => s.rows.length > 0)
    : undefined;
  const snoozedRows = rowsOf(lists.snoozed.data).filter((x) => !actions.hidden.has(x.id));

  // `?open={id}`: that reminder's drawer, once the lists are in (059's notifications open it). Set
  // while rendering, once, so the drawer keeps the reminder even after a tick moves it.
  const [toOpen, setToOpen] = useState(params.open ?? null);
  if (toOpen && loaded) {
    const row = [...LIST_SECTIONS.flatMap((k) => rowsOf(lists[k].data)), ...rowsOf(lists.snoozed.data)].find((x) => x.id === toOpen);
    setToOpen(null);
    if (row) setDrawer({ row, source: 'list' });
  }

  if (ctx.state.status !== 'ready') return null;
  return (
    <>
      <RemindersScreen
        sections={sections}
        failed={failed}
        snoozed={lists.snoozed.data ? { rows: snoozedRows, canMore: lists.snoozed.hasNextPage } : undefined}
        snoozedOpen={snoozedOpen}
        onToggleSnoozed={() => setSnoozedOpen(!snoozedOpen)}
        mine={mine}
        onMine={setMine}
        members={ctx.members}
        today={ctx.today}
        tz={tz}
        use24h={ctx.use24h}
        readOnly={!online}
        onToggle={(row, done) => void (done ? actions.untick(row.id) : actions.tick(row, 'list'))}
        onOpen={(row) => setDrawer({ row, source: 'list' })}
        onMore={(key) => {
          ctx.tracker.track('reminders_show_more', { section: key });
          void lists[key].fetchNextPage();
        }}
        // Casts: the typed routes file (.expo/types) is generated by `expo start`.
        onAdd={() => router.push('/reminders/new' as Href)}
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/' as Href))}
      />
      {drawer ? <ReminderDrawerHost open={drawer} ctx={ctx} actions={actions} onClose={() => setDrawer(null)} /> : null}
    </>
  );
}
