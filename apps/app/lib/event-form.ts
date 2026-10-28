import {
  addDays,
  calendarWordsEn,
  conflictWho,
  daysBetween,
  findConflict,
  parts,
  rangeLabel,
  slotsToRange,
  sortSlots,
  splitSeries,
  toMinutes,
  weekday,
  whenWord,
  dateLabel,
  daysInMonth,
  makeDate,
  type SlotTimes,
  type WeekStartsOn,
} from '@cocon/calendar';
import type { StoredEvent } from '@cocon/data';
import { memberInitials, memberKind, type EventField } from '@cocon/schemas';
import {
  ClockTime,
  CalendarDate,
  SLOT_KEYS,
  SlotKey,
  type EventCategory,
  type EventInput,
  type EventMember,
  type EventOverride,
  type Recurrence,
  type Reminder,
  type SurpriseCover,
  type Visibility,
} from '@cocon/schemas/calendar';
import type { DateGridDay, MemberChipColor } from '@cocon/ui';
import { monthOccurrences } from './calendar-month';
import type { Member } from './session';
import { strings } from '../strings/en';

const a = strings.calendar.add;

/** The sheet's time of day (FR-002): All day, one run of adjacent slots, or custom times as typed. */
export type DraftTime = { kind: 'all_day' } | { kind: 'slot'; slots: SlotKey[] } | { kind: 'custom'; start: string; end: string };
export type RepeatChoice = 'never' | Recurrence['freq'];
/** "After a number of times" keeps what's typed until Save. */
export type EndsChoice = { type: 'never' } | { type: 'on'; date: string } | { type: 'after'; count: string };

/** Everything the add and edit sheet holds (spec 041 FR-001, FR-004). */
export interface EventDraft {
  title: string;
  date: string;
  /** Extra days a multi-day event keeps when it's edited; 0 for the sheet's one-day events. */
  span: number;
  time: DraftTime;
  who: EventMember[];
  category: EventCategory | null;
  location: string;
  /** "Who takes {names}?": an account member, or null for "Not decided yet". */
  responsible: string | null;
  repeat: RepeatChoice;
  /** Weekly's "On" days, 0 = Sunday. */
  weekdays: number[];
  ends: EndsChoice;
  reminder: Reminder;
  notes: string;
  checklist: { id?: string; label: string }[];
  /** Spec 043 sets these; an edit keeps them as they are. */
  visibility: Visibility;
  surprise: SurpriseCover | null;
}

/** The route's prefill (FR-007, 032-later L91): a day, and a slot (Day view) or an hour (Week view). */
export interface Prefill {
  date?: string;
  slot?: SlotKey;
  time?: string;
}

/** Reads `?date=&slot=&time=`; anyone can edit a link, so anything malformed is dropped. */
export function prefillFrom(params: { date?: unknown; slot?: unknown; time?: unknown }): Prefill {
  const date = CalendarDate.safeParse(params.date);
  const slot = SlotKey.safeParse(params.slot);
  const time = ClockTime.safeParse(params.time);
  return {
    ...(date.success ? { date: date.data } : {}),
    ...(slot.success ? { slot: slot.data } : {}),
    ...(time.success && time.data !== '24:00' ? { time: time.data } : {}),
  };
}

const plusHour = (time: string) => {
  const end = Math.min(toMinutes(time) + 60, 24 * 60);
  return `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`;
};

/** A new event: today (or the prefilled day), All day unless a slot or hour was given, for me. */
export function newDraft(prefill: Prefill, today: string, myMemberId: string): EventDraft {
  const time: DraftTime = prefill.slot ? { kind: 'slot', slots: [prefill.slot] } : prefill.time ? { kind: 'custom', start: prefill.time, end: plusHour(prefill.time) } : { kind: 'all_day' };
  return {
    title: '',
    date: prefill.date ?? today,
    span: 0,
    time,
    who: [myMemberId],
    category: null,
    location: '',
    responsible: null,
    repeat: 'never',
    weekdays: [],
    ends: { type: 'never' },
    reminder: 'none',
    notes: '',
    checklist: [],
    visibility: 'family',
    surprise: null,
  };
}

/** The sheet filled from a saved event, or one occurrence of it (`date`, its day). */
export function draftFromEvent(event: StoredEvent, date: string = event.starts_on): EventDraft {
  const time: DraftTime =
    event.time_type === 'all_day'
      ? { kind: 'all_day' }
      : event.time_type === 'slot'
        ? { kind: 'slot', slots: sortSlots(event.slots) }
        : { kind: 'custom', start: event.start_time ?? '', end: event.end_time ?? '' };
  const r = event.recurrence;
  return {
    title: event.title,
    date,
    span: daysBetween(event.starts_on, event.ends_on),
    time,
    who: [...event.members],
    category: event.category,
    location: event.location ?? '',
    responsible: event.responsible_member_id ?? null,
    repeat: r ? r.freq : 'never',
    weekdays: r?.weekdays ? [...r.weekdays] : [],
    ends: !r || r.ends.type === 'never' ? { type: 'never' } : r.ends.type === 'on' ? { type: 'on', date: r.ends.date } : { type: 'after', count: String(r.ends.count) },
    reminder: event.reminder ?? 'none',
    notes: event.notes ?? '',
    checklist: (event.checklist ?? []).map((c) => ({ id: c.id, label: c.label })),
    visibility: event.visibility,
    surprise: event.surprise ?? null,
  };
}

const slotIndex = (s: SlotKey) => SLOT_KEYS.indexOf(s);
const adjacent = (slots: readonly SlotKey[]) => {
  const idx = slots.map(slotIndex).sort((x, y) => x - y);
  return idx.every((v, i) => i === 0 || v === (idx[i - 1] as number) + 1);
};

/** Custom's starting times: the picked slots' hours, or the Evening's when nothing was picked. */
function customFrom(time: DraftTime, slotTimes: SlotTimes): DraftTime {
  if (time.kind === 'custom') return time;
  const range = time.kind === 'slot' ? slotsToRange(time.slots, slotTimes) : slotTimes.evening;
  return { kind: 'custom', start: range.start, end: range.end };
}

/**
 * FR-002: adjacent slots combine; a tap that isn't next to the picked ones starts over; All day and
 * Custom stand alone, and Custom starts on the picked slots' times. Unpicking the last slot is All day.
 */
export function toggleSlot(time: DraftTime, key: SlotKey | 'all_day' | 'custom', slotTimes: SlotTimes): DraftTime {
  if (key === 'all_day') return { kind: 'all_day' };
  if (key === 'custom') return customFrom(time, slotTimes);
  if (time.kind !== 'slot') return { kind: 'slot', slots: [key] };
  if (time.slots.includes(key)) {
    const rest = time.slots.filter((s) => s !== key);
    if (rest.length === 0) return { kind: 'all_day' };
    return { kind: 'slot', slots: adjacent(rest) ? sortSlots(rest) : [key] };
  }
  const all = [...time.slots, key];
  return { kind: 'slot', slots: adjacent(all) ? sortSlots(all) : [key] };
}

/**
 * FR-003: Everyone replaces individual members; Others goes with anything and needs no names.
 * With nobody left, the event is mine again.
 */
export function toggleWho(who: readonly EventMember[], key: EventMember, myMemberId: string): EventMember[] {
  const others = who.includes('others');
  if (key === 'others') {
    if (!others) return [...who, 'others'];
    const rest = who.filter((m) => m !== 'others');
    return rest.length ? rest : [myMemberId];
  }
  if (key === 'everyone') return others ? ['everyone', 'others'] : ['everyone'];
  const named = who.filter((m) => m !== 'everyone');
  const next = named.includes(key) ? named.filter((m) => m !== key) : [...named, key];
  return next.length ? next : [myMemberId];
}

/** The Who row's chips: every member, then Everyone and Others (FR-003). */
export interface WhoChip {
  key: EventMember;
  name: string;
  initial: string;
  color: MemberChipColor;
}

export function whoChips(members: readonly Member[]): WhoChip[] {
  const initials = memberInitials(members);
  return [
    ...members.map((m) => ({ key: m.id, name: m.display_name, initial: initials.get(m.id) ?? '', color: m.color as MemberChipColor })),
    { key: 'everyone', name: a.everyone, initial: a.everyoneInitial, color: 'everyone' },
    { key: 'others', name: a.others, initial: '', color: 'others' },
  ];
}

/** FR-004: the members without the app on the event, who need "Who takes {names}?". */
export function managedOn(who: readonly EventMember[], members: readonly Member[]): Member[] {
  return members.filter((m) => who.includes(m.id) && memberKind(m) === 'managed');
}

/** "Who takes …?"'s choices: each account member. */
export function takers(members: readonly Member[]): Member[] {
  return members.filter((m) => memberKind(m) !== 'managed');
}

/** The three "When" tiles' dates (FR-001): "Sun 25", "Mon 26", and the other day once picked. */
export function dayTiles(today: string, date: string): { today: string; tomorrow: string; other: string; picked: 'today' | 'tomorrow' | 'other' } {
  const tile = (d: string) => a.tileDate(calendarWordsEn.weekdaysShort[weekday(d)] ?? '', parts(d).day);
  const picked = date === today ? 'today' : date === addDays(today, 1) ? 'tomorrow' : 'other';
  return { today: tile(today), tomorrow: tile(addDays(today, 1)), other: picked === 'other' ? dateLabel(date) : a.pickDate, picked };
}

/** The slot chips, in order, with the family's hours ("18–22"). */
export function slotChips(slotTimes: SlotTimes): { key: SlotKey | 'all_day' | 'custom'; label: string; hours: string }[] {
  return [
    { key: 'all_day', label: a.allDay, hours: a.wholeDay },
    ...SLOT_KEYS.map((s) => ({ key: s, label: calendarWordsEn.slots[s], hours: a.slotHours(slotTimes[s].start, slotTimes[s].end) })),
    { key: 'custom', label: a.custom, hours: a.pickTimes },
  ];
}

export const isChipOn = (time: DraftTime, key: SlotKey | 'all_day' | 'custom') => (key === 'all_day' || key === 'custom' ? time.kind === key : time.kind === 'slot' && time.slots.includes(key));

/** Custom times' warnings: a time that isn't "HH:MM", or an end that isn't after the start. */
export function timeProblems(time: DraftTime): { start?: string; end?: string } {
  if (time.kind !== 'custom') return {};
  const ok = (t: string) => ClockTime.safeParse(t).success;
  const start = ok(time.start) && time.start !== '24:00' ? undefined : a.badTime;
  const end = !ok(time.end) ? a.badTime : !start && toMinutes(time.end) <= toMinutes(time.start) ? a.endBeforeStart : undefined;
  return { ...(start ? { start } : {}), ...(end ? { end } : {}) };
}

/** "After a number of times" as a count, or null while it isn't one (1–1000). */
const countOf = (count: string) => {
  const n = Number(count.trim());
  return Number.isInteger(n) && n >= 1 && n <= 1000 ? n : null;
};

export const endsProblem = (draft: EventDraft) => draft.repeat !== 'never' && draft.ends.type === 'after' && countOf(draft.ends.count) === null;

/** Weekly's days: the picked ones, or the start day's when none are. */
const weekdaysOf = (draft: EventDraft) => (draft.weekdays.length ? [...draft.weekdays].sort((x, y) => x - y) : [weekday(draft.date)]);

function recurrenceOf(draft: EventDraft): Recurrence | null {
  if (draft.repeat === 'never') return null;
  const e = draft.ends;
  const ends = e.type === 'after' ? { type: 'after' as const, count: countOf(e.count) ?? 1 } : e;
  return { freq: draft.repeat, ...(draft.repeat === 'weekly' ? { weekdays: weekdaysOf(draft) } : {}), ends };
}

const timeFields = (time: DraftTime) => ({
  time_type: time.kind,
  slots: time.kind === 'slot' ? time.slots : [],
  start_time: time.kind === 'custom' ? time.start : null,
  end_time: time.kind === 'custom' ? time.end : null,
});

/**
 * What Save sends (`EventInput`, FR-005 of spec 035). "Who takes" only counts while a member
 * without the app is on it. A weekly repeat that doesn't fall on the start day starts on the
 * first picked day after it, so the event shows only on the days asked for; one occurrence
 * ("This event only") moves to exactly the day picked.
 */
export function toInput(draft: EventDraft, members: readonly Member[], { occurrence = false }: { occurrence?: boolean } = {}): EventInput {
  const responsible = managedOn(draft.who, members).length && draft.responsible && takers(members).some((m) => m.id === draft.responsible) ? draft.responsible : null;
  const recurrence = recurrenceOf(draft);
  let starts = draft.date;
  if (recurrence?.weekdays && !occurrence) while (!recurrence.weekdays.includes(weekday(starts))) starts = addDays(starts, 1);
  return {
    title: draft.title.trim(),
    category: draft.category,
    location: draft.location.trim() || null,
    notes: draft.notes.trim() || null,
    starts_on: starts,
    ends_on: addDays(starts, draft.span),
    ...timeFields(draft.time),
    recurrence,
    reminder: draft.reminder,
    members: draft.who,
    responsible_member_id: responsible,
    visibility: draft.visibility,
    surprise: draft.surprise,
    checklist: draft.checklist.filter((c) => c.label.trim()).map((c) => ({ ...(c.id ? { id: c.id } : {}), label: c.label.trim() })),
  };
}

const same = (x: unknown, y: unknown) => JSON.stringify(x) === JSON.stringify(y);

/** `event_updated`'s field names: what the edit changed, never the values. */
export function changedFields(before: EventInput, after: EventInput): EventField[] {
  const fields: [EventField, unknown, unknown][] = [
    ['title', before.title, after.title],
    ['type', before.category ?? null, after.category ?? null],
    ['place', before.location ?? null, after.location ?? null],
    ['notes', before.notes ?? null, after.notes ?? null],
    ['date', [before.starts_on, before.ends_on], [after.starts_on, after.ends_on]],
    ['time', timeOf(before), timeOf(after)],
    ['who', [...before.members].sort(), [...after.members].sort()],
    ['responsible', before.responsible_member_id ?? null, after.responsible_member_id ?? null],
    ['repeat', before.recurrence ?? null, after.recurrence ?? null],
    ['reminder', before.reminder ?? 'none', after.reminder ?? 'none'],
    ['checklist', before.checklist?.map((c) => c.label) ?? [], after.checklist?.map((c) => c.label) ?? []],
  ];
  return fields.filter(([, x, y]) => !same(x, y)).map(([name]) => name);
}

const timeOf = (e: EventInput) => [e.time_type, e.slots ?? [], e.start_time ?? null, e.end_time ?? null];

/** "This event only": the changed fields an occurrence can replace (event_exceptions' override). */
export function overrideFor(before: EventInput, after: EventInput): EventOverride {
  const changed = new Set(changedFields(before, after));
  return {
    ...(changed.has('title') ? { title: after.title } : {}),
    ...(changed.has('type') ? { category: after.category ?? null } : {}),
    ...(changed.has('place') ? { location: after.location ?? null } : {}),
    ...(changed.has('notes') ? { notes: after.notes ?? null } : {}),
    ...(changed.has('date') ? { starts_on: after.starts_on, ends_on: after.ends_on } : {}),
    ...(changed.has('time') ? timeFields(timeKindOf(after)) : {}),
    ...(changed.has('who') ? { members: after.members } : {}),
    ...(changed.has('responsible') ? { responsible_member_id: after.responsible_member_id ?? null } : {}),
  };
}

const timeKindOf = (e: EventInput): DraftTime =>
  e.time_type === 'all_day' ? { kind: 'all_day' } : e.time_type === 'slot' ? { kind: 'slot', slots: e.slots ?? [] } : { kind: 'custom', start: e.start_time ?? '', end: e.end_time ?? '' };

/**
 * "All future events" from the occurrence `from` (its series date): the old series' new repeat and
 * the new series, which keeps what's left of the end. Null on the series' first date: edit it all.
 */
export function futureSplit(event: StoredEvent, from: string, after: EventInput): { before: Recurrence; input: EventInput } | null {
  const split = splitSeries(event, from);
  if (!split) return null;
  const recurrence = after.recurrence ? { ...after.recurrence, ends: after.recurrence.ends.type === event.recurrence?.ends.type && same(after.recurrence.ends, event.recurrence.ends) ? split.ends : after.recurrence.ends } : null;
  return { before: split.before, input: { ...after, recurrence } };
}

/**
 * FR-006: "You already have Movie night this evening." when the draft shares a time with someone's
 * event that day (as this member may see it: a private one is "Busy"); null otherwise. Never blocks.
 */
export function conflictLine(draft: EventDraft, events: readonly StoredEvent[], members: readonly Member[], myMemberId: string, slotTimes: SlotTimes, editingId?: string): string | null {
  if (draft.time.kind === 'all_day' || Object.keys(timeProblems(draft.time)).length) return null;
  const candidate = { id: editingId ?? null, starts_on: draft.date, ends_on: addDays(draft.date, draft.span), ...timeFields(draft.time), members: draft.who };
  let other;
  try {
    const day = monthOccurrences(events, candidate.starts_on, candidate.ends_on, myMemberId, new Set());
    other = findConflict(candidate, day, slotTimes);
    if (!other) return null;
    const { who, slot } = conflictWho(candidate, other, myMemberId, slotTimes);
    const name = who === 'me' ? null : who === 'everyone' ? a.everyone : (members.find((m) => m.id === who)?.display_name ?? a.everyone);
    return a.conflict(name, other.title, a.slotWords[slot]);
  } catch {
    // Slots that aren't adjacent never reach here (toggleSlot); a broken event elsewhere shouldn't stop the sheet.
    return null;
  }
}

/** FR-009: "Poker night added for tonight, 18:00–22:00."; all day: "… added for Sat, Oct 31." */
export function toastText(input: EventInput, today: string, slotTimes: SlotTimes): string {
  const range = rangeLabel({ time_type: input.time_type, slots: input.slots ?? [], start_time: input.start_time, end_time: input.end_time }, { use24h: true, slotTimes });
  const start = range ? (range.split('–')[0] ?? null) : null;
  const word = whenWord(input.starts_on, today, start);
  const when = word === 'tonight' ? a.tonight : word === 'today' ? a.todayWord : word === 'tomorrow' ? a.tomorrowWord : dateLabel(input.starts_on);
  return a.added(input.title, when, range);
}

/** The edit's scope question: "Change only Saturday, Oct 31, or every Saturday from now on?" */
export function scopeBody(event: StoredEvent, date: string): string {
  const r = event.recurrence;
  const day = calendarWordsEn.weekdays[weekday(date)] ?? '';
  const every = !r ? '' : r.freq === 'weekly' ? a.every.weekly(day) : r.freq === 'biweekly' ? a.every.biweekly(day) : a.every[r.freq]();
  return a.scopeBody(dateLabel(date, 'long'), every);
}

/** An edit opens More options when anything in it is set (FR-008: the same sheet, filled in). */
export function hasMoreOptions(draft: EventDraft): boolean {
  return draft.category !== null || draft.location !== '' || draft.responsible !== null || draft.repeat !== 'never' || draft.reminder !== 'none' || draft.notes !== '' || draft.checklist.length > 0;
}

/** The date sheet's month (DateGrid): "November 2026" and its days in weeks; days before `min` are off. */
export function dateGridMonth(month: string, today: string, weekStartsOn: WeekStartsOn, min?: string): { title: string; weeks: (DateGridDay | null)[][] } {
  const { year, month: mo } = parts(month);
  const days: (DateGridDay | null)[] = Array.from({ length: (weekday(makeDate(year, mo, 1)) - weekStartsOn + 7) % 7 }, () => null);
  for (let d = 1; d <= daysInMonth(year, mo); d++) {
    const date = makeDate(year, mo, d);
    days.push({ date, day: d, label: dateLabel(date, 'long'), today: date === today, ...(min && date < min ? { disabled: true } : {}) });
  }
  while (days.length % 7) days.push(null);
  const weeks = Array.from({ length: days.length / 7 }, (_, i) => days.slice(i * 7, i * 7 + 7));
  return { title: `${strings.months[mo - 1]} ${year}`, weeks };
}

/** The first of the month `delta` months from `month`'s. */
export function shiftMonth(month: string, delta: number): string {
  const { year, month: mo } = parts(month);
  return makeDate(year, mo + delta, 1);
}
