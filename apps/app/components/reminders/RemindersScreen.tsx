import { View } from 'react-native';
import type { PlacedReminder } from '@cocon/data';
import { Button, IconButton, PushedScreen, ReminderMore, ReminderRow, SegmentedControl, TabHeader, Text } from '@cocon/ui';
import { LIST_SECTIONS, detailLine, lateBadge, reminderMember } from '../../lib/reminders';
import type { Member } from '../../lib/session';
import { strings } from '../../strings/en';

const r = strings.reminders;

export interface ScreenSection {
  key: (typeof LIST_SECTIONS)[number];
  /** "Overdue", "Today · Wed, Nov 11". */
  label: string;
  /** `detail` replaces the row's own ("Done at 15:20"); `locked`: done, and can't be unticked any more. */
  rows: readonly { row: PlacedReminder; done: boolean; detail?: string; locked?: boolean }[];
  /** A next page exists (056 `next_cursor`). */
  canMore: boolean;
  loadingMore?: boolean;
}

export interface RemindersScreenProps {
  /** A list couldn't load (the route shows the toast): no "Loading" line meanwhile. */
  failed?: boolean;
  /** Overdue, Today, Tomorrow, Later: only those with rows (snoozed ones on the day they're back). Undefined while loading. */
  sections?: readonly ScreenSection[];
  /** Null until the remembered filter is read. */
  mine: boolean | null;
  onMine: (mine: boolean) => void;
  members: readonly Member[];
  today: string;
  tz: string;
  use24h: boolean;
  /** Offline: ticks and "+" are off (decision 11). */
  readOnly?: boolean;
  onToggle: (row: PlacedReminder, done: boolean) => void;
  onOpen: (row: PlacedReminder) => void;
  onMore: (section: (typeof LIST_SECTIONS)[number]) => void;
  onAdd: () => void;
  /** Left out beside the rail from 960, which is the way out there. */
  onBack?: () => void;
}

/**
 * OC-Reminders (spec 057 FR-003, FR-004): Mine · Everyone's, then Overdue, Today, Tomorrow and
 * Later, each a card with "Show more", and the olive "+". Spec 058: snoozed ones are in the section
 * of the day they're back, with a "Snoozed" pill (no Snoozed row any more).
 */
export function RemindersScreen(p: RemindersScreenProps) {
  const o = { today: p.today, tz: p.tz, use24h: p.use24h, where: 'list' as const };
  const row = (x: PlacedReminder, done: boolean, last: boolean, detail?: string, locked = false) => (
    <ReminderRow
      key={`${x.id}|${x.due_at}|${done}`}
      title={x.title}
      detail={detail ?? (done ? r.doneJustNow : detailLine(x, o))}
      member={reminderMember(x.assignee_id, p.members)}
      done={done}
      late={lateBadge(x) ?? undefined}
      snoozed={x.snoozed ? r.snoozedPill : undefined}
      repeats={x.repeat_rule ? r.repeats : undefined}
      notes={x.notes ? r.hasNotes : undefined}
      onToggle={() => p.onToggle(x, done)}
      toggleLabel={done ? r.markNotDone(x.title) : r.markDone(x.title)}
      disabled={p.readOnly || locked}
      onOpen={done ? undefined : () => p.onOpen(x)}
      openLabel={r.open(x.title)}
      last={last}
    />
  );
  const loaded = p.sections !== undefined;
  const empty = loaded && p.sections?.length === 0;

  return (
    <View className="flex-1 bg-surface-page">
      {/* Beside the rail (no back) it is titled like a tab. */}
      <PushedScreen className="gap-16" topBar={p.onBack ? { back: { label: r.back, onPress: p.onBack }, title: r.title } : undefined}>
        {p.onBack ? null : <TabHeader title={r.title} />}
        <SegmentedControl
          label={r.show}
          variant="light"
          segments={[
            { key: 'mine', label: r.mine },
            { key: 'everyone', label: r.everyones },
          ]}
          value={p.mine ? 'mine' : 'everyone'}
          onChange={(to: 'mine' | 'everyone') => p.onMine(to === 'mine')}
        />

        {!loaded && !p.failed ? (
          <Text size={15} weight="700" color="ink-muted" aria-busy>
            {r.loading}
          </Text>
        ) : null}

        {(p.sections ?? []).map((s) => (
          <View key={s.key} role="region" aria-label={s.label} className="gap-8">
            <Text size={18} weight="900" role="heading" aria-level={2} color={s.key === 'overdue' ? 'warn' : 'ink'}>
              {s.label}
            </Text>
            <View className="rounded-xl bg-surface-card px-14">
              {s.rows.map((x, i) => row(x.row, x.done, i === s.rows.length - 1 && !s.canMore, x.detail, x.locked))}
              {s.canMore ? (
                <ReminderMore label={r.showMore} busy={s.loadingMore} onPress={() => p.onMore(s.key)} />
              ) : null}
            </View>
          </View>
        ))}


        {empty ? (
          <View className="items-center gap-14 py-28">
            <Text size={17} weight="900" align="center">
              {r.emptyTitle}
            </Text>
            <Button variant="ink" size="md" label={r.newReminder} disabled={p.readOnly} onPress={p.onAdd} />
          </View>
        ) : null}
        {/* Room for the "+" over the last row. */}
        <View aria-hidden className="h-control-xl" />
      </PushedScreen>
      <IconButton variant="fab" icon="plus" iconSize={28} label={r.newReminder} disabled={p.readOnly} onPress={p.onAdd} className="absolute bottom-28 right-20 z-20" />
    </View>
  );
}
