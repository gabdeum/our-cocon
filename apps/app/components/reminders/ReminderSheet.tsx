import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { addDays, formatTime, weekday, type WeekStartsOn } from '@cocon/calendar';
import type { ReminderDraft } from '@cocon/schemas';
import { BottomSheet, Button, Choice, DateGrid, DayChip, FieldWarning, Icon, Link, MemberPickerChip, PillRow, Switch, Text, TextField, TimeField } from '@cocon/ui';
import { firstOfMonth, weekdayLetters } from '../../lib/calendar-month';
import { dateGridMonth, dayTiles, endsProblem, shiftMonth, type RepeatChoice } from '../../lib/event-form';
import { useOnline } from '../../lib/online';
import { forChips, formRollover, formToDraft, isClockTime, notifySummary, REPEAT_CHOICES, rolloverChoices, type ReminderForm } from '../../lib/reminders';
import type { Member } from '../../lib/session';
import { useToast } from '../../lib/toast';
import { strings } from '../../strings/en';
import { RepeatDetails } from '../calendar/RepeatDetails';

const r = strings.reminders;
const a = strings.calendar.add;
/** Custom offers the event sheet's repeats (spec 041). */
const CUSTOM_REPEATS: Exclude<RepeatChoice, 'never'>[] = ['daily', 'weekly', 'biweekly', 'monthly', 'yearly'];

export interface ReminderSheetProps {
  mode: 'new' | 'edit';
  initial: ReminderForm;
  members: readonly Member[];
  today: string;
  use24h: boolean;
  weekStartsOn: WeekStartsOn;
  /** "+ Add a note" from the drawer: the notes field takes focus. */
  focusNotes?: boolean;
  /** Throws when it couldn't save: the sheet stays open, as typed. */
  onSave: (draft: ReminderDraft) => Promise<void>;
  onClose: () => void;
  /** Edit only: "Delete reminder" (the screen confirms a repeating one). */
  onDelete?: () => void;
}

type DateSheet = { for: 'due' | 'ends'; month: string } | null;

/**
 * OC-ReminderEdit (spec 057 FR-006): what, when it's due, a time, what happens if it's not done,
 * the repeat, who it's for, notes, and what notifications that means. The same sheet edits one.
 */
export function ReminderSheet(p: ReminderSheetProps) {
  const online = useOnline();
  const toast = useToast();
  const [f, setF] = useState<ReminderForm>(p.initial);
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dateSheet, setDateSheet] = useState<DateSheet>(null);
  const set = (patch: Partial<ReminderForm>) => setF((prev) => ({ ...prev, ...patch }));

  const hasTitle = f.title.trim().length > 0;
  const badTime = f.hasTime && !isClockTime(f.time);
  const custom = { ...f.custom, date: f.date };
  const badEnds = f.repeat === 'custom' && endsProblem(custom);
  const tiles = dayTiles(p.today, f.date);
  const roll = formRollover(f);

  const save = async () => {
    setTried(true);
    if (!hasTitle || badTime || badEnds || saving) return;
    setSaving(true);
    try {
      await p.onSave(formToDraft(f));
    } catch {
      toast.show({ text: r.saveFailed, tone: 'warn' });
      setSaving(false);
    }
  };

  const grid = dateSheet ? dateGridMonth(dateSheet.month, p.today, p.weekStartsOn, dateSheet.for === 'ends' ? f.date : undefined) : null;

  return (
    <BottomSheet
      visible
      fieldFocus={p.mode === 'new'}
      onClose={p.onClose}
      dirty={hasTitle && p.mode === 'new'}
      title={p.mode === 'new' ? r.sheetNew : r.sheetEdit}
      closeLabel={r.close}
      headerAction={<Link label={r.cancel} tone="quiet" size={16} onPress={p.onClose} />}
      footer={
        <View className="gap-12">
          <Button variant="olive" label={r.save} busy={saving} busyLabel={r.saving} block inactive={!hasTitle} disabled={!online} onPress={() => void save()} />
          {p.onDelete ? <Link label={r.delete} tone="danger" size={16} weight="900" className="self-center" disabled={!online} onPress={p.onDelete} /> : null}
        </View>
      }
    >
      <TextField
        label={r.what}
        size="title"
        value={f.title}
        onChangeText={(title) => set({ title })}
        maxLength={80}
        placeholder={r.whatPlaceholder}
        autoFocus={p.mode === 'new' && !p.focusNotes}
        warning={tried && !hasTitle ? r.noTitle : undefined}
      />

      <Section title={r.due}>
        <View className="flex-row gap-8">
          <DayChip label={r.today} sub={tiles.today} selected={tiles.picked === 'today'} onPress={() => set({ date: p.today })} />
          <DayChip label={r.tomorrow} sub={tiles.tomorrow} selected={tiles.picked === 'tomorrow'} onPress={() => set({ date: addDays(p.today, 1) })} />
          <DayChip label={r.otherDay} sub={tiles.other} selected={tiles.picked === 'other'} onPress={() => setDateSheet({ for: 'due', month: firstOfMonth(f.date) })} />
        </View>
        <View className="min-h-control-lg flex-row items-center gap-10 rounded-lg bg-surface-card py-6 pl-16 pr-8">
          <Text size={16} weight="800" className="flex-1" aria-hidden>
            {r.setTime}
          </Text>
          {f.hasTime ? <TimeField label={r.time} value={f.time} onChange={(time) => set({ time })} use24h={p.use24h} format={(t) => formatTime(t, p.use24h)} invalid={tried && badTime} /> : null}
          <Switch label={r.setTime} value={f.hasTime} onValueChange={(hasTime) => set({ hasTime })} />
        </View>
        {tried && badTime ? <FieldWarning text={r.badTime} /> : null}
      </Section>

      <Section title={r.ifNotDone}>
        <View role="group" aria-label={r.ifNotDone}>
          <PillRow>
            {rolloverChoices(f.hasTime).map((k) => (
              <Choice key={k} label={r.rollovers[k]} selected={roll === k} onPress={() => set({ rollover: k })} />
            ))}
          </PillRow>
        </View>
        <Text size={14} weight="600" color="ink-muted">
          {r.rolloverHints[roll]}
        </Text>
      </Section>

      <Section title={r.repeat}>
        <View role="group" aria-label={r.repeat}>
          <PillRow>
            {REPEAT_CHOICES.map((k) => (
              <Choice key={k} label={r.repeatChoices[k]} selected={f.repeat === k} onPress={() => set({ repeat: k })} />
            ))}
          </PillRow>
        </View>
        {f.repeat === 'custom' ? (
          <>
            <PillRow>
              {CUSTOM_REPEATS.map((k) => (
                <Choice
                  key={k}
                  label={a.repeats[k]}
                  selected={f.custom.repeat === k}
                  // Weekly shows the day it repeats on: the due day until others are picked.
                  onPress={() => set({ custom: { ...f.custom, repeat: k, weekdays: k === 'weekly' && f.custom.weekdays.length === 0 ? [weekday(f.date)] : f.custom.weekdays } })}
                />
              ))}
            </PillRow>
            <RepeatDetails
              d={custom}
              set={(patch) => set({ custom: { ...f.custom, ...patch } })}
              tried={tried}
              onPickEnd={() => setDateSheet({ for: 'ends', month: firstOfMonth(f.custom.ends.type === 'on' ? f.custom.ends.date : f.date) })}
            />
          </>
        ) : null}
      </Section>

      <Section title={r.for}>
        <View role="group" aria-label={r.for} className="flex-row flex-wrap gap-8">
          {forChips(p.members).map((c) => (
            <MemberPickerChip key={c.key} name={c.name} initial={c.initial} color={c.color} selected={f.assignee === c.key} onPress={() => set({ assignee: c.key })} />
          ))}
        </View>
      </Section>

      <TextField
        label={r.notesLabel}
        optionalLabel={r.optional}
        value={f.notes}
        onChangeText={(notes) => set({ notes })}
        maxLength={1000}
        placeholder={r.notesPlaceholder}
        multiline
        autoFocus={p.focusNotes}
      />

      <View className="flex-row items-start gap-12 rounded-lg bg-surface-soft px-14 py-12">
        <Icon name="bell" size={22} color="ink" />
        <Text size={15} weight="700" className="flex-1">
          {notifySummary(f, p.members, p.use24h)}
        </Text>
      </View>

      {dateSheet && grid ? (
        <BottomSheet visible onClose={() => setDateSheet(null)} title={dateSheet.for === 'due' ? r.pickDate : a.endsOnTitle} closeLabel={r.close}>
          <DateGrid
            title={grid.title}
            weekdays={weekdayLetters(p.weekStartsOn)}
            weeks={grid.weeks}
            selected={dateSheet.for === 'due' ? f.date : f.custom.ends.type === 'on' ? f.custom.ends.date : null}
            onSelect={(date) => {
              if (dateSheet.for === 'due') set({ date });
              else set({ custom: { ...f.custom, ends: { type: 'on', date } } });
              setDateSheet(null);
            }}
            previous={{ label: r.previousMonth, onPress: () => setDateSheet({ ...dateSheet, month: shiftMonth(dateSheet.month, -1) }) }}
            next={{ label: r.nextMonth, onPress: () => setDateSheet({ ...dateSheet, month: shiftMonth(dateSheet.month, 1) }) }}
          />
        </BottomSheet>
      ) : null}
    </BottomSheet>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="gap-8">
      <Text size={16} weight="900" role="heading" aria-level={3}>
        {title}
      </Text>
      {children}
    </View>
  );
}
