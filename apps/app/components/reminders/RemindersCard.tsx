import { useState } from 'react';
import { View } from 'react-native';
import type { PlacedReminder } from '@cocon/data';
import type { ReminderSnoozeOption } from '@cocon/schemas';
import { ActionMenu, CalCard, Dialog, ReminderRow, Text } from '@cocon/ui';
import { detailLine, homeFooterHint, lateBadge, reminderMember, snoozeChoices } from '../../lib/reminders';
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
  now?: Date;
  /** Offline: nothing can change (decision 11). */
  readOnly?: boolean;
  onToggle: (row: PlacedReminder, done: boolean) => void;
  onSnooze: (row: PlacedReminder, option: Exclude<ReminderSnoozeOption, 'date'>) => void;
  /** "Pick a date…": the drawer. */
  onPickDate: (row: PlacedReminder) => void;
  onEdit: (row: PlacedReminder) => void;
  onDelete: (row: PlacedReminder) => void;
  onAdd: () => void;
  onSeeAll: () => void;
}

/**
 * OC-HomeReminders (spec 057 FR-001, FR-002): the top 3 reminders, a ⋮ menu each (snooze, pick a
 * date, edit, delete), and "See all reminders". Under the greeting, above the calendar card.
 */
export function RemindersCard(p: RemindersCardProps) {
  const [deleting, setDeleting] = useState<PlacedReminder | null>(null);
  const hint = homeFooterHint(p.moreToday, p.snoozed);
  return (
    <>
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
                trailing={
                  done ? undefined : (
                    <ActionMenu
                      trigger="dots"
                      label={r.moreOptions(row.title)}
                      heading={r.snoozeUntil}
                      disabled={p.readOnly}
                      closeLabel={r.close}
                      items={[
                        ...snoozeChoices(row, { now: p.now ?? new Date(), tz: p.tz, use24h: p.use24h, style: 'menu' }).map((c) => ({ label: c.label, detail: c.detail, onPress: () => p.onSnooze(row, c.option) })),
                        { label: r.pickADate, onPress: () => p.onPickDate(row) },
                        { label: r.edit, onPress: () => p.onEdit(row), separatorBefore: true },
                        { label: r.delete, tone: 'danger' as const, onPress: () => (row.repeat_rule ? setDeleting(row) : p.onDelete(row)) },
                      ]}
                    />
                  )
                }
              />
            ))}
          </View>
        ) : null}
      </CalCard>
      <Dialog
        visible={deleting !== null}
        title={r.deleteAllTitle}
        body={r.deleteAllBody(deleting?.title ?? '')}
        confirmLabel={r.deleteConfirm}
        onConfirm={() => {
          if (deleting) p.onDelete(deleting);
          setDeleting(null);
        }}
        cancelLabel={r.keep}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}
