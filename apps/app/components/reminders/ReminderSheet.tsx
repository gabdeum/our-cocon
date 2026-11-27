import { useRef, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { addDays, formatTime, weekday, type WeekStartsOn } from '@cocon/calendar';
import { loadReminder, suggestReminderTitles, type Db, type ReminderTitleSuggestion } from '@cocon/data';
import { type ReminderDraft, type Tracker } from '@cocon/schemas';
import { BottomSheet, type BottomSheetProps, Button, Choice, DateGrid, DayChip, FieldWarning, Icon, Link, MemberPickerChip, PillRow, RowScroll, SuggestionPill, Switch, Text, TextField, TimeField, useSheetPresentation } from '@cocon/ui';
import { firstOfMonth, weekdayLetters } from '../../lib/calendar-month';
import { dateGridMonth, dayTiles, endsProblem, shiftMonth, type RepeatChoice } from '../../lib/event-form';
import { useOnline } from '../../lib/online';
import { forChips, formRollover, formToDraft, isClockTime, notifySummary, reminderFromSuggestion, REPEAT_CHOICES, rolloverChoices, suggestionTimeOf, type FamilyQuietHours, type ReminderForm } from '../../lib/reminders';
import type { Member } from '../../lib/session';
import { useToast } from '../../lib/toast';
import { useTitleSuggestions } from '../../lib/use-title-suggestions';
import { strings } from '../../strings/en';
import { RepeatDetails } from '../calendar/RepeatDetails';
import { NotesField } from '../shared/NotesField';

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
  /** Each person's quiet hours and clock (spec 059): the notification line uses the recipient's. */
  quietHours?: FamilyQuietHours;
  /** "+ Add a note" from the drawer: the notes field takes focus. */
  focusNotes?: boolean;
  /** Throws when it couldn't save: the sheet stays open, as typed. */
  onSave: (draft: ReminderDraft) => Promise<void>;
  onClose: () => void;
  /** Edit only: "Delete reminder" (the screen confirms a repeating one). */
  onDelete?: () => void;
  /** For the notes toolbar's `note_format_applied` (spec 074). */
  tracker?: Tracker;
  /** Past titles while typing a new one (as the event sheet's): left out, none are offered. */
  suggest?: { client: Pick<Db, 'from' | 'rpc'>; tz: string; tracker: Tracker };
}

type DateSheet = { for: 'due' | 'ends'; month: string } | null;

/**
 * OC-ReminderEdit (spec 057 FR-006): what, when it's due, a time, what happens if it's not done,
 * the repeat, who it's for, notes, and what notifications that means. The same sheet edits one.
 * Returns the sheet's props, the form and `patch`, so the calendar's add sheet can switch to it.
 */
export function useReminderForm(p: ReminderSheetProps) {
  const online = useOnline();
  const toast = useToast();
  const [f, setF] = useState<ReminderForm>(p.initial);
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dateSheet, setDateSheet] = useState<DateSheet>(null);
  const presentation = useSheetPresentation('flow');
  // What the person changed by hand, which a picked suggestion doesn't overwrite.
  const touched = useRef(new Set<keyof ReminderForm>());
  const set = (patch: Partial<ReminderForm>) => {
    for (const key of Object.keys(patch) as (keyof ReminderForm)[]) touched.current.add(key);
    setF((prev) => ({ ...prev, ...patch }));
  };

  const s = p.suggest;
  const titles = useTitleSuggestions(p.mode === 'new' && !!s, f.title, (text) => (s ? suggestReminderTitles(s.client, text) : Promise.resolve([])));
  const pickSuggestion = async (picked: ReminderTitleSuggestion, position: number) => {
    if (!s) return;
    titles.dismiss();
    setF((prev) => ({ ...prev, title: picked.title }));
    s.tracker.track('reminder_title_suggestion_picked', { position, query_length: Math.min(Math.max(f.title.trim().length, 1), 80) });
    const stored = await loadReminder(s.client, picked.lastReminderId).catch(() => null);
    if (stored) setF((prev) => reminderFromSuggestion(prev, stored, s.tz, touched.current));
  };

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

  const sheet: BottomSheetProps = {
    visible: true,
    fieldFocus: p.mode === 'new',
    onClose: p.onClose,
    dirty: hasTitle && p.mode === 'new',
    title: p.mode === 'new' ? r.sheetNew : r.sheetEdit,
    closeLabel: r.close,
    // The centred card from 600 has its ✕ (spec 065): no Cancel beside it (Gabriel).
    headerAction: presentation === 'card' ? undefined : <Link label={r.cancel} tone="quiet" size={16} onPress={p.onClose} />,
    footer: (
      <View className="gap-12">
        <Button variant="olive" label={r.save} busy={saving} busyLabel={r.saving} block inactive={!hasTitle} disabled={!online} onPress={() => void save()} />
        {p.onDelete ? <Link label={r.delete} tone="danger" size={16} weight="900" className="self-center" disabled={!online} onPress={p.onDelete} /> : null}
      </View>
    ),
    children: (
      <>
        <TextField
          label={r.what}
          size="title"
          value={f.title}
          onChangeText={(title) => set({ title })}
          maxLength={80}
          placeholder={r.whatPlaceholder}
          autoFocus={p.mode === 'new' && !p.focusNotes}
          warning={tried && !hasTitle ? r.noTitle : undefined}
          onFocus={titles.onFocus}
          onBlur={titles.onBlur}
        />
        {titles.shown.length ? (
          <RowScroll keyboardShouldPersistTaps="handled" role="list" aria-label={a.suggestions} className="-mx-20 -mt-8" contentContainerClassName="gap-8 px-20">
            {titles.shown.map((t, i) => (
              <SuggestionPill key={t.lastReminderId} title={t.title} detail={s ? suggestionTimeOf(t, s.tz, p.use24h) : undefined} onPress={() => void pickSuggestion(t, i + 1)} />
            ))}
          </RowScroll>
        ) : null}

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

        <NotesField
          label={r.notesLabel}
          optionalLabel={r.optional}
          value={f.notes}
          onChange={(notes) => set({ notes })}
          placeholder={r.notesPlaceholder}
          entity="reminder"
          tracker={p.tracker}
          autoFocus={p.focusNotes}
        />

        <View className="flex-row items-start gap-12 rounded-lg bg-surface-soft px-14 py-12">
          <Icon name="bell" size={22} color="ink" />
          <Text size={15} weight="700" className="flex-1">
            {notifySummary(f, p.members, p.use24h, p.quietHours)}
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
      </>
    ),
  };
  return { sheet, form: f, patch: set };
}

/** The new or edit sheet on its own. */
export function ReminderSheet(p: ReminderSheetProps) {
  return <BottomSheet {...useReminderForm(p).sheet} />;
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
