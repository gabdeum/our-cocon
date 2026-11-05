import { calendarWordsEn, dateLabel, formatTime, rangeLabel, reminderAt, reminderRecipients, timeLabel, viewFor, weekday, type CalendarEvent, type SlotTimes } from '@cocon/calendar';
import type { StoredEvent } from '@cocon/data';
import { memberInitials } from '@cocon/schemas';
import type { MemberChipColor } from '@cocon/ui';
import { strings } from '../strings/en';
import { minutesSince } from './assistants';
import { assistantName } from './recipe-format';
import type { Member } from './session';

const e = strings.calendar.event;

export { eventOccurrence } from '@cocon/data';
export { responsibleLine } from '@cocon/calendar';

/** Whether this member sees the event itself, not "Busy" (the Busy and surprise pages are spec 043). */
export const seesInFull = (event: StoredEvent, myMemberId: string) => !event.deleted_at && viewFor(event, myMemberId).view === 'full';

/**
 * The When row: "Saturday, Oct 31" over "Morning · about 09:00–12:00" (a slot), "14:30–15:30"
 * (a custom time) or "All day"; a multi-day event's dates: "Sat, Oct 31 – Mon, Nov 2". The shared
 * page (`/e/[token]`) says it the same way.
 */
export function whenLines(o: Pick<CalendarEvent, 'starts_on' | 'ends_on' | 'time_type' | 'slots' | 'start_time' | 'end_time'>, slotTimes: SlotTimes, use24h = true): { title: string; sub: string } {
  const title = o.starts_on === o.ends_on ? dateLabel(o.starts_on, 'long') : e.span(dateLabel(o.starts_on), dateLabel(o.ends_on));
  const range = rangeLabel(o, { use24h, slotTimes });
  if (!range) return { title, sub: e.allDay };
  return { title, sub: o.time_type === 'slot' ? e.slotTime(timeLabel(o, { use24h, slotTimes }), range) : range };
}

/** Spec 050 FR-006: the date and time on one line, "Sat, Oct 31" · "Morning, about 09:00–12:00". */
export function whenLine(o: Pick<CalendarEvent, 'starts_on' | 'ends_on' | 'time_type' | 'slots' | 'start_time' | 'end_time'>, slotTimes: SlotTimes, use24h = true): { date: string; time: string } {
  const date = o.starts_on === o.ends_on ? dateLabel(o.starts_on) : e.span(dateLabel(o.starts_on), dateLabel(o.ends_on));
  const range = rangeLabel(o, { use24h, slotTimes });
  if (!range) return { date, time: e.allDay };
  return { date, time: o.time_type === 'slot' ? e.slotTimeInline(timeLabel(o, { use24h, slotTimes }), range) : range };
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
 * The Reminder row (spec 049 FR-006): "1 hour before" over "Reminds Gabriel · 13:30", who it
 * reaches (the same rule as the phones: `reminderRecipients`) and when, in the home time zone.
 * Null without a reminder.
 */
export function reminderLines(o: StoredEvent, members: readonly Member[], slotTimes: SlotTimes, use24h = true): { title: string; sub?: string } | null {
  if (!o.reminder || o.reminder === 'none') return null;
  const title = strings.calendar.add.reminders[o.reminder];
  const names = remindedNames(o, members);
  if (!names.length) return { title };
  const at = reminderAt(o, o.reminder, slotTimes);
  const time = formatTime(at.time, use24h);
  return { title, sub: e.reminds(names, at.date < o.starts_on ? e.dayBefore(time) : time) };
}

/** Who an event reminds because they're on it (FR-003), by name; "All family events" aside. */
export function remindedNames(o: Pick<StoredEvent, 'members' | 'responsible_member_id' | 'visibility' | 'creator_member_id' | 'surprise'>, members: readonly Member[]): string[] {
  const ids = reminderRecipients(o, members).flatMap((r) => (r.via === 'event' ? [r.memberId] : []));
  return members.filter((m) => ids.includes(m.id)).map((m) => m.display_name);
}

/** Whether an event's reminder shows on Home for this member (spec 028 FR-003): the phones' rule. */
export function remindsMember(o: Pick<StoredEvent, 'members' | 'responsible_member_id' | 'visibility' | 'creator_member_id' | 'surprise'>, member: Member, members: readonly Member[]): boolean {
  return reminderRecipients(o, members).some((r) => r.via === 'event' && r.memberId === member.id);
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

/** "Open in Maps": Google Maps, searching for the place as typed. On the iPhone it opens the Google Maps app when installed. */
export function mapsUrl(place: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`;
}

/**
 * The place row's links: "Copy" (the place as typed, to the clipboard, then a toast) and "Open in
 * Maps" ("Maps" on the compact event page).
 */
export function placeActions(
  place: string,
  compact: boolean,
  on: { openUrl: (url: string) => void; copy: (text: string) => Promise<unknown>; toast: (t: { text: string; tone?: 'warn' }) => void },
) {
  const e = strings.calendar.event;
  const copy = () =>
    void on.copy(place).then(
      () => on.toast({ text: e.placeCopied }),
      () => on.toast({ text: e.copyPlaceFailed, tone: 'warn' }),
    );
  return [
    { label: e.copyPlace, accessibilityLabel: e.copyPlaceA11y(place), onPress: copy },
    { label: compact ? e.maps : e.openInMaps, accessibilityLabel: e.openInMapsA11y(place), onPress: () => on.openUrl(mapsUrl(place)) },
  ];
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
export function busyLines(o: StoredEvent, members: readonly Member[], slotTimes: SlotTimes, use24h = true): { creator: { name: string; initial: string; color: MemberChipColor } | null; when: string } {
  const m = members.find((x) => x.id === o.creator_member_id);
  const when = strings.calendar.busy.when(dateLabel(o.starts_on, 'long'), timeLabel(o, { use24h, slotTimes }));
  return { creator: m ? { name: m.display_name, initial: memberInitials(members).get(m.id) ?? '', color: m.color as MemberChipColor } : null, when };
}

/** Whether this member gets a surprise's cover (OC-CalSurprise), as the database masked it. */
export const isCover = (event: StoredEvent, myMemberId: string) => !event.deleted_at && viewFor(event, myMemberId).view === 'cover';
