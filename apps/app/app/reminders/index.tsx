import { useEffect, useRef, useState } from 'react';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useInfiniteQuery, useQuery, type InfiniteData } from '@tanstack/react-query';
import { addDays, dateLabel, formatTime, timeIn } from '@cocon/calendar';
import { catchUpReminders, loadPlacedReminder, loadReminderSection, loadRemindersDoneToday, type DoneReminder, type PlacedReminder, type ReminderPage } from '@cocon/data';
import type { ReminderSection } from '@cocon/schemas';
import { navFor, SplitView, useLayoutTier } from '@cocon/ui';
import { RouteRail } from '../../components/RouteRail';
import { ReminderDrawerHost, type OpenDrawer } from '../../components/reminders/ReminderDrawerHost';
import { RemindersScreen, type ScreenSection } from '../../components/reminders/RemindersScreen';
import { useOnline } from '../../lib/online';
import { useFailureToast } from '../../lib/toast';
import { useReminderActions, useReminderContext, useReminderMine } from '../../lib/reminder-actions';
import { FETCH_ON_OPEN, LIST_SECTIONS, doneKey, freshReminders, reminderSectionKey, remindersDoneKey } from '../../lib/reminders';
import { strings } from '../../strings';

const r = strings.reminders;

/**
 * /reminders (spec 057 FR-003; `?open={id}` opens that reminder's drawer, design/flows.md): from
 * Home's card and the calendar, and from 960 the rail, which it shows too in place of its back
 * button. Missed repeats are closed once, then each section loads its first page in one request;
 * "Show more" loads the next 20 (SC-001).
 */
export default function RemindersRoute() {
  const params = useLocalSearchParams<{ open?: string }>();
  const ctx = useReminderContext();
  const online = useOnline();
  const { client, familyId, tz } = ctx;
  const [mine, setMine] = useReminderMine(ctx.userId);
  const actions = useReminderActions(ctx);
  const [drawer, setDrawer] = useState<OpenDrawer | null>(null);
  const rail = navFor(useLayoutTier().tier) === 'rail';

  // FR-005 of 056 once for the screen, not once per section; not live, so a tick doesn't rerun it.
  const caughtUp = useQuery({ queryKey: ['reminders-catch-up', familyId ?? '', tz], queryFn: () => catchUpReminders(client, tz), enabled: familyId !== null, staleTime: 60_000 });
  const ready = familyId !== null && mine !== null && caughtUp.isFetched;
  const section = (key: ReminderSection) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks -- one per section, always the same four, in order
    useInfiniteQuery({
      queryKey: reminderSectionKey(familyId ?? '', key, mine ?? false, tz),
      queryFn: ({ pageParam }) => loadReminderSection(client, { section: key, mine: mine ?? false, tz, cursor: pageParam, caughtUp: true }),
      initialPageParam: null as string | null,
      getNextPageParam: (last: ReminderPage) => last.nextCursor,
      enabled: ready,
      ...FETCH_ON_OPEN,
    });
  // Spec 058: what was done today stays at the bottom of Today, struck through, until midnight.
  const doneToday = useQuery({ queryKey: remindersDoneKey(familyId ?? '', ctx.today, tz), queryFn: () => loadRemindersDoneToday(client, tz), enabled: familyId !== null, ...FETCH_ON_OPEN });
  const lists = { overdue: section('overdue'), today: section('today'), tomorrow: section('tomorrow'), later: section('later') };
  const rowsOf = (data: InfiniteData<ReminderPage> | undefined): PlacedReminder[] => data?.pages.flatMap((p) => p.rows) ?? [];

  const viewed = useRef<boolean | null>(null);
  useEffect(() => {
    if (mine === null || viewed.current === mine) return;
    viewed.current = mine;
    ctx.tracker.track('reminders_list_viewed', { filter: mine ? 'mine' : 'everyone' });
  }, [mine, ctx.tracker]);

  // Not the lists saved on the device while online (a reload would flash what has since changed).
  const fresh = <T,>(q: { data: T | undefined; isFetchedAfterMount: boolean }) => freshReminders(q, online);
  const loaded = LIST_SECTIONS.every((k) => fresh(lists[k]));
  // Spec 053 FR-015: a failed load is a warn toast with Try again, never a spinner that stays.
  const failed = Object.values(lists).some((l) => l.isError && !l.data);
  useFailureToast(failed && r.loadFailed, () => Object.values(lists).forEach((l) => l.isError && void l.refetch()));
  const labels: Record<(typeof LIST_SECTIONS)[number], string> = {
    overdue: r.overdue,
    today: r.todayOn(dateLabel(ctx.today)),
    tomorrow: r.tomorrowOn(dateLabel(addDays(ctx.today, 1))),
    later: r.later,
  };
  // Spec 058: a ticked row goes to the bottom of Today, struck through; so does anything done earlier
  // today (after a reload too), until midnight. A snoozed or deleted one goes.
  const isMine = (x: PlacedReminder) => !mine || x.assignee_id === null || x.assignee_id === ctx.myMemberId;
  const ticked = [...actions.ticked.values()].filter((t) => isMine(t.row));
  const tickedKeys = new Set(ticked.map((t) => doneKey(t)));
  const doneRows = [
    ...(fresh(doneToday) ?? []).filter((d) => isMine(d.row) && !tickedKeys.has(doneKey(d)) && !actions.hidden.has(doneKey(d))),
  ].map((d: DoneReminder) => ({ row: d.row, done: true, detail: r.doneAt(formatTime(timeIn(tz, new Date(d.closedAt)), ctx.use24h)), locked: d.undo === null }));
  const doneByKey = new Map((fresh(doneToday) ?? []).map((d) => [doneKey(d), d]));
  const sections: ScreenSection[] | undefined = loaded
    ? LIST_SECTIONS.map((key) => {
        const live = rowsOf(fresh(lists[key])).filter((x) => !actions.hidden.has(x.id) && !actions.ticked.has(x.id));
        const rows = [
          ...live.map((row) => ({ row, done: false })),
          ...(key === 'today' ? [...doneRows, ...ticked.map((t) => ({ row: t.row, done: true }))] : []),
        ];
        return { key, label: labels[key], rows, canMore: lists[key].hasNextPage, loadingMore: lists[key].isFetchingNextPage };
      }).filter((s) => s.rows.length > 0)
    : undefined;

  // `?open={id}`: that reminder's drawer, once the lists are in (059's notifications open it, also
  // while this screen is already open). Set while rendering, once, so the drawer keeps the reminder
  // even after a tick moves it. One not on the loaded pages is loaded on its own (032-later L148).
  const [toOpen, setToOpen] = useState(params.open ?? null);
  const [asked, setAsked] = useState(params.open);
  if (params.open !== asked) {
    setAsked(params.open);
    setToOpen(params.open ?? null);
  }
  if (toOpen && loaded) {
    const id = toOpen;
    const row = LIST_SECTIONS.flatMap((k) => rowsOf(fresh(lists[k]))).find((x) => x.id === id);
    setToOpen(null);
    if (row) setDrawer({ row, source: 'notification' });
    else
      void loadPlacedReminder(client, id, tz)
        .then((placed) => placed && setDrawer({ row: placed, source: 'notification' }))
        .catch(() => undefined);
  }

  if (ctx.state.status !== 'ready') return null;
  return (
    <SplitView rail={rail ? <RouteRail active="reminders" tracker={ctx.tracker} onOpenTimers={() => router.push('/timers' as Href)} /> : undefined}>
      <RemindersScreen
        sections={sections}
        failed={failed}
        mine={mine}
        onMine={setMine}
        members={ctx.members}
        today={ctx.today}
        tz={tz}
        use24h={ctx.use24h}
        readOnly={!online}
        onToggle={(row, done) => void (done ? actions.untick(row.id, doneByKey.get(doneKey({ row }))) : actions.tick(row, 'list'))}
        onOpen={(row) => setDrawer({ row, source: 'list' })}
        onMore={(key) => {
          ctx.tracker.track('reminders_show_more', { section: key });
          void lists[key].fetchNextPage();
        }}
        // Casts: the typed routes file (.expo/types) is generated by `expo start`.
        onAdd={() => router.push('/reminders/new' as Href)}
        onBack={rail ? undefined : () => (router.canGoBack() ? router.back() : router.replace('/' as Href))}
      />
      {drawer ? <ReminderDrawerHost open={drawer} ctx={ctx} actions={actions} onClose={() => setDrawer(null)} /> : null}
    </SplitView>
  );
}
