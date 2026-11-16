import { addDays, calendarWordsEn, dateLabel, daysBetween, formatTime, parts, timeIn, todayIn, weekday } from '@cocon/calendar';
import type { PlacedReminder, ReminderOccurrence, StoredReminder } from '@cocon/data';
import { rolloverFor, snoozeOptions, toDraft } from '@cocon/reminders';
import { memberInitials, type ParsedReminderDraft, type Recurrence, type ReminderDraft, type ReminderRollover, type ReminderSection, type ReminderSnoozeOption } from '@cocon/schemas';
import type { AvatarColor, MemberChipColor } from '@cocon/ui';
import { strings } from '../strings/en';
import { repeatWords } from './event-detail';
import { recurrenceOf, repeatDraftOf, type RepeatDraft } from './event-form';
import type { Member } from './session';

// Spec 057: what the Reminders card, screen, drawer and sheet show, from 056's placed reminders.
// The database decides late, sections and Home (`_reminder_state`); this only words it.

const r = strings.reminders;

/** Every reminders query starts with `reminders`, so a live change refetches them all (lib/sync.tsx). */
export const remindersHomeKey = (familyId: string, tz: string) => ['reminders', familyId, 'home', tz] as const;
export const remindersExistKey = (familyId: string) => ['reminders', familyId, 'exist'] as const;
export const reminderSectionKey = (familyId: string, section: ReminderSection, mine: boolean, tz: string) => ['reminders', familyId, 'section', section, mine, tz] as const;
export const reminderHistoryKey = (familyId: string, id: string) => ['reminders', familyId, 'history', id] as const;
export const reminderKey = (familyId: string, id: string) => ['reminders', familyId, 'one', id] as const;

/** The screen's sections, in order ("Snoozed" is the collapsed row after them). */
export const LIST_SECTIONS = ['overdue', 'today', 'tomorrow', 'later'] as const satisfies readonly ReminderSection[];

/** Where a placed reminder's day and time are, in the home time zone. */
const dueTime = (x: Pick<PlacedReminder, 'due_at' | 'has_time'>, tz: string) => (x.has_time ? timeIn(tz, new Date(x.due_at)) : null);
const dayOf = (instant: string, tz: string) => todayIn(tz, new Date(instant));

/** Who a reminder is for, as its dot draws it. A member who left reads as Everyone (056: theirs become Everyone's). */
export function reminderMember(assigneeId: string | null, members: readonly Member[]): { initial: string; color: AvatarColor; name: string } {
  const m = assigneeId ? members.find((x) => x.id === assigneeId) : undefined;
  if (!m) return { initial: r.everyoneInitial, color: 'everyone', name: r.everyone };
  return { initial: memberInitials(members).get(m.id) ?? '', color: m.color as AvatarColor, name: m.display_name };
}

/** The late badge, "2d late" / "3h late"; null when it isn't late (FR-006: the badge starts at 1 hour). */
export function lateBadge(x: Pick<PlacedReminder, 'late_days' | 'late_hours'>): string | null {
  if (x.late_days >= 1) return r.lateDays(x.late_days);
  if (x.late_hours >= 1) return r.lateHours(x.late_hours);
  return null;
}

/**
 * A row's detail line (OC-Reminders.md › Reminder row): "Was due yesterday", "15:00 · nudges
 * hourly", "Today" on Home or "Any time" in a section, "Sat, Nov 14", "Back tomorrow, Thu, Nov 12".
 */
export function detailLine(x: PlacedReminder, o: { today: string; tz: string; use24h: boolean; where: 'home' | 'list' }): string {
  const time = dueTime(x, o.tz);
  const shown = time ? formatTime(time, o.use24h) : null;
  if (x.section === 'snoozed' && x.snoozed_until) {
    const back = dayOf(x.snoozed_until, o.tz);
    return back === addDays(o.today, 1) ? r.backTomorrow(dateLabel(back)) : r.backOn(dateLabel(back));
  }
  if (x.due_on < o.today) {
    const ago = daysBetween(x.due_on, o.today);
    if (ago === 1) return r.wasDueYesterday;
    return r.wasDue(ago < 7 ? (calendarWordsEn.weekdaysShort[weekday(x.due_on)] ?? '') : dateLabel(x.due_on));
  }
  if (x.due_on === o.today) {
    if (!shown) return o.where === 'home' ? r.today : r.anyTime;
    return x.rollover === 'hour' ? r.nudgesHourly(shown) : shown;
  }
  if (x.due_on === addDays(o.today, 1)) return shown ?? r.anyTime;
  return shown ? r.dayAt(dateLabel(x.due_on), shown) : dateLabel(x.due_on);
}

/** A repeat from a stored reminder: from its series' first date (for "every Monday"). */
const repeatOf = (x: Pick<PlacedReminder, 'repeat_rule' | 'repeat_from' | 'due_on'>) =>
  x.repeat_rule ? repeatWords(x.repeat_rule, x.repeat_from ?? x.due_on) : null;

/**
 * The drawer's when line (OC-Reminders.md › Drawer, 2): "Every Monday · was due Mon, Nov 9",
 * "Today at 15:00 · nudges every hour until done", "Today, any time", "Every Wednesday at 20:00".
 */
export function whenLine(x: PlacedReminder, o: { today: string; tz: string; use24h: boolean }): string {
  const time = dueTime(x, o.tz);
  const shown = time ? formatTime(time, o.use24h) : null;
  const repeat = repeatOf(x);
  if (x.due_on < o.today) return repeat ? r.whenParts([repeat, r.wasDueLower(dateLabel(x.due_on))]) : r.wasDueOn(dateLabel(x.due_on));
  const tomorrow = addDays(o.today, 1);
  if (repeat) {
    const every = shown ? r.at(repeat, shown) : repeat;
    if (x.due_on === o.today) return every;
    return r.whenParts([every, x.due_on === tomorrow ? r.tomorrow : dateLabel(x.due_on)]);
  }
  const day =
    x.due_on === o.today
      ? shown
        ? r.todayAt(shown)
        : r.todayAnyTime
      : x.due_on === tomorrow
        ? shown
          ? r.tomorrowAt(shown)
          : r.tomorrowAnyTime
        : shown
          ? r.at(dateLabel(x.due_on), shown)
          : dateLabel(x.due_on);
  return x.rollover === 'hour' && shown ? r.whenParts([day, r.nudgesEveryHour]) : day;
}

/**
 * The drawer's late callout (OC-Reminders.md › Drawer, 3): "2 days late." then, from its history,
 * the dates missed since it was last done. Null when it isn't late.
 */
export function lateText(x: PlacedReminder, history: readonly ReminderOccurrence[], tz: string): string | null {
  if (x.late_hours < 1) return null;
  const head = x.late_days >= 1 ? r.daysLate(x.late_days) : r.hoursLate(x.late_hours);
  const missed: string[] = [];
  for (const h of history) {
    if (h.status === 'done') break;
    if (h.status === 'missed') missed.push(dayOf(h.due_at, tz));
  }
  if (missed.length === 0) return head;
  if (missed.length > 1) return head + r.missedSince(missed.length, dateLabel(missed.at(-1) ?? '')); // oldest last: history is latest first
  const date = dateLabel(missed[0] ?? '');
  return head + (x.repeat_rule?.freq === 'weekly' ? r.lastWeekMissed(date) : r.oneMissed(date));
}

/** Home's footer hint: "2 more today · 1 snoozed"; each part drops when zero, '' when both are. */
export function homeFooterHint(moreToday: number, snoozed: number): string {
  return r.joinParts([...(moreToday ? [r.moreToday(moreToday)] : []), ...(snoozed ? [r.snoozedCount(snoozed)] : [])]);
}

export interface SnoozeChoice {
  option: Exclude<ReminderSnoozeOption, 'date'>;
  label: string;
  /** Home's menu: "16:00", "Thu 12", "Fri, Dec 11". The drawer: "16:00", "Thu, Nov 12". */
  detail: string;
  until: string;
}

/** FR-002 and FR-005: the snooze choices that apply (In 1 hour only with a time), with when each ends. */
export function snoozeChoices(x: Pick<PlacedReminder, 'due_at' | 'has_time'>, o: { now: Date; tz: string; use24h: boolean; style: 'menu' | 'drawer' }): SnoozeChoice[] {
  return snoozeOptions(x, o.now, o.tz).map(({ option, until }) => {
    const day = dayOf(until, o.tz);
    const detail =
      option === 'hour'
        ? formatTime(timeIn(o.tz, new Date(until)), o.use24h)
        : o.style === 'drawer' || option === 'month'
          ? dateLabel(day)
          : strings.calendar.add.tileDate(calendarWordsEn.weekdaysShort[weekday(day)] ?? '', parts(day).day);
    return { option, label: r.snooze[option], detail, until };
  });
}

/** "Snoozed until Thu, Nov 12", or "Snoozed until 16:00" for In 1 hour today. */
export function snoozedTitle(until: string, o: { today: string; tz: string; use24h: boolean }): string {
  const day = dayOf(until, o.tz);
  return r.snoozedUntil(day === o.today ? formatTime(timeIn(o.tz, new Date(until)), o.use24h) : dateLabel(day));
}

// The create and edit sheet (OC-ReminderEdit).

export type ReminderRepeatChoice = 'never' | 'daily' | 'weekly' | 'monthly' | 'custom';
export const REPEAT_CHOICES: readonly ReminderRepeatChoice[] = ['never', 'daily', 'weekly', 'monthly', 'custom'];

export interface ReminderForm {
  title: string;
  /** The day it's due. */
  date: string;
  hasTime: boolean;
  /** "HH:MM", kept while the switch is off. */
  time: string;
  /** Picked by hand; null: the default (`hour` with a time, `day` without). */
  rollover: ReminderRollover | null;
  repeat: ReminderRepeatChoice;
  /** Custom: the event sheet's repeat (spec 041), its frequency, days and end. */
  custom: Omit<RepeatDraft, 'date'>;
  /** A member id, or `everyone`. */
  assignee: string;
  notes: string;
}

const DEFAULT_TIME = '09:00';
const CUSTOM_START: Omit<RepeatDraft, 'date'> = { repeat: 'weekly', weekdays: [], ends: { type: 'never' } };

/** A new reminder: today, any time, for me (FR-006). */
export function newReminderForm(myMemberId: string, today: string): ReminderForm {
  return { title: '', date: today, hasTime: false, time: DEFAULT_TIME, rollover: null, repeat: 'never', custom: CUSTOM_START, assignee: myMemberId, notes: '' };
}

/** The "If it's not done" choices: "Every hour" only with a time. */
export function rolloverChoices(hasTime: boolean): ReminderRollover[] {
  return hasTime ? ['hour', 'day', 'week', 'none'] : ['day', 'week', 'none'];
}

/** The rollover the sheet shows and saves: "Every hour" with the time switched off becomes "Next day". */
export const formRollover = (f: Pick<ReminderForm, 'hasTime' | 'rollover'>) => rolloverFor(f.hasTime, f.rollover ?? undefined);

export const isClockTime = (t: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t);

const plain = (rule: Recurrence, freq: Recurrence['freq'], date: string) =>
  rule.freq === freq && rule.ends.type === 'never' && (freq !== 'weekly' || !rule.weekdays?.length || (rule.weekdays.length === 1 && rule.weekdays[0] === weekday(date)));

/** A saved reminder in the sheet: Every day / week / month when it's that plainly, Custom otherwise. */
export function formFromReminder(stored: StoredReminder, tz: string): ReminderForm {
  const d = toDraft(stored, tz);
  const rule = d.repeat ?? null;
  const repeat: ReminderRepeatChoice = !rule ? 'never' : (['daily', 'weekly', 'monthly'] as const).find((f) => plain(rule, f, d.due_date)) ?? 'custom';
  return {
    title: d.title,
    date: d.due_date,
    hasTime: d.time != null,
    time: d.time ?? DEFAULT_TIME,
    rollover: d.rollover ?? null,
    repeat,
    custom: repeat === 'custom' ? repeatDraftOf(rule) : CUSTOM_START,
    assignee: d.assignee ?? 'everyone',
    notes: d.notes ?? '',
  };
}

/** What Save sends (056's `ReminderDraft`). */
export function formToDraft(f: ReminderForm): ReminderDraft {
  const never = { type: 'never' } as const;
  const repeat: Recurrence | null =
    f.repeat === 'never'
      ? null
      : f.repeat === 'custom'
        ? recurrenceOf({ ...f.custom, date: f.date })
        : f.repeat === 'weekly'
          ? { freq: 'weekly', weekdays: [weekday(f.date)], ends: never }
          : { freq: f.repeat, ends: never };
  return {
    title: f.title.trim(),
    notes: f.notes,
    due_date: f.date,
    time: f.hasTime ? f.time : null,
    repeat,
    rollover: formRollover(f),
    assignee: f.assignee,
  };
}

/** `reminder_created`'s properties: never the title or notes. */
export function createdProps(d: ParsedReminderDraft, myMemberId: string) {
  return {
    has_time: d.time != null,
    repeating: d.repeat != null,
    rollover: d.rollover ?? rolloverFor(d.time != null),
    has_notes: d.notes != null,
    assignee_is_self: d.assignee === myMemberId,
  };
}

const QUIET = { from: '22:00', to: '07:00' };
const UNTIMED_AT = '09:00';

/** The hour before "HH:MM". */
const hourBefore = (t: string) => {
  const [h = 0, m = 0] = t.split(':').map(Number);
  return `${String((h + 23) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

/**
 * The sheet's notification line (OC-Reminders.md › Create / edit sheet). Quiet hours are spec 059's
 * default until it lets each person set theirs (032-later).
 */
export function notifySummary(f: ReminderForm, members: readonly Member[], use24h: boolean): string {
  const who = f.assignee === 'everyone' ? r.everyoneLower : (members.find((m) => m.id === f.assignee)?.display_name ?? r.everyoneLower);
  const t = (x: string) => formatTime(x, use24h);
  const roll = formRollover(f);
  if (f.hasTime && isClockTime(f.time)) {
    return roll === 'hour' ? r.notifyTimedHourly(who, t(hourBefore(f.time)), t(f.time), t(QUIET.from), t(QUIET.to)) : r.notifyTimed(who, t(hourBefore(f.time)), t(f.time));
  }
  return roll === 'none' ? r.notifyDayOnly(who, t(UNTIMED_AT)) : r.notifyDay(who, t(UNTIMED_AT));
}

/** The "For" chips: each member, then Everyone (OC-ReminderEdit's order). */
export function forChips(members: readonly Member[]): { key: string; name: string; initial: string; color: MemberChipColor }[] {
  const initials = memberInitials(members);
  return [
    ...members.map((m) => ({ key: m.id, name: m.display_name, initial: initials.get(m.id) ?? '', color: m.color as MemberChipColor })),
    { key: 'everyone', name: r.everyone, initial: r.everyoneInitial, color: 'everyone' as const },
  ];
}
