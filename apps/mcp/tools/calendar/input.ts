import { z } from 'zod';
import { addDays, daysBetween } from '@cocon/calendar';
import { EventCategory, RecurrenceEnds, Reminder, SlotKey, Visibility, Weekday, ClockTime, type EventInput } from '@cocon/schemas/calendar';
import { ToolError } from '../../src/tools.js';
import { Day, member, memberRef, type Calendar } from './shared.js';

/**
 * The event fields assistants send (spec 044 FR-001), built from the shared schemas' pieces and
 * turned into the app's `EventInput`, which `saveEvent` checks again with the calendar engine.
 */
const Who = z.string().trim().min(1).max(80);

export const fields = {
  title: z.string().trim().min(1).max(60).describe('Short, as the family would write it: "Football", "Pediatrician".'),
  date: Day.describe('The day it happens (its first day), YYYY-MM-DD.'),
  end_date: Day.optional().describe('Its last day, for something over several days (a trip).'),
  slots: z
    .array(SlotKey)
    .min(1)
    .max(5)
    .optional()
    .describe('Preferred: when in the day, as one or more slots next to each other (early_morning, morning, lunch, afternoon, evening). Use these unless the member gave a time.'),
  start_time: ClockTime.optional().describe('Only when the member gave a time: "16:30" (24-hour). Send end_time too.'),
  end_time: ClockTime.optional().describe('When it ends, "17:30". With start_time. Not given? Estimate it: an appointment 30–60 min, a class or a match 1–2 h, a meal out 2 h.'),
  all_day: z.literal(true).optional().describe('true for an all-day event (a birthday, a holiday).'),
  members: z
    .array(Who)
    .min(1)
    .max(20)
    .describe('Who it’s for: names or ids from list_members, "everyone" (the whole family) or "others" (people outside the family).'),
  responsible: Who.optional().describe('Who takes the members without the app (has_app false): someone with the app. Left out, it’s the member you’re talking to.'),
  repeat: z
    .strictObject({
      freq: z.enum(['daily', 'weekly', 'biweekly', 'monthly', 'yearly']).describe('biweekly: every 2 weeks.'),
      weekdays: z.array(Weekday).min(1).max(7).optional().describe('For weekly and biweekly: the days, 0 = Sunday … 6 = Saturday. Leave out for the first day’s weekday.'),
      ends: RecurrenceEnds.optional().describe('{type: "never"} (default), {type: "on", date}, or {type: "after", count}.'),
    })
    .optional()
    .describe('How it repeats. Leave out for a one-off event.'),
  location: z.string().trim().min(1).max(200).optional().describe('The place or full address, as the member would type it. Line breaks are kept.'),
  notes: z.string().trim().min(1).max(2000).optional(),
  type: EventCategory.optional().describe('What kind of event it is. A birthday is all day and repeats every year.'),
  reminder: Reminder.optional().describe(
    'When to remind on their phones: none, minutes_15, hour_before, morning_of (07:30, or an hour before an early start) or day_before (18:00 the evening before). Leave out to use the member’s default.',
  ),
  checklist: z
    .array(z.string().trim().min(1).max(80))
    .min(1)
    .max(50)
    .optional()
    .describe('What to bring or do, one short item each: ["Water bottle", "Shin pads"]. Anyone in the family can tick them in the app.'),
  visibility: Visibility.optional().describe('family (default: everyone sees it), private (others see "Busy"), or surprise (kept from some members, who see a cover instead).'),
  surprise: z
    .strictObject({
      hidden_from: z.array(Who).min(1).max(20).describe('Who it’s kept from: members with the app.'),
      cover_title: z.string().trim().min(1).max(60).describe('What they see instead: "Dinner out".'),
      cover_note: z.string().trim().min(1).max(200).optional().describe('A note they see with the cover: "Dress nice!".'),
    })
    .optional()
    .describe('For a surprise: who it’s kept from and the cover they see.'),
};

type Fields = { [K in keyof typeof fields]?: z.output<(typeof fields)[K]> };

/** Patches can clear a field: `null` removes the place, the notes, the repeat or who takes them. */
export const patchFields = {
  ...fields,
  responsible: fields.responsible
    .unwrap()
    .nullable()
    .optional()
    .describe('Who takes the members without the app: someone with the app, or null to clear. Left out, the current one stays; people without the app added with nobody taking them get the member you’re talking to.'),
  repeat: fields.repeat.unwrap().nullable().optional(),
  location: fields.location.unwrap().nullable().optional(),
  notes: fields.notes.unwrap().nullable().optional(),
  type: fields.type.unwrap().nullable().optional(),
  checklist: z
    .array(z.string().trim().min(1).max(80))
    .max(50)
    .nullable()
    .optional()
    .describe('The whole checklist as it should be, in order: items already on it stay ticked (a repeating event changed from a date on starts unticked, as in the app). null or [] clears it.'),
};
export type Patch = { [K in keyof typeof patchFields]?: z.output<(typeof patchFields)[K]> };

/** The labels as checklist items: one that was already on the list keeps its id, so it stays ticked. */
function checklistOf(labels: string[], before: EventInput['checklist'] = []): NonNullable<EventInput['checklist']> {
  const left = [...before];
  return labels.map((label) => {
    const i = left.findIndex((c) => c.id && c.label.toLowerCase() === label.toLowerCase());
    const [kept] = i === -1 ? [] : left.splice(i, 1);
    return kept ? { id: kept.id, label } : { label };
  });
}

/** The time fields from slots, custom times or all day: exactly one of them. */
function timeOf(f: Pick<Fields, 'slots' | 'start_time' | 'end_time' | 'all_day'>): Pick<EventInput, 'time_type' | 'slots' | 'start_time' | 'end_time'> | null {
  const given = [f.slots !== undefined, f.start_time !== undefined || f.end_time !== undefined, f.all_day === true].filter(Boolean).length;
  if (given === 0) return null;
  if (given > 1) throw new ToolError('Send only one of slots, start_time and end_time, or all_day.');
  if (f.all_day) return { time_type: 'all_day', slots: [], start_time: null, end_time: null };
  if (f.slots) return { time_type: 'slot', slots: f.slots, start_time: null, end_time: null };
  if (!f.start_time || !f.end_time) throw new ToolError('Send both start_time and end_time, or slots instead.');
  return { time_type: 'custom', slots: [], start_time: f.start_time, end_time: f.end_time };
}

const recurrenceOf = (r: NonNullable<Fields['repeat']>): NonNullable<EventInput['recurrence']> => ({
  freq: r.freq,
  ...(r.weekdays && (r.freq === 'weekly' || r.freq === 'biweekly') ? { weekdays: [...new Set(r.weekdays)].sort((a, b) => a - b) } : {}),
  ends: r.ends ?? { type: 'never' },
});

/**
 * Who takes the members without the app: only while one is on it (as the app's sheet keeps it).
 * Not sent (`undefined`): the member talking to the assistant (spec 055 FR-007); `null` clears it.
 */
function responsibleOf(cal: Calendar, members: EventInput['members'], value: string | null | undefined): string | null {
  if (!value) return null;
  const taker = member(cal, value);
  if (taker.user_id === null) throw new ToolError(`${taker.name} doesn’t have the app, so can’t take anyone. Pick someone with the app.`);
  const managed = members.some((m) => cal.members.some((x) => x.id === m && x.user_id === null));
  return managed ? taker.id : null;
}

function surpriseOf(cal: Calendar, s: NonNullable<Fields['surprise']>): NonNullable<EventInput['surprise']> {
  const hidden = s.hidden_from.map((name) => member(cal, name));
  const noApp = hidden.find((m) => m.user_id === null);
  if (noApp) throw new ToolError(`A surprise can only be kept from someone with the app, and ${noApp.name} doesn’t have it.`);
  if (hidden.some((m) => m.id === cal.me)) throw new ToolError('A surprise can’t be kept from the person adding it.');
  return { hidden_from: [...new Set(hidden.map((m) => m.id))], cover_title: s.cover_title, cover_note: s.cover_note ?? null };
}

/** A new event from what the assistant sent. */
export function newEventInput(cal: Calendar, f: Fields & Pick<Required<Fields>, 'title' | 'date' | 'members'>): EventInput {
  const time = timeOf(f);
  if (!time) throw new ToolError('Say when: slots (preferred), start_time and end_time, or all_day.');
  if (f.end_date && f.end_date < f.date) throw new ToolError('end_date is before date. Check the days and try again.');
  if (f.surprise && f.visibility !== 'surprise') throw new ToolError('Send visibility "surprise" with a surprise.');
  if (f.visibility === 'surprise' && !f.surprise) throw new ToolError('A surprise needs who it’s kept from and a cover title (surprise).');
  const members = [...new Set(f.members.map((m) => memberRef(cal, m)))];
  const recurrence = f.repeat ? recurrenceOf(f.repeat) : null;
  return {
    title: f.title,
    category: f.type ?? null,
    location: f.location ?? null,
    notes: f.notes ?? null,
    starts_on: f.date,
    ends_on: f.end_date ?? f.date,
    ...time,
    recurrence,
    reminder: f.reminder ?? cal.defaultReminder,
    members,
    responsible_member_id: responsibleOf(cal, members, f.responsible ?? cal.me),
    visibility: f.visibility ?? 'family',
    surprise: f.surprise ? surpriseOf(cal, f.surprise) : null,
    ...(f.checklist ? { checklist: checklistOf(f.checklist) } : {}),
  };
}

/**
 * An event with the assistant's changes: `before` is the date being changed, as saved. Moving the
 * day keeps its length unless end_date says otherwise.
 */
export function patchedInput(cal: Calendar, before: EventInput, p: Patch): EventInput {
  const time = timeOf(p);
  const members = p.members ? [...new Set(p.members.map((m) => memberRef(cal, m)))] : before.members;
  const starts = p.date ?? before.starts_on;
  const ends = p.end_date ?? addDays(starts, daysBetween(before.starts_on, before.ends_on));
  if (ends < starts) throw new ToolError('end_date is before date. Check the days and try again.');
  const visibility = p.visibility ?? before.visibility ?? 'family';
  if (p.surprise && visibility !== 'surprise') throw new ToolError('Send visibility "surprise" with a surprise.');
  if (visibility === 'surprise' && !p.surprise && !before.surprise) throw new ToolError('A surprise needs who it’s kept from and a cover title (surprise).');
  const keptTaker = cal.members.find((m) => m.id === before.responsible_member_id);
  return {
    ...before,
    title: p.title ?? before.title,
    category: p.type !== undefined ? p.type : (before.category ?? null),
    location: p.location !== undefined ? p.location : (before.location ?? null),
    notes: p.notes !== undefined ? p.notes : (before.notes ?? null),
    starts_on: starts,
    ends_on: ends,
    ...(time ?? {}),
    recurrence: p.repeat !== undefined ? (p.repeat ? recurrenceOf(p.repeat) : null) : (before.recurrence ?? null),
    reminder: p.reminder ?? before.reminder ?? 'none',
    members,
    // A new list of people without a taker yet gets the member talking to the assistant, as a new event does.
    responsible_member_id: responsibleOf(cal, members, p.responsible !== undefined ? p.responsible : (keptTaker?.id ?? (p.members ? cal.me : undefined))),
    visibility,
    surprise: visibility === 'surprise' ? (p.surprise ? surpriseOf(cal, p.surprise) : (before.surprise ?? null)) : null,
    ...(p.checklist !== undefined ? { checklist: checklistOf(p.checklist ?? [], before.checklist) } : {}),
  };
}
