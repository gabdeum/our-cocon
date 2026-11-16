import { View } from 'react-native';
import type { PlacedReminder } from '@cocon/data';
import type { ReminderSection } from '@cocon/schemas';
import { Button, Card, DisclosureButton, IconButton, PushedScreen, ReminderMore, ReminderRow, SegmentedControl, Text } from '@cocon/ui';
import { detailLine, lateBadge, reminderMember } from '../../lib/reminders';
import type { Member } from '../../lib/session';
import { strings } from '../../strings/en';

const r = strings.reminders;

export interface ScreenSection {
  key: ReminderSection;
  /** "Overdue", "Today · Wed, Nov 11". */
  label: string;
  rows: readonly { row: PlacedReminder; done: boolean }[];
  /** A next page exists (056 `next_cursor`). */
  canMore: boolean;
  loadingMore?: boolean;
}

export interface RemindersScreenProps {
  /** A list couldn't load (the route shows the toast): no "Loading" line meanwhile. */
  failed?: boolean;
  /** Overdue, Today, Tomorrow, Later: only those with rows. Undefined while loading. */
  sections?: readonly ScreenSection[];
  /** The Snoozed row: its rows (first page) and whether there are more. */
  snoozed?: { rows: readonly PlacedReminder[]; canMore: boolean };
  snoozedOpen: boolean;
  onToggleSnoozed: () => void;
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
  onMore: (section: ReminderSection) => void;
  onAdd: () => void;
  onBack: () => void;
}

/**
 * OC-Reminders (spec 057 FR-003, FR-004): Mine · Everyone's, then Overdue, Today, Tomorrow and
 * Later, each a card with "Show more", the Snoozed row, and the olive "+".
 */
export function RemindersScreen(p: RemindersScreenProps) {
  const o = { today: p.today, tz: p.tz, use24h: p.use24h, where: 'list' as const };
  const row = (x: PlacedReminder, done: boolean, last: boolean, snoozed = false) => (
    <ReminderRow
      key={x.id}
      title={x.title}
      detail={done ? r.doneJustNow : detailLine(x, o)}
      member={reminderMember(x.assignee_id, p.members)}
      done={done}
      late={snoozed ? undefined : (lateBadge(x) ?? undefined)}
      repeats={x.repeat_rule ? r.repeats : undefined}
      notes={x.notes ? r.hasNotes : undefined}
      onToggle={snoozed ? undefined : () => p.onToggle(x, done)}
      toggleLabel={done ? r.markNotDone(x.title) : r.markDone(x.title)}
      disabled={p.readOnly}
      onOpen={() => p.onOpen(x)}
      openLabel={r.open(x.title)}
      more={snoozed ? undefined : { label: r.open(x.title), onPress: () => p.onOpen(x) }}
      last={last}
    />
  );
  const loaded = p.sections !== undefined && p.snoozed !== undefined;
  const snoozedCount = p.snoozed?.rows.length ?? 0;
  const empty = loaded && p.sections?.length === 0 && snoozedCount === 0;

  return (
    <View className="flex-1 bg-surface-page">
      <PushedScreen className="gap-16" topBar={{ back: { label: r.back, onPress: p.onBack }, title: r.title }}>
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
            <Card className="px-14 py-2">
              {s.rows.map((x, i) => row(x.row, x.done, i === s.rows.length - 1 && !s.canMore))}
              {s.canMore ? (
                <ReminderMore label={r.showMore} busy={s.loadingMore} onPress={() => p.onMore(s.key)} />
              ) : null}
            </Card>
          </View>
        ))}

        {snoozedCount > 0 ? (
          <>
            <DisclosureButton label={r.snoozed} sub={p.snoozedOpen ? r.hide : r.hiddenUntilLater(snoozedCount, p.snoozed?.canMore ?? false)} expanded={p.snoozedOpen} onPress={p.onToggleSnoozed} />
            {p.snoozedOpen ? <Card className="px-14 py-2">{(p.snoozed?.rows ?? []).map((x, i) => row(x, false, i === snoozedCount - 1, true))}</Card> : null}
          </>
        ) : null}

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
