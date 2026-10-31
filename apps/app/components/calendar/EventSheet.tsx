import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { addDays, dateLabel, weekday, type SlotTimes, type WeekStartsOn } from '@cocon/calendar';
import { loadEvents, type Db, type StoredEvent } from '@cocon/data';
import { EVENT_CATEGORIES, type EventInput, type Reminder, type Visibility } from '@cocon/schemas/calendar';
import type { Tracker } from '@cocon/schemas';
import {
  BottomSheet,
  Button,
  Callout,
  ChecklistAdd,
  ChecklistRow,
  Choice,
  DateGrid,
  DayChip,
  DisclosureButton,
  FieldWarning,
  Link,
  MemberPickerChip,
  PickerField,
  PillRow,
  SegmentedControl,
  SlotChip,
  Text,
  TextField,
  WeekdayPicker,
} from '@cocon/ui';
import { firstOfMonth, eventWindow, weekdayLetters } from '../../lib/calendar-month';
import { eventsKey } from '../../lib/calendar-header';
import {
  conflictLine,
  dateGridMonth,
  dayTiles,
  endsProblem,
  hasMoreOptions,
  hiddenNames,
  isChipOn,
  managedOn,
  shiftMonth,
  surpriseHiddenFrom,
  slotChips,
  surpriseProblems,
  takers,
  timeProblems,
  toInput,
  shownTimes,
  toggleSlot,
  toggleWho,
  typeTime,
  whoChips,
  type EndsChoice,
  type EventDraft,
  type RepeatChoice,
} from '../../lib/event-form';
import { useOnline } from '../../lib/online';
import type { Member } from '../../lib/session';
import { strings } from '../../strings/en';

const a = strings.calendar.add;
const REPEATS: RepeatChoice[] = ['never', 'daily', 'weekly', 'biweekly', 'monthly', 'yearly'];
const REMINDERS: Reminder[] = ['none', 'morning_of', 'hour_before', 'day_before'];
const VISIBILITIES: Visibility[] = ['family', 'private', 'surprise'];
const MAX_CHECKLIST = 50;

export interface SaveMeta {
  usedMoreOptions: boolean;
  secondsToSave: number;
}

export interface EventSheetProps {
  mode: 'new' | 'edit';
  initial: EventDraft;
  /** An edit of one occurrence ("This event only"): repeat, reminder and the checklist belong to the series. */
  occurrenceOnly?: boolean;
  /** The event being edited, so it doesn't conflict with itself. */
  editingId?: string;
  /** "Who can see it?" is only for the event's creator (spec 043 FR-005); a new event is yours. */
  canChangeVisibility?: boolean;
  /** Who made the event (a new one is mine): a surprise is kept from everyone else in Who. */
  creatorMemberId?: string;
  client: Pick<Db, 'from'>;
  familyId: string;
  members: readonly Member[];
  myMemberId: string;
  today: string;
  slotTimes: SlotTimes;
  weekStartsOn: WeekStartsOn;
  tracker: Tracker;
  /** Throws when it couldn't save: the sheet stays open and says so. */
  onSave: (input: EventInput, meta: SaveMeta) => Promise<void>;
  onClose: () => void;
}

type DateSheet = { for: 'date' | 'ends'; month: string } | null;

/**
 * OC-CalAdd / OC-CalAddMore (spec 041): add an event in about three taps, more options folded
 * away; the same sheet edits one. Never blocks on a conflict; Save explains what's missing.
 */
export function EventSheet(p: EventSheetProps) {
  const { initial, members, myMemberId, today, slotTimes } = p;
  const online = useOnline();
  const opened = useRef(0);
  useEffect(() => {
    opened.current = Date.now();
  }, []);
  const [d, setD] = useState<EventDraft>(initial);
  const [more, setMore] = useState(p.mode === 'edit' && hasMoreOptions(initial));
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [dateSheet, setDateSheet] = useState<DateSheet>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const conflictSeen = useRef(false);
  const set = (patch: Partial<EventDraft>) => setD((prev) => ({ ...prev, ...patch }));

  // The draft's days, from the same query the calendar uses for that month (spec 035's sync keeps it live).
  const w = eventWindow(firstOfMonth(d.date));
  const events = useQuery({ queryKey: eventsKey(p.familyId, w.from, w.to), queryFn: () => loadEvents(p.client, w.from, w.to), placeholderData: (prev) => prev });
  const conflict = useMemo(
    () => conflictLine(d, events.data ?? ([] as StoredEvent[]), members, myMemberId, slotTimes, p.editingId),
    [d, events.data, members, myMemberId, slotTimes, p.editingId],
  );
  useEffect(() => {
    if (conflict) conflictSeen.current = true;
  }, [conflict]);

  const hasTitle = d.title.trim().length > 0;
  const times = timeProblems(d.time);
  const shown = shownTimes(d.time, slotTimes);
  const noOne = d.who.length === 0;
  const tiles = dayTiles(today, d.date);
  const managed = managedOn(d.who, members);
  const showError = tried && !hasTitle;
  // A surprise is kept from the people in Who (decided 2026-10-29), so there's nobody to pick twice.
  const creatorId = p.creatorMemberId ?? myMemberId;
  const canChange = p.canChangeVisibility ?? true;
  const surprise = useMemo(
    () => surpriseHiddenFrom(d, initial, members, creatorId, { canChange, occurrence: !!p.occurrenceOnly }),
    [d, initial, members, creatorId, canChange, p.occurrenceOnly],
  );
  const out = useMemo<EventDraft>(() => ({ ...d, hiddenFrom: surprise.hiddenFrom }), [d, surprise.hiddenFrom]);
  // The one editing already sees it in full (they could be added when the creator has left).
  const revealed = hiddenNames(surprise.revealed.filter((id) => id !== myMemberId), members);
  const secret = surpriseProblems(out, members);
  const hidden = hiddenNames(out.hiddenFrom, members);
  const showVisibility = (p.canChangeVisibility ?? true) && !p.occurrenceOnly;

  const close = () => {
    if (conflictSeen.current) p.tracker.track('event_conflict_shown', { proceeded: false });
    p.onClose();
  };

  const save = async () => {
    setTried(true);
    if (!hasTitle || noOne || Object.keys(times).length || endsProblem(d) || Object.keys(secret).length || revealed.length || saving) return;
    setSaving(true);
    setFailed(false);
    try {
      await p.onSave(toInput(out, members, { occurrence: p.occurrenceOnly }), { usedMoreOptions: more || p.mode === 'edit', secondsToSave: Math.round((Date.now() - opened.current) / 1000) });
      if (conflictSeen.current) p.tracker.track('event_conflict_shown', { proceeded: conflict !== null });
      if (d.visibility !== initial.visibility) p.tracker.track('event_visibility_set', { visibility: d.visibility });
    } catch {
      setFailed(true);
      setSaving(false);
    }
  };

  const addItem = () => {
    const label = adding?.trim();
    if (label && d.checklist.length < MAX_CHECKLIST) set({ checklist: [...d.checklist, { label: label.slice(0, 80) }] });
    setAdding('');
  };

  const pickDay = (choice: 'today' | 'tomorrow' | 'other') => {
    if (choice === 'other') setDateSheet({ for: 'date', month: firstOfMonth(d.date) });
    else set({ date: choice === 'today' ? today : addDays(today, 1) });
  };

  const grid = dateSheet ? dateGridMonth(dateSheet.month, today, p.weekStartsOn, dateSheet.for === 'ends' ? d.date : undefined) : null;

  return (
    <BottomSheet
      visible
      fieldFocus={p.mode === 'new'}
      onClose={close}
      dirty={hasTitle && p.mode === 'new'}
      title={p.mode === 'new' ? a.titleNew : a.titleEdit}
      closeLabel={a.close}
      headerAction={<Link label={a.cancel} tone="quiet" size={16} onPress={close} />}
      footer={
        <View className="gap-12">
          {failed ? <Callout variant="warn" text={a.saveFailed} /> : null}
          <Button label={a.save} busy={saving} busyLabel={a.saving} block inactive={!hasTitle} disabled={!online} onPress={() => void save()} />
        </View>
      }
    >
      <TextField
        label={a.what}
        size="title"
        value={d.title}
        onChangeText={(title) => set({ title })}
        maxLength={60}
        placeholder={a.whatPlaceholder}
        autoFocus={p.mode === 'new'}
        warning={showError ? a.noTitle : undefined}
      />

      <Section title={a.when}>
        <View className="flex-row gap-8">
          <DayChip label={a.today} sub={tiles.today} selected={tiles.picked === 'today'} onPress={() => pickDay('today')} />
          <DayChip label={a.tomorrow} sub={tiles.tomorrow} selected={tiles.picked === 'tomorrow'} onPress={() => pickDay('tomorrow')} />
          <DayChip label={a.otherDay} sub={tiles.other} selected={tiles.picked === 'other'} onPress={() => pickDay('other')} />
        </View>
      </Section>

      <Section title={a.timeOfDay} hint={a.timeHint}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} role="group" aria-label={a.timeOfDay} className="-mx-20" contentContainerClassName="gap-8 px-20 pb-4 pt-2">
          {slotChips(slotTimes).map((s) => (
            <SlotChip key={s.key} label={s.label} hours={s.hours} selected={isChipOn(d.time, s.key)} onPress={() => set({ time: toggleSlot(d.time, s.key) })} />
          ))}
        </ScrollView>
        <View className="flex-row gap-8">
          <TextField
            className="flex-1"
            label={a.starts}
            value={shown.start}
            keyboardType="numbers-and-punctuation"
            maxLength={5}
            onChangeText={(start) => set({ time: typeTime(d.time, 'start', start, slotTimes) })}
            warning={tried ? times.start : undefined}
          />
          <TextField
            className="flex-1"
            label={a.ends}
            value={shown.end}
            keyboardType="numbers-and-punctuation"
            maxLength={5}
            onChangeText={(end) => set({ time: typeTime(d.time, 'end', end, slotTimes) })}
            warning={tried ? times.end : undefined}
          />
        </View>
      </Section>

      <Section title={a.who}>
        <View role="group" aria-label={a.who} className="flex-row flex-wrap gap-8">
          {whoChips(members).map((c) => (
            <MemberPickerChip key={c.key} name={c.name} initial={c.initial} color={c.color} selected={d.who.includes(c.key)} onPress={() => set({ who: toggleWho(d.who, c.key) })} />
          ))}
        </View>
        {tried && noOne ? <FieldWarning text={a.noOne} /> : null}
        {revealed.length ? <FieldWarning text={a.surpriseRevealed(revealed)} /> : null}
      </Section>

      {conflict ? (
        <View role="status">
          <Callout variant="warn" text={`${conflict} ${a.addAnyway}`} />
        </View>
      ) : null}

      <DisclosureButton label={a.more} sub={more ? a.hide : a.moreHint} expanded={more} onPress={() => setMore(!more)} />

      {more ? (
        <View className="gap-20">
          <Section title={a.type}>
            <PillRow>
              {EVENT_CATEGORIES.map((c) => (
                <Choice
                  key={c}
                  label={a.types[c]}
                  selected={d.category === c}
                  // A birthday repeats every year, all day (spec 035 FR-006).
                  onPress={() => set(c === 'birthday' ? { category: c, time: { kind: 'all_day' }, repeat: 'yearly' } : { category: d.category === c ? null : c })}
                />
              ))}
            </PillRow>
          </Section>

          <TextField label={a.where} value={d.location} onChangeText={(location) => set({ location })} maxLength={200} placeholder={a.wherePlaceholder} />

          {managed.length ? (
            <Section title={a.whoTakes(managed.map((m) => m.display_name))} hint={a.whoTakesHint(managed.map((m) => m.display_name))}>
              <PillRow>
                <Choice label={a.notDecided} selected={d.responsible === null} onPress={() => set({ responsible: null })} />
                {takers(members).map((m) => (
                  <Choice key={m.id} label={m.display_name} selected={d.responsible === m.id} onPress={() => set({ responsible: m.id })} />
                ))}
              </PillRow>
            </Section>
          ) : null}

          {p.occurrenceOnly ? null : (
            <Section title={a.repeat}>
              <PillRow>
                {REPEATS.map((r) => (
                  <Choice
                    key={r}
                    label={a.repeats[r]}
                    selected={d.repeat === r}
                    // Weekly shows the day it repeats on: the start day until others are picked.
                    onPress={() => set(r === 'weekly' && d.weekdays.length === 0 ? { repeat: r, weekdays: [weekday(d.date)] } : { repeat: r })}
                  />
                ))}
              </PillRow>
              {d.repeat !== 'never' ? <RepeatDetails d={d} set={set} tried={tried} onPickEnd={() => setDateSheet({ for: 'ends', month: firstOfMonth(d.ends.type === 'on' ? d.ends.date : d.date) })} /> : null}
            </Section>
          )}

          {p.occurrenceOnly ? null : (
            <Section title={a.reminder}>
              <PillRow>
                {REMINDERS.map((r) => (
                  <Choice key={r} label={a.reminders[r]} selected={d.reminder === r} onPress={() => set({ reminder: r })} />
                ))}
              </PillRow>
              <Hint text={a.reminderHint} />
            </Section>
          )}

          {showVisibility ? (
            <Section title={a.whoCanSee}>
              <SegmentedControl
                label={a.whoCanSeeLabel}
                segments={VISIBILITIES.map((v) => ({ key: v, label: a.visibilities[v] }))}
                value={d.visibility}
                onChange={(visibility) => set({ visibility })}
              />
              <Hint text={a.visibilityHints[d.visibility]} />
              {d.visibility === 'surprise' ? (
                <View className="gap-12 rounded-lg bg-surface-card p-14">
                  {tried && secret.hiddenFrom ? <FieldWarning text={secret.hiddenFrom} /> : null}
                  <TextField
                    label={a.coverTitle(hidden)}
                    onCard
                    value={d.coverTitle}
                    onChangeText={(coverTitle) => set({ coverTitle })}
                    maxLength={60}
                    warning={tried ? secret.coverTitle : undefined}
                  />
                  <TextField label={a.coverNote(hidden)} onCard multiline value={d.coverNote} onChangeText={(coverNote) => set({ coverNote })} maxLength={200} />
                  <Hint text={a.surpriseSummary(hidden)} />
                </View>
              ) : null}
            </Section>
          ) : null}

          <View className="gap-8">
            <TextField label={a.notes} value={d.notes} onChangeText={(notes) => set({ notes })} maxLength={2000} placeholder={a.notesPlaceholder} multiline />
            {p.occurrenceOnly ? null : (
              <View className="rounded-lg bg-surface-card px-14 py-4">
                {d.checklist.map((c, i) => (
                  <ChecklistRow
                    key={c.id ?? `new-${i}`}
                    label={c.label}
                    done={false}
                    remove={{ label: a.removeItem(c.label), onPress: () => set({ checklist: d.checklist.filter((_, j) => j !== i) }) }}
                  />
                ))}
                {adding !== null ? (
                  <TextField
                    label={a.checklistItem}
                    labelHidden
                    size="sm"
                    className="py-6"
                    value={adding}
                    autoFocus
                    maxLength={80}
                    onChangeText={setAdding}
                    onSubmitEditing={addItem}
                    onBlur={() => {
                      if (adding.trim()) addItem();
                      else setAdding(null);
                    }}
                    submitBehavior="submit"
                  />
                ) : null}
                {d.checklist.length < MAX_CHECKLIST ? <ChecklistAdd label={a.addToChecklist} onPress={() => setAdding('')} /> : null}
              </View>
            )}
          </View>
        </View>
      ) : null}

      {dateSheet && grid ? (
        <BottomSheet visible onClose={() => setDateSheet(null)} title={dateSheet.for === 'date' ? a.pickDateTitle : a.endsOnTitle} closeLabel={a.close}>
          <DateGrid
            title={grid.title}
            weekdays={weekdayLetters(p.weekStartsOn)}
            weeks={grid.weeks}
            selected={dateSheet.for === 'date' ? d.date : d.ends.type === 'on' ? d.ends.date : null}
            onSelect={(date) => {
              set(dateSheet.for === 'date' ? { date } : { ends: { type: 'on', date } });
              setDateSheet(null);
            }}
            previous={{ label: a.previousMonth, onPress: () => setDateSheet({ ...dateSheet, month: shiftMonth(dateSheet.month, -1) }) }}
            next={{ label: a.nextMonth, onPress: () => setDateSheet({ ...dateSheet, month: shiftMonth(dateSheet.month, 1) }) }}
          />
        </BottomSheet>
      ) : null}
    </BottomSheet>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <View className="gap-8">
      <Text size={16} weight="900" role="heading" aria-level={3}>
        {title}
      </Text>
      {hint ? <Hint text={hint} /> : null}
      {children}
    </View>
  );
}

function Hint({ text }: { text: string }) {
  return (
    <Text size={14} weight="600" color="ink-muted">
      {text}
    </Text>
  );
}

/** Weekly's "On" days and every repeat's "Ends" (OC-CalAddMore), in a white card. */
function RepeatDetails({ d, set, tried, onPickEnd }: { d: EventDraft; set: (patch: Partial<EventDraft>) => void; tried: boolean; onPickEnd: () => void }) {
  const ends: { key: EndsChoice['type']; label: string }[] = [
    { key: 'never', label: a.endsNever },
    { key: 'on', label: a.endsOn },
    { key: 'after', label: a.endsAfter },
  ];
  const chooseEnd = (key: EndsChoice['type']) => {
    if (key === 'on') onPickEnd();
    else set({ ends: key === 'never' ? { type: 'never' } : { type: 'after', count: d.ends.type === 'after' ? d.ends.count : '10' } });
  };
  return (
    <View className="gap-8 rounded-lg bg-surface-card p-12">
      {d.repeat === 'weekly' ? (
        <>
          <Text size={14} weight="800">
            {a.on}
          </Text>
          <WeekdayPicker
            label={a.on}
            letters={a.weekdayLetters}
            names={a.weekdayNames}
            value={d.weekdays}
            onToggle={(day) => set({ weekdays: d.weekdays.includes(day) ? d.weekdays.filter((x) => x !== day) : [...d.weekdays, day] })}
          />
        </>
      ) : null}
      <Text size={14} weight="800">
        {a.endsLabel}
      </Text>
      <PillRow>
        {ends.map((e) => (
          <Choice key={e.key} label={e.label} selected={d.ends.type === e.key} onPress={() => chooseEnd(e.key)} />
        ))}
      </PillRow>
      {d.ends.type === 'on' ? <PickerField label={a.lastDay} value={dateLabel(d.ends.date)} placeholder={a.pickDate} onPress={onPickEnd} /> : null}
      {d.ends.type === 'after' ? (
        <TextField
          label={a.times}
          hint={a.timesHint}
          inputMode="numeric"
          maxLength={4}
          value={d.ends.count}
          onChangeText={(count) => set({ ends: { type: 'after', count } })}
          warning={tried && endsProblem(d) ? a.timesProblem : undefined}
        />
      ) : null}
    </View>
  );
}

