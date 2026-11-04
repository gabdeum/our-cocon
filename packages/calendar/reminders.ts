import type { EventMember, ReminderKind } from '@cocon/schemas/calendar';
import { addDays, todayIn, weekday, zonedInstant } from './dates';
import { formatTime, timeLabel } from './labels';
import { expand } from './recurrence';
import { DEFAULT_SLOT_TIMES, fromMinutes, slotStartingAt, timeRange, toMinutes } from './slots';
import type { CalendarEvent, EventException, Occurrence, SlotTimes } from './types';
import { viewFor } from './visibility';
import { en } from './words.en';

// Spec 049: event reminders on the phone. When each one goes out (FR-002), to whom (FR-003) and
// what it says (FR-004). The notifier sends them; the app's event sheet and event page say the
// same thing with the same rules.

/** A family member, as the reminder rules need them: no account (`user_id` null) means no app. */
export interface ReminderMember {
  id: string;
  display_name: string;
  user_id: string | null;
}

/** Who gets a reminder: on the event (FR-003), or because they chose "All family events". */
export interface ReminderRecipient {
  memberId: string;
  via: 'event' | 'all';
}

type Placed = Pick<CalendarEvent, 'starts_on' | 'time_type' | 'slots' | 'start_time' | 'end_time'>;
type Peopled = Pick<CalendarEvent, 'members' | 'responsible_member_id' | 'visibility' | 'creator_member_id' | 'surprise'>;

const MORNING = '07:30';
const EARLY = '08:30';
const EVENING = '18:00';

/**
 * FR-002: when an occurrence's reminder goes out, as a date and "HH:MM" in the home time zone.
 * A slot event starts at its slot's start; an all-day event reminds "Morning of" for the minutes
 * and hour choices.
 */
export function reminderAt(o: Placed, kind: ReminderKind, slotTimes: SlotTimes = DEFAULT_SLOT_TIMES): { date: string; time: string } {
  if (kind === 'day_before') return { date: addDays(o.starts_on, -1), time: EVENING };
  const start = timeRange(o, slotTimes)?.start;
  if (!start) return { date: o.starts_on, time: MORNING };
  if (kind === 'morning_of' && start >= EARLY) return { date: o.starts_on, time: MORNING };
  const at = toMinutes(start) - (kind === 'minutes_15' ? 15 : 60);
  return at < 0 ? { date: addDays(o.starts_on, -1), time: fromMinutes(at + 24 * 60) } : { date: o.starts_on, time: fromMinutes(at) };
}

/**
 * FR-003: who an occurrence reminds. A private event reminds only its owner. Otherwise: the
 * members with the app on it (Everyone is all of them); for a member without the app, whoever
 * takes them, or everyone with the app while nobody's chosen; Others reminds the creator; and the
 * one who drives. Members who chose "All family events" come after (`via: 'all'`). Nobody who
 * doesn't see it in full is reminded: a surprise never reaches the people it's hidden from.
 */
export function reminderRecipients(o: Peopled, members: readonly ReminderMember[]): ReminderRecipient[] {
  const app = members.filter((m) => m.user_id !== null);
  const hasApp = (id: string | null | undefined) => app.some((m) => m.id === id);
  if (o.visibility === 'private') return hasApp(o.creator_member_id) ? [{ memberId: o.creator_member_id, via: 'event' }] : [];
  const on = new Set<string>();
  const everyone = () => app.forEach((m) => on.add(m.id));
  for (const who of o.members) {
    if (who === 'everyone') everyone();
    else if (who === 'others') {
      if (hasApp(o.creator_member_id)) on.add(o.creator_member_id);
    } else if (hasApp(who)) on.add(who);
    else if (members.some((m) => m.id === who)) {
      if (hasApp(o.responsible_member_id)) on.add(o.responsible_member_id as string);
      else everyone();
    }
  }
  if (hasApp(o.responsible_member_id)) on.add(o.responsible_member_id as string);
  // Only people who see it in full (`viewFor`, the app's rule): never a surprise's hidden person,
  // and nobody but its creator when the surprise lost its cover or its creator left (Busy).
  const event = { ...o, view: undefined } as CalendarEvent;
  return app
    .filter((m) => viewFor(event, m.id).view === 'full')
    .map((m): ReminderRecipient => ({ memberId: m.id, via: on.has(m.id) ? 'event' : 'all' }))
    .sort((a, b) => (a.via === b.via ? 0 : a.via === 'event' ? -1 : 1));
}

/**
 * The Responsible line: "Gabriel takes James" when members without the app are on the event,
 * "Gabriel drives" otherwise; null when nobody is responsible.
 */
export function responsibleLine(responsible: string | null | undefined, eventMembers: readonly EventMember[], members: readonly ReminderMember[]): string | null {
  const driver = members.find((m) => m.id === responsible);
  if (!driver) return null;
  const taken = members.filter((m) => m.user_id === null && eventMembers.includes(m.id)).map((m) => m.display_name);
  return taken.length ? en.takes(driver.display_name, taken) : en.drives(driver.display_name);
}

export interface ReminderTextOptions {
  /** The recipient's clock (spec 029 time format, resolved for their phone). */
  use24h: boolean;
  slotTimes?: SlotTimes;
  members: readonly ReminderMember[];
}

type Told = Placed & Pick<CalendarEvent, 'title' | 'location' | 'members' | 'responsible_member_id'>;

/**
 * FR-004: the notification's title and body for one recipient (design/ui/OC-Notifications.md).
 * The body drops empty parts; "Morning of" names who it's for, unless it's only the recipient.
 */
export function reminderText(o: Told, kind: ReminderKind, recipientId: string, { use24h, slotTimes = DEFAULT_SLOT_TIMES, members }: ReminderTextOptions): { title: string; body: string } {
  const w = en.reminders;
  const start = timeRange(o, slotTimes)?.start ?? null;
  const when = timeLabel(o, { use24h, slotTimes });
  const responsible = responsibleLine(o.responsible_member_id, o.members, members);
  const body = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join(' · ');
  if (kind === 'day_before') return { title: w.tomorrow(o.title), body: body(when, en.weekdays[weekday(o.starts_on)], o.location, responsible) };
  if (start && kind !== 'morning_of') return { title: w[kind](o.title), body: body(when, o.location, responsible) };
  const slot = start ? slotStartingAt(start, slotTimes) : null;
  const title = !start ? w.today(o.title) : slot ? w.inSlot[slot](o.title) : w.at(o.title, formatTime(start, use24h));
  const onlyMe = o.members.length === 1 && o.members[0] === recipientId;
  const names = onlyMe
    ? null
    : en.list(o.members.flatMap((who) => (who === 'everyone' ? [en.everyone] : who === 'others' ? [] : (members.find((m) => m.id === who)?.display_name ?? []))));
  return { title, body: body(names, o.location, responsible) };
}

/** An event the notifier may remind about, as `reminder_candidates` gives it. */
export interface ReminderEvent extends CalendarEvent {
  family_id: string;
  reminder: ReminderKind;
  exceptions: EventException[];
  created_at: string;
}

export interface ReminderFamily {
  /** Null until a device claims it (spec 035): no reminders go out before. */
  timeZone: string | null;
  slotTimes: SlotTimes;
  members: readonly ReminderMember[];
}

/** One reminder to send now: an occurrence, the instant it was due and who gets it. */
export interface DueReminder {
  occurrence: Occurrence & { location?: string | null };
  familyId: string;
  kind: ReminderKind;
  at: Date;
  recipients: ReminderRecipient[];
}

/** A reminder goes out at most this long before its time (the notifier runs every minute). */
const EARLY_MS = 30_000;
/** Edge case: after the server was down, a reminder this late is skipped. */
const LATE_MS: Record<ReminderKind, number> = { minutes_15: 30 * 60_000, hour_before: 30 * 60_000, morning_of: 30 * 60_000, day_before: 2 * 3_600_000 };

/**
 * FR-005: the reminders due at `now`, every occurrence placed by `expand` (exceptions respected).
 * Skipped: families without a home time zone, events added after their reminder time, reminders
 * too late, and occurrences nobody would get. Events the engine can't place are skipped too.
 */
export function remindersDue(events: readonly ReminderEvent[], families: ReadonlyMap<string, ReminderFamily>, now: Date): DueReminder[] {
  const due: DueReminder[] = [];
  for (const event of events) {
    const family = families.get(event.family_id);
    if (!family?.timeZone) continue;
    const today = todayIn(family.timeZone, now);
    let occurrences: Occurrence[];
    try {
      occurrences = expand(event, addDays(today, -1), addDays(today, 2), event.exceptions);
    } catch {
      continue;
    }
    for (const occurrence of occurrences) {
      const { date, time } = reminderAt(occurrence, event.reminder, family.slotTimes);
      const at = zonedInstant(date, time, family.timeZone);
      const early = at.getTime() - now.getTime();
      if (early > EARLY_MS || -early > LATE_MS[event.reminder]) continue;
      if (new Date(event.created_at).getTime() > at.getTime()) continue;
      const recipients = reminderRecipients(occurrence, family.members);
      if (recipients.length) due.push({ occurrence, familyId: event.family_id, kind: event.reminder, at, recipients });
    }
  }
  return due;
}
