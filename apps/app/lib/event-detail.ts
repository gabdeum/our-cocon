import { calendarWordsEn, dateLabel, rangeLabel, timeLabel, viewFor, weekday, type CalendarEvent, type SlotTimes } from '@cocon/calendar';
import type { StoredEvent } from '@cocon/data';
import { memberInitials, memberKind, type EventMember } from '@cocon/schemas';
import type { MemberChipColor } from '@cocon/ui';
import { strings } from '../strings/en';
import { minutesSince } from './assistants';
import { assistantName } from './recipe-format';
import type { Member } from './session';

const e = strings.calendar.event;

export { eventOccurrence } from '@cocon/data';

/** Whether this member sees the event itself, not "Busy" (the Busy and surprise pages are spec 043). */
export const seesInFull = (event: StoredEvent, myMemberId: string) => !event.deleted_at && viewFor(event, myMemberId).view === 'full';

/**
 * The When row: "Saturday, Oct 31" over "Morning · about 09:00–12:00" (a slot), "14:30–15:30"
 * (a custom time) or "All day"; a multi-day event's dates: "Sat, Oct 31 – Mon, Nov 2". The shared
 * page (`/e/[token]`) says it the same way.
 */
export function whenLines(o: Pick<CalendarEvent, 'starts_on' | 'ends_on' | 'time_type' | 'slots' | 'start_time' | 'end_time'>, slotTimes: SlotTimes): { title: string; sub: string } {
  const title = o.starts_on === o.ends_on ? dateLabel(o.starts_on, 'long') : e.span(dateLabel(o.starts_on), dateLabel(o.ends_on));
  const range = rangeLabel(o, { use24h: true, slotTimes });
  if (!range) return { title, sub: e.allDay };
  return { title, sub: o.time_type === 'slot' ? e.slotTime(timeLabel(o, { use24h: true, slotTimes }), range) : range };
}

/** The Repeat row: "Every Saturday", "Every Tuesday and Thursday", "Every day"; null for a one-off event. */
export function repeatLine(event: StoredEvent): string | null {
  const r = event.recurrence;
  if (!r) return null;
  if (r.freq !== 'weekly' && r.freq !== 'biweekly') return e.every[r.freq]();
  // A weekly repeat on no particular days falls on the series' first day's weekday.
  const days = (r.weekdays?.length ? [...r.weekdays].sort((x, y) => x - y) : [weekday(event.starts_on)]).map((d) => calendarWordsEn.weekdays[d] ?? '');
  return e.every[r.freq](days);
}

/**
 * The Responsible row: "Gabriel takes James" when members without the app are on the event,
 * "Gabriel drives" otherwise; null when nobody is responsible.
 */
export function responsibleLine(responsible: string | null | undefined, eventMembers: readonly EventMember[], members: readonly Member[]): string | null {
  const driver = members.find((m) => m.id === responsible);
  if (!driver) return null;
  const taken = members.filter((m) => memberKind(m) === 'managed' && eventMembers.includes(m.id)).map((m) => m.display_name);
  return taken.length ? strings.calendar.day.takes(driver.display_name, taken) : e.drives(driver.display_name);
}

/**
 * The Reminder row: "1 hour before" over "Shows on Home for Gabriel": the members with the app on
 * the event (Everyone is all of them), and whoever takes the ones without it ("Gabriel takes
 * James"). Null without a reminder.
 */
export function reminderLines(event: StoredEvent, members: readonly Member[]): { title: string; sub?: string } | null {
  if (!event.reminder || event.reminder === 'none') return null;
  const title = strings.calendar.add.reminders[event.reminder];
  const on = (m: Member) => event.members.includes('everyone') || event.members.includes(m.id) || m.id === event.responsible_member_id;
  const names = members.filter((m) => memberKind(m) === 'account' && on(m)).map((m) => m.display_name);
  return names.length ? { title, sub: e.showsOnHome(names) } : { title };
}

/** "Added by Eva · 2 days ago", or "Added via Claude · 1 h ago" for an assistant's event (FR-006). */
export function addedLine(event: StoredEvent, members: readonly Member[], now: Date = new Date()): string {
  const ago = strings.time.ago(minutesSince(new Date(event.created_at), now));
  const assistant = assistantName(event.source);
  if (assistant) return e.addedVia(assistant, ago);
  return e.addedBy(members.find((m) => m.user_id === event.created_by)?.display_name ?? strings.recipe.formerMember, ago);
}

/** Who the event is for, as badges: members in the event's order, then Everyone and Others. */
export function memberBadges(event: StoredEvent, members: readonly Member[]): { key: string; name: string; initial: string; color: MemberChipColor }[] {
  const initials = memberInitials(members);
  const a = strings.calendar.add;
  return event.members.flatMap((key) => {
    if (key === 'everyone') return [{ key, name: a.everyone, initial: a.everyoneInitial, color: 'everyone' as const }];
    if (key === 'others') return [{ key, name: a.others, initial: '', color: 'others' as const }];
    const m = members.find((x) => x.id === key);
    return m ? [{ key, name: m.display_name, initial: initials.get(m.id) ?? '', color: m.color as MemberChipColor }] : [];
  });
}

/** "Open in Maps": Apple Maps on iPhone, Google Maps elsewhere, searching for the place as typed. */
export function mapsUrl(place: string, os: string): string {
  const q = encodeURIComponent(place);
  return os === 'ios' ? `https://maps.apple.com/?q=${q}` : `https://www.google.com/maps/search/?api=1&query=${q}`;
}

/** The delete Dialog (FR-004): its body, with "{Name} added this." for someone else's event. */
export function deleteBody(event: StoredEvent, myMemberId: string, members: readonly Member[]): string {
  const body = event.recurrence ? e.deleteRepeatBody : e.deleteOneBody;
  const creator = event.creator_member_id !== myMemberId ? members.find((m) => m.id === event.creator_member_id) : undefined;
  return creator ? `${e.addedThis(creator.display_name)} ${body}` : body;
}

/**
 * OC-CalBusy (spec 043): someone else's private event, as the sheet says it: "Eva is busy",
 * "Thursday, Oct 22 · Afternoon" (the slot, the start time or "All day"), and the creator's avatar.
 * `creator` is null when they've left the family ("Someone is busy").
 */
export function busyLines(o: StoredEvent, members: readonly Member[], slotTimes: SlotTimes): { creator: { name: string; initial: string; color: MemberChipColor } | null; when: string } {
  const m = members.find((x) => x.id === o.creator_member_id);
  const when = strings.calendar.busy.when(dateLabel(o.starts_on, 'long'), timeLabel(o, { use24h: true, slotTimes }));
  return { creator: m ? { name: m.display_name, initial: memberInitials(members).get(m.id) ?? '', color: m.color as MemberChipColor } : null, when };
}

/** Whether this member gets a surprise's cover (OC-CalSurprise), as the database masked it. */
export const isCover = (event: StoredEvent, myMemberId: string) => !event.deleted_at && viewFor(event, myMemberId).view === 'cover';
