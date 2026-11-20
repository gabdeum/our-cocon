import { View } from 'react-native';
import type { PlacedReminder } from '@cocon/data';
import { CalCard, ReminderRow, Text } from '@cocon/ui';
import { detailLine, homeFooterHint, lateBadge, reminderMember } from '../../lib/reminders';
import type { Member } from '../../lib/session';
import { strings } from '../../strings/en';

const r = strings.reminders;

export interface RemindersCardProps {
  /** Top 3 open (056 `reminders_home`), then the ones ticked here, struck through. */
  rows: readonly { row: PlacedReminder; done: boolean }[];
  moreToday: number;
  snoozed: number;
  members: readonly Member[];
  today: string;
  tz: string;
  use24h: boolean;
  /** Offline: nothing can change (decision 11). */
  readOnly?: boolean;
  onToggle: (row: PlacedReminder, done: boolean) => void;
  /** A row (all of it right of the dot): its drawer, with snooze, edit and delete (spec 058). */
  onOpen: (row: PlacedReminder) => void;
  onAdd: () => void;
  onSeeAll: () => void;
}

/**
 * OC-HomeReminders (spec 057 FR-001): the top 3 reminders, each opening its drawer (spec 058: no ⋮
 * menu, as the calendar's rows), and "See all reminders". Under the greeting, above the calendar card.
 */
export function RemindersCard(p: RemindersCardProps) {
  const hint = homeFooterHint(p.moreToday, p.snoozed);
  return (
    <CalCard
        label={r.title}
        header={
          <Text role="heading" aria-level={2} size={20} weight="900">
            {r.title}
          </Text>
        }
        addLabel={r.newReminder}
        onAdd={p.onAdd}
        addDisabled={p.readOnly}
        footer={{ label: r.seeAll, hint: hint || undefined, onPress: p.onSeeAll }}
      >
        {p.rows.length ? (
          <View>
            {p.rows.map(({ row, done }, i) => (
              <ReminderRow
                key={row.id}
                title={row.title}
                detail={done ? r.doneJustNow : detailLine(row, { today: p.today, tz: p.tz, use24h: p.use24h, where: 'home' })}
                member={reminderMember(row.assignee_id, p.members)}
                done={done}
                late={lateBadge(row) ?? undefined}
                onToggle={() => p.onToggle(row, done)}
                toggleLabel={done ? r.markNotDone(row.title) : r.markDone(row.title)}
                disabled={p.readOnly}
                last={i === p.rows.length - 1}
                size="sm"
                onOpen={done ? undefined : () => p.onOpen(row)}
                openLabel={r.open(row.title)}
              />
            ))}
          </View>
        ) : null}
    </CalCard>
  );
}
