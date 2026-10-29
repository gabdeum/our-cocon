import { z } from 'zod';
import { CalendarError, calendarWordsEn, dateLabel, expand, rangeLabel, timeLabel, todayIn, viewFor, type SlotTimes } from '@cocon/calendar';
import { loadCalendarSettings, loadEvents, type StoredEvent } from '@cocon/data';
import { normaliseName, type EventMember, type MemberColor } from '@cocon/schemas';
import { CalendarDate } from '@cocon/schemas/calendar';
import { ToolError, type ToolContext } from '../../src/tools.js';
import { addedBy } from '../recipes/shared.js';

/** A family member as the calendar tools name them. */
export interface CalendarMember {
  id: string;
  user_id: string | null;
  name: string;
  color: MemberColor;
}

/**
 * The family's calendar as the caller sees it: who's in it, the caller's own member id, the
 * family's slot times, and "today" in the home time zone, so assistants and the app agree.
 */
export interface Calendar {
  members: CalendarMember[];
  me: string;
  slotTimes: SlotTimes;
  timeZone: string;
  today: string;
}

export async function loadCalendar(ctx: Pick<ToolContext, 'db' | 'userId'>): Promise<Calendar> {
  const [members, settings] = await Promise.all([ctx.db.from('members').select('id, user_id, display_name, color').order('joined_at'), loadCalendarSettings(ctx.db)]);
  if (members.error) throw members.error;
  const list = members.data.map((m) => ({ id: m.id, user_id: m.user_id, name: m.display_name, color: m.color }));
  // Until the first device sets the home time zone (claim_home_time_zone), UTC.
  const timeZone = settings.homeTimeZone ?? 'UTC';
  return { members: list, me: list.find((m) => m.user_id === ctx.userId)?.id ?? '', slotTimes: settings.slotTimes, timeZone, today: todayIn(timeZone) };
}

/** An event's page in the app, on one of its dates. */
export const eventLink = (ctx: Pick<ToolContext, 'appUrl'>, id: string, date: string) => `${ctx.appUrl}/calendar/${id}?date=${date}`;

export const EventId = z.uuid({ error: 'Use an event id from list_events or get_day.' }).describe('The event’s id, from list_events or get_day.');
export const Day = CalendarDate.describe('A day, YYYY-MM-DD, in the family’s time zone (list_members gives today).');

const sameName = (a: string, b: string) => normaliseName(a) === normaliseName(b);

/**
 * Who a word means: a member's id, a name ("James", or a first name), `everyone` or `others`.
 * Unknown or ambiguous names get the sentence that tells the assistant what to do.
 */
export function memberRef(cal: Calendar, value: string): EventMember {
  const word = value.trim();
  if (sameName(word, 'everyone')) return 'everyone';
  if (sameName(word, 'others')) return 'others';
  return member(cal, word).id;
}

/** A member by id or name. */
export function member(cal: Calendar, value: string): CalendarMember {
  const word = value.trim();
  const byId = cal.members.find((m) => m.id === word);
  if (byId) return byId;
  let found = cal.members.filter((m) => sameName(m.name, word));
  if (found.length === 0) found = cal.members.filter((m) => sameName(m.name.split(/\s+/)[0] ?? '', word));
  const [only] = found;
  if (!only) throw new ToolError(`Nobody called '${word}' is in the family. Use list_members to see who is.`);
  if (found.length > 1) throw new ToolError(`Several members are called '${word}': ${found.map((m) => `${m.name} (id ${m.id})`).join(', ')}. Ask which one, then send their id.`);
  return only;
}

const nameOf = (cal: Calendar, who: EventMember) => (who === 'everyone' ? 'Everyone' : who === 'others' ? 'Others' : (cal.members.find((m) => m.id === who)?.name ?? null));

/** "every week on Saturday", "every month", "every year, 10 times", "every 2 weeks on Monday, until Dec 18". */
function repeatWords(r: NonNullable<StoredEvent['recurrence']>): string {
  const days = r.weekdays?.map((d) => calendarWordsEn.weekdays[d]).join(' and ');
  const every = { daily: 'every day', weekly: 'every week', biweekly: 'every 2 weeks', monthly: 'every month', yearly: 'every year' }[r.freq];
  const on = days && (r.freq === 'weekly' || r.freq === 'biweekly') ? ` on ${days}` : '';
  const ends = r.ends.type === 'on' ? `, until ${dateLabel(r.ends.date)}` : r.ends.type === 'after' ? `, ${r.ends.count} times` : '';
  return `${every}${on}${ends}`;
}

/**
 * One date of an event, as an assistant reads it (spec 044, 032-later L106): only what an answer
 * needs. Never how the database masked it: a private event someone else added is "Busy" with its
 * day, time and people; a surprise kept from this member is its cover, like any family event; the
 * people in on a surprise are told who it's kept from, so they don't spoil it.
 */
export function shownOccurrence(o: StoredEvent & { occurrence_date?: string }, cal: Calendar, ctx: Pick<ToolContext, 'appUrl'>) {
  const v = viewFor(o, cal.me);
  const who = [...o.members.flatMap((m) => nameOf(cal, m) ?? []), ...o.removed_members];
  const date = o.occurrence_date ?? o.starts_on;
  const base = {
    id: o.id,
    date,
    ...(o.starts_on !== date ? { shows_on: o.starts_on } : {}),
    ...(o.ends_on !== o.starts_on ? { until: o.ends_on } : {}),
    when: timeLabel(o, { use24h: true, slotTimes: cal.slotTimes }),
    time: rangeLabel(o, { use24h: true, slotTimes: cal.slotTimes }),
    who,
  };
  if (v.view !== 'full') return { ...base, title: calendarWordsEn.busy };
  const managed = o.members.flatMap((m) => cal.members.find((x) => x.id === m && x.user_id === null) ?? []);
  const taker = o.responsible_member_id ? cal.members.find((m) => m.id === o.responsible_member_id) : null;
  const hiddenFrom = o.visibility === 'surprise' ? (o.surprise?.hidden_from ?? []).flatMap((id) => nameOf(cal, id) ?? []) : [];
  const checklist = (o.checklist ?? []).map((c) => ({ label: c.label, done: c.done }));
  return {
    ...base,
    title: o.title,
    ...(taker && managed.length ? { takes: `${taker.name} takes ${managed.map((m) => m.name).join(' and ')}` } : {}),
    ...(o.location ? { location: o.location } : {}),
    ...(o.notes ? { notes: o.notes } : {}),
    ...(o.category ? { type: o.category } : {}),
    ...(o.recurrence ? { repeats: repeatWords(o.recurrence) } : {}),
    ...(checklist.length ? { checklist } : {}),
    ...(o.visibility === 'private' ? { private: true } : {}),
    ...(hiddenFrom.length ? { kept_secret_from: hiddenFrom } : {}),
    added_by: addedBy(o.created_by, o.source, cal.members.flatMap((m) => (m.user_id ? [{ user_id: m.user_id, display_name: m.name }] : []))),
    link: eventLink(ctx, o.id, date),
  };
}

/** Every date of the family's events between `from` and `to`, sorted by day and time, as the caller may see them. */
export async function occurrences(ctx: Pick<ToolContext, 'db'>, from: string, to: string): Promise<(StoredEvent & { occurrence_date: string })[]> {
  const events = await loadEvents(ctx.db, from, to);
  return events.flatMap((e) => {
    try {
      return expand(e, from, to, e.exceptions).map((o) => ({ ...e, ...o, category: o.category as StoredEvent['category'] }));
    } catch {
      // An event the engine can't place shouldn't hide the rest of the calendar.
      return [];
    }
  });
}

/** "Tuesday, Oct 27". */
export const dayName = (date: string) => dateLabel(date, 'long');

/** One plain sentence for what went wrong saving or deleting an event, when the assistant can act on it. */
export function eventFailure(error: unknown): never {
  if (error instanceof CalendarError) throw new ToolError(`${error.message.replace(/\.$/, '')}. Change it and try again.`);
  const e = error as { code?: unknown; message?: unknown; hint?: unknown } | null;
  const message = typeof e?.message === 'string' ? e.message : '';
  if (message === 'only_creator_changes_visibility') throw new ToolError('Only the person who added this event can change who sees it.');
  if (message === 'responsible_needs_app') throw new ToolError('Only someone with the app can take someone to an event. Pick a member with the app.');
  if (message === 'hidden_from_needs_app') throw new ToolError('A surprise can only be kept from someone with the app.');
  if (message === 'hidden_from_creator') throw new ToolError('A surprise can’t be kept from the person adding it.');
  // A private event or a surprise the member can't see: the same words either way, so nothing hints at a surprise.
  if (e?.code === 'P0002' || message === 'event_not_found' || (e?.code === '42501' && message.includes('row-level security'))) throw new ToolError(cantChange);
  throw error;
}

export const cantChange = 'Only the person who added this event can change it.';
export const notInCalendar = 'That event isn’t in the calendar any more. Use list_events to find it.';
