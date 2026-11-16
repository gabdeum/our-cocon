import { useCallback, useEffect, useState } from 'react';
import { addDays, calendarWordsEn, dateLabel, daysBetween, formatTime, timeIn, todayIn, toMinutes, weekday } from '@cocon/calendar';
import type { PlacedReminder } from '@cocon/data';
import { repeatDatesBetween } from '@cocon/reminders';
import type { DayReminderItem } from '@cocon/ui';
import { strings } from '../strings/en';
import { deviceStorage, type ChoiceStorage } from './recipe-choices';
import { lateBadge, reminderMember } from './reminders';
import type { Member } from './session';

// Spec 058: reminders among the events in Agenda and Day. The database places each open reminder
// (056: late, sections); this puts it on a calendar day and draws its later repeats, which are
// never stored (FR-003).

const c = strings.calendar.reminders;
const r = strings.reminders;

/** Starts with `reminders`, so 057's ticks and live changes refetch it too (SC-001). */
export const calendarRemindersKey = (familyId: string, from: string, to: string, tz: string) => ['reminders', familyId, 'range', from, to, tz] as const;

/** One reminder on one day of the calendar. */
export interface CalendarReminder {
  /** `{id}|{date}`. */
  key: string;
  date: string;
  /** "HH:MM" in the home time zone; null for any time. */
  time: string | null;
  /** Late and brought to today (FR-002): before everything else that day, oldest first. */
  overdue: boolean;
  /** The reminder as it stands (its open date), for the drawer and the tick. */
  row: PlacedReminder;
  item: DayReminderItem;
}

export interface PlaceContext {
  from: string;
  to: string;
  today: string;
  tz: string;
  members: readonly Member[];
  use24h: boolean;
  /** The header's people filter: member ids, "everyone". */
  hidden: ReadonlySet<string>;
  /** Ticked on this screen: they stay, done, where they were until the screen is left. */
  ticked?: ReadonlyMap<string, { row: PlacedReminder }>;
  /** Snoozed or deleted on this screen, before the list catches up. */
  gone?: ReadonlySet<string>;
}

/** The first day from `today` on `due_on`'s weekday: a late "Next week" reminder (056 FR-008). */
function nextWeekday(dueOn: string, today: string): string {
  return addDays(today, (weekday(dueOn) - weekday(today) + 7) % 7);
}

/**
 * The day an open reminder shows on: its due day; late ones on today (FR-002), "Next week" ones on
 * their weekday, "Leave it" ones on their due day; a snoozed one on the day it comes back.
 */
export function reminderDay(x: PlacedReminder, today: string, tz: string): string {
  if (x.section === 'snoozed' && x.snoozed_until) return todayIn(tz, new Date(x.snoozed_until));
  if (x.section !== 'overdue' || x.rollover === 'none') return x.due_on;
  return x.rollover === 'week' ? nextWeekday(x.due_on, today) : today;
}

/** "was due yesterday", "was due Mon" (this past week), "was due Mon, Nov 2". */
function wasDue(dueOn: string, today: string): string {
  const ago = daysBetween(dueOn, today);
  if (ago === 1) return c.wasDueYesterday;
  return r.wasDueLower(ago < 7 ? (calendarWordsEn.weekdaysShort[weekday(dueOn)] ?? '') : dateLabel(dueOn));
}

/**
 * FR-001–FR-003: every reminder on the days from `from` to `to`: each open one where it shows,
 * then its later repeats (the box can't be ticked before their day). Reminders for someone the
 * header hides are left out.
 */
export function placeReminders(rows: readonly PlacedReminder[], ctx: PlaceContext): CalendarReminder[] {
  const ids = new Set(ctx.members.map((m) => m.id));
  const shown = (x: PlacedReminder) => !ctx.hidden.has(x.assignee_id && ids.has(x.assignee_id) ? x.assignee_id : 'everyone');
  const out = new Map<string, CalendarReminder>();
  const add = (x: PlacedReminder, date: string, o: { future: boolean; done: boolean }) => {
    if (date < ctx.from || date > ctx.to) return;
    const key = `${x.id}|${date}`;
    if (out.has(key)) return;
    // A snoozed one comes back at the snooze's time, and isn't late then (056 FR-007).
    const back = x.section === 'snoozed' && x.snoozed_until ? x.snoozed_until : null;
    const time = x.has_time ? timeIn(ctx.tz, new Date(back ?? x.due_at)) : null;
    const name = reminderMember(x.assignee_id, ctx.members).name;
    const overdue = !o.future && x.section === 'overdue' && date > x.due_on;
    const sub = o.done ? r.doneJustNow : overdue ? c.lateSub(name, wasDue(x.due_on, ctx.today)) : c.sub(time ? formatTime(time, ctx.use24h) : r.anyTime, name);
    const late = o.future || o.done ? null : lateBadge(x);
    out.set(key, {
      key,
      date,
      time,
      overdue,
      row: x,
      item: {
        kind: 'reminder',
        key,
        title: x.title,
        sub,
        late,
        done: o.done,
        future: o.future,
        toggleLabel: o.future ? c.notYetLabel(x.title) : o.done ? r.markNotDone(x.title) : r.markDone(x.title),
        label: c.rowLabel(x.title, sub, late),
      },
    });
  };

  for (const t of ctx.ticked?.values() ?? []) if (shown(t.row)) add(t.row, reminderDay(t.row, ctx.today, ctx.tz), { future: false, done: true });
  for (const x of rows) {
    if (ctx.gone?.has(x.id) || !shown(x)) continue;
    // The list from before the tick: the ticked one is drawn above, and its next date comes with the refetch.
    if (ctx.ticked?.get(x.id)?.row.due_at === x.due_at) continue;
    add(x, reminderDay(x, ctx.today, ctx.tz), { future: false, done: false });
    for (const date of repeatDatesBetween(x, ctx.from, ctx.to, ctx.tz)) add(x, date, { future: true, done: false });
  }
  return [...out.values()];
}

/** Where a reminder sorts among a day's rows: late first, then any time (with all-day events), then its time. */
export function reminderOrder(x: Pick<CalendarReminder, 'overdue' | 'time'>): number {
  if (x.overdue) return -2;
  return x.time ? toMinutes(x.time) : -1;
}

/**
 * A day's rows in order (FR-001): by `order`, events before reminders at the same time, late
 * reminders oldest first, then by title.
 */
export function compareDayRows(
  a: { order: number; reminder?: CalendarReminder; title: string },
  b: { order: number; reminder?: CalendarReminder; title: string },
): number {
  return (
    a.order - b.order ||
    Number(Boolean(a.reminder)) - Number(Boolean(b.reminder)) ||
    (a.reminder && b.reminder ? a.reminder.row.due_at.localeCompare(b.reminder.row.due_at) : 0) ||
    a.title.localeCompare(b.title)
  );
}

// FR-004: Agenda's "Reminders" pill, remembered per person on this device. On at first.
const toggleKey = (userId: string) => `cocon.calendar.reminders.${userId}`;

export async function readAgendaReminders(storage: ChoiceStorage, userId: string): Promise<boolean> {
  try {
    return (await storage.getItem(toggleKey(userId))) !== 'off';
  } catch {
    return true;
  }
}

/** Best effort: if the device refuses, the pill still works, it just isn't remembered. */
export async function writeAgendaReminders(storage: ChoiceStorage, userId: string, on: boolean): Promise<void> {
  try {
    await storage.setItem(toggleKey(userId), on ? 'on' : 'off');
  } catch {
    // Not kept, nothing to say.
  }
}

/** Whether Agenda shows reminders for this person, and the pill's toggle. */
export function useAgendaReminders(userId: string, storage: ChoiceStorage = deviceStorage) {
  // Kept with whose it is, so another person signing in never sees the last one's choice.
  const [stored, setStored] = useState<{ userId: string; on: boolean } | null>(null);
  useEffect(() => {
    let live = true;
    void readAgendaReminders(storage, userId).then((on) => live && setStored({ userId, on }));
    return () => {
      live = false;
    };
  }, [storage, userId]);
  const on = stored?.userId === userId ? stored.on : true;
  const set = useCallback(
    (next: boolean) => {
      setStored({ userId, on: next });
      void writeAgendaReminders(storage, userId, next);
    },
    [storage, userId],
  );
  return [on, set] as const;
}

/** What Agenda and Day need for their reminders; the Calendar tab loads and saves them. */
export interface CalendarReminders {
  /** Open reminders around the days shown (`loadRemindersInRange`); undefined while loading. */
  rows: PlacedReminder[] | undefined;
  ticked: ReadonlyMap<string, { row: PlacedReminder }>;
  gone: ReadonlySet<string>;
  /** Offline: the boxes can't be ticked. */
  readOnly: boolean;
  onTick: (row: PlacedReminder) => void;
  onUntick: (id: string) => void;
  /** A later repeat's box, pressed before its day (FR-003). */
  onNotYet: (date: string) => void;
  /** The drawer (057 FR-005). */
  onOpen: (row: PlacedReminder) => void;
}

/** A reminder's box: ticks it, unticks it (Undo), or says "Not yet" for a later repeat. */
export function pressReminderBox(x: CalendarReminder, on: Pick<CalendarReminders, 'onTick' | 'onUntick' | 'onNotYet'>): void {
  if (x.item.future) on.onNotYet(x.date);
  else if (x.item.done) on.onUntick(x.row.id);
  else on.onTick(x.row);
}

/** Placed for the days shown, with the screen's ticks (Agenda and Day, with their range); none while hidden or loading. */
export function placeForScreen(reminders: CalendarReminders | undefined, ctx: Omit<PlaceContext, 'ticked' | 'gone'>): ReadonlyMap<string, CalendarReminder> {
  const placed = reminders?.rows ? placeReminders(reminders.rows, { ...ctx, ticked: reminders.ticked, gone: reminders.gone }) : [];
  return new Map(placed.map((x) => [x.key, x]));
}
