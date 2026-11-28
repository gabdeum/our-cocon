import { useState } from 'react';
import { View } from 'react-native';
import { addDays, dateLabel, todayIn, type WeekStartsOn } from '@cocon/calendar';
import type { CompletedReminder, PlacedReminder, ReminderOccurrence } from '@cocon/data';
import type { ReminderSnoozeOption, Tracker } from '@cocon/schemas';
import { BottomSheet, Button, Callout, DateGrid, DayChip, Dialog, Link, MemberPill, NotesSection, Text } from '@cocon/ui';
import { firstOfMonth, weekdayLetters } from '../../lib/calendar-month';
import { dateGridMonth, shiftMonth } from '../../lib/event-form';
import { lateText, reminderMember, snoozeChoices, snoozedTitle, whenLine } from '../../lib/reminders';
import type { Member } from '../../lib/session';
import { strings } from '../../strings';
import { Notes } from '../shared/Notes';

const r = strings.reminders;

export interface ReminderDrawerProps {
  reminder: PlacedReminder;
  members: readonly Member[];
  /** Its closed occurrences, latest first, for the late callout (loading: none yet). */
  history?: readonly ReminderOccurrence[];
  today: string;
  tz: string;
  use24h: boolean;
  weekStartsOn: WeekStartsOn;
  now?: Date;
  /** Offline: nothing can change (decision 11). */
  readOnly?: boolean;
  tracker: Tracker;
  /** A link in the notes (spec 073); left out, the system browser. */
  onOpenUrl?: (url: string) => unknown;
  onClose: () => void;
  /** "Edit", or "+ Add a note" (`notes`). */
  onEdit: (focus?: 'notes') => void;
  onDone: () => Promise<CompletedReminder | null>;
  onUndoDone: () => Promise<boolean>;
  onSnooze: (option: ReminderSnoozeOption, picked?: string) => Promise<{ until: string; previous: string | null } | null>;
  onUndoSnooze: (previous: string | null) => Promise<boolean>;
  /** Deletes it (the whole series of a repeating one, confirmed here first). */
  onDelete: () => Promise<boolean>;
}

/** The snooze tiles, two to a row. */
function pairs<T>(items: readonly T[]): [T, ...T[]][] {
  const rows: [T, ...T[]][] = [];
  for (let i = 0; i < items.length; i += 2) rows.push(items.slice(i, i + 2) as [T, ...T[]]);
  return rows;
}

type Result = { kind: 'done'; next: string | null; repeating: boolean } | { kind: 'snoozed'; option: ReminderSnoozeOption; until: string; previous: string | null };

/**
 * OC-ReminderDrawer (spec 057 FR-005): who and when, how late, the notes, Snooze until, Mark as
 * done and Delete; after Done or a snooze, a green confirmation with Undo and Close.
 */
export function ReminderDrawer(p: ReminderDrawerProps) {
  const x = p.reminder;
  const o = { today: p.today, tz: p.tz, use24h: p.use24h };
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const who = reminderMember(x.assignee_id, p.members);
  const late = lateText(x, p.history ?? [], p.tz);
  const choices = snoozeChoices(x, { now: p.now ?? new Date(), tz: p.tz, use24h: p.use24h, style: 'drawer' });
  const off = p.readOnly || busy;

  const run = async <T,>(work: () => Promise<T>): Promise<T> => {
    setBusy(true);
    try {
      return await work();
    } finally {
      setBusy(false);
    }
  };
  const done = () =>
    run(async () => {
      const d = await p.onDone();
      if (d) setResult({ kind: 'done', next: d.nextDueAt, repeating: d.repeating });
    });
  const snooze = (option: ReminderSnoozeOption, picked?: string) =>
    run(async () => {
      const s = await p.onSnooze(option, picked);
      if (s) setResult({ kind: 'snoozed', option, ...s });
    });
  const undo = () =>
    run(async () => {
      if (!result) return;
      const ok = result.kind === 'done' ? await p.onUndoDone() : await p.onUndoSnooze(result.previous);
      if (ok) setResult(null);
    });
  const remove = () =>
    run(async () => {
      if (await p.onDelete()) p.onClose();
    });

  const grid = picking ? dateGridMonth(picking, addDays(p.today, 1), p.weekStartsOn, addDays(p.today, 1)) : null;
  const confirmation =
    result?.kind === 'done'
      ? { title: r.doneTitle, body: result.next ? r.nextOne(dateLabel(todayIn(p.tz, new Date(result.next)))) : result.repeating ? r.nextOnSchedule : null }
      : result
        ? { title: snoozedTitle(result.until, o), body: r.snoozedBody }
        : null;

  return (
    <BottomSheet visible onClose={p.onClose} title={x.title} closeLabel={r.close} headerAction={<Link label={r.edit} size={16} disabled={p.readOnly} onPress={() => p.onEdit()} />}>
      <View className="flex-row flex-wrap items-center gap-8">
        <MemberPill name={who.name} color={who.color} />
        <Text size={15} weight="700" color="ink-muted">
          {whenLine(x, o)}
        </Text>
      </View>

      {confirmation ? (
        <>
          <View role="status" className="gap-4 rounded-lg bg-sage p-16">
            <Text size={17} weight="900">
              {confirmation.title}
            </Text>
            {confirmation.body ? (
              <Text size={15} weight="700">
                {confirmation.body}
              </Text>
            ) : null}
          </View>
          <View className="flex-row gap-8">
            <Button variant="soft" size="pair" label={r.undo} className="flex-1" disabled={off} onPress={() => void undo()} />
            <Button variant="olive" size="pair" label={r.close} className="flex-1" onPress={p.onClose} />
          </View>
        </>
      ) : (
        <>
          {late ? (
            <View role="status">
              <Callout variant="warn" text={late} />
            </View>
          ) : null}

          {/* Spec 073: no card and no heading, the hairline alone sets the notes apart. */}
          <NotesSection label={r.notes}>
            {x.notes ? (
              <Notes notes={x.notes} entity="reminder" itemId={x.id} tracker={p.tracker} openUrl={p.onOpenUrl} />
            ) : (
              <Link label={r.addNote} disabled={p.readOnly} onPress={() => p.onEdit('notes')} />
            )}
          </NotesSection>

          <View className="gap-8">
            <Text size={16} weight="900" role="heading" aria-level={3}>
              {r.snoozeUntil}
            </Text>
            {pairs([...choices.map((c) => ({ key: c.option, label: c.label, detail: c.detail })), { key: 'date' as const, label: r.snooze.date, detail: r.calendar }]).map((row) => (
              <View key={row[0].key} className="flex-row gap-8">
                {row.map((c) => (
                  <DayChip
                    key={c.key}
                    align="start"
                    label={c.label}
                    sub={c.detail}
                    selected={false}
                    onPress={() => {
                      if (off) return;
                      if (c.key === 'date') setPicking(firstOfMonth(addDays(p.today, 1)));
                      else void snooze(c.key);
                    }}
                  />
                ))}
                {row.length === 1 ? <View className="flex-1" /> : null}
              </View>
            ))}
          </View>

          <Button variant="olive" icon="check" label={r.markAsDone} block disabled={off} onPress={() => void done()} />
          <Link
            label={r.delete}
            tone="danger"
            size={16}
            weight="900"
            className="self-center"
            disabled={off}
            onPress={() => {
              if (x.repeat_rule) setConfirm(true);
              else void remove();
            }}
          />
        </>
      )}

      {picking && grid ? (
        <BottomSheet visible onClose={() => setPicking(null)} title={r.pickDate} closeLabel={r.close}>
          <DateGrid
            title={grid.title}
            weekdays={weekdayLetters(p.weekStartsOn)}
            weeks={grid.weeks}
            selected={null}
            onSelect={(date) => {
              setPicking(null);
              void snooze('date', date);
            }}
            previous={{ label: r.previousMonth, onPress: () => setPicking(shiftMonth(picking, -1)) }}
            next={{ label: r.nextMonth, onPress: () => setPicking(shiftMonth(picking, 1)) }}
          />
        </BottomSheet>
      ) : null}

      <Dialog
        visible={confirm}
        title={r.deleteAllTitle}
        body={r.deleteAllBody(x.title)}
        confirmLabel={r.deleteConfirm}
        onConfirm={() => {
          setConfirm(false);
          void remove();
        }}
        cancelLabel={r.keep}
        onCancel={() => setConfirm(false)}
      />
    </BottomSheet>
  );
}
