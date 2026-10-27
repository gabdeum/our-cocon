import { z } from 'zod';

/**
 * Spec 034: the calendar's building blocks, shared by `@cocon/calendar`, the app and the MCP
 * server; spec 035 adds the event create and update schemas on top of these. Limits match the
 * calendar tables (supabase/migrations/*_calendar_events.sql).
 */

/** A calendar day in the family's home time zone (FR-008). */
export const CalendarDate = z.iso.date();
/** A wall-clock time; "24:00" only ends a day. */
export const ClockTime = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$|^24:00$/);

/** FR-002: the five family slots, in day order. There is no Night slot. */
export const SLOT_KEYS = ['early_morning', 'morning', 'lunch', 'afternoon', 'evening'] as const;
export const SlotKey = z.enum(SLOT_KEYS);
export type SlotKey = z.infer<typeof SlotKey>;

export const TimeType = z.enum(['slot', 'all_day', 'custom']);
export type TimeType = z.infer<typeof TimeType>;

/** Spec 043: Family (default), Private ("Busy" for others) or Surprise (hidden from someone). */
export const Visibility = z.enum(['family', 'private', 'surprise']);
export type Visibility = z.infer<typeof Visibility>;

/** Who an event is for: a member id, Everyone (counts as every member) or Others (no names). */
export const EventMember = z.union([z.uuid(), z.literal('everyone'), z.literal('others')]);
export type EventMember = z.infer<typeof EventMember>;

/** Spec 036: the calendar's four views, in the header's order. */
export const CALENDAR_VIEWS = ['month', 'week', 'day', 'agenda'] as const;
export const CalendarView = z.enum(CALENDAR_VIEWS);
export type CalendarView = z.infer<typeof CalendarView>;

/** Spec 041's Type choices. A birthday is a yearly all-day event (spec 035 FR-006). */
export const EVENT_CATEGORIES = ['sport', 'school', 'work', 'health', 'social', 'travel', 'home', 'birthday', 'other'] as const;
export const EventCategory = z.enum(EVENT_CATEGORIES);
export type EventCategory = z.infer<typeof EventCategory>;

/** Spec 041's Reminder choices (shown on Home for now). */
export const Reminder = z.enum(['none', 'morning_of', 'hour_before', 'day_before']);
export type Reminder = z.infer<typeof Reminder>;

/** 0 = Sunday … 6 = Saturday. */
export const Weekday = z.int().min(0).max(6);

/**
 * FR-004: how an event repeats (the `events.recurrence` jsonb). Weekly and Every 2 weeks take
 * the chosen weekdays (the start day's weekday when none are given). Ends never, on a date, or
 * after a number of times.
 */
export const RecurrenceEnds = z.discriminatedUnion('type', [
  z.object({ type: z.literal('never') }),
  z.object({ type: z.literal('on'), date: CalendarDate }),
  z.object({ type: z.literal('after'), count: z.int().min(1).max(1000) }),
]);
export const Recurrence = z
  .object({
    freq: z.enum(['daily', 'weekly', 'biweekly', 'monthly', 'yearly']),
    weekdays: z.array(Weekday).min(1).max(7).optional(),
    ends: RecurrenceEnds,
  })
  .refine((r) => r.weekdays === undefined || r.freq === 'weekly' || r.freq === 'biweekly', {
    message: 'Only weekly repeats take weekdays',
    path: ['weekdays'],
  });
export type Recurrence = z.infer<typeof Recurrence>;

/**
 * A "this event only" change (event_exceptions, spec 035). Strict: an occurrence can't change who
 * created the event, its visibility or its surprise, so an override never unlocks hidden details.
 */
export const EventOverride = z.strictObject({
  title: z.string().trim().min(1).max(60),
  category: EventCategory.nullable(),
  location: z.string().max(200).nullable(),
  notes: z.string().max(2000).nullable(),
  starts_on: CalendarDate,
  ends_on: CalendarDate,
  time_type: TimeType,
  slots: z.array(SlotKey).max(SLOT_KEYS.length),
  start_time: ClockTime.nullable(),
  end_time: ClockTime.nullable(),
  members: z.array(EventMember).min(1).max(50),
  responsible_member_id: z.uuid().nullable(),
}).partial();
export type EventOverride = z.infer<typeof EventOverride>;

export const EventException = z
  .strictObject({
    occurrence_date: CalendarDate,
    cancelled: z.boolean().optional(),
    override: EventOverride.nullable().optional(),
  })
  .refine((x) => x.cancelled === true || x.override != null, { message: 'An exception cancels the occurrence or changes it' });
export type EventException = z.infer<typeof EventException>;

/**
 * Who an event is for (spec 041 FR-003): each once; Everyone replaces individual members, Others
 * goes with anything.
 */
export const EventMembers = z
  .array(EventMember)
  .min(1)
  .max(50)
  .refine((members) => new Set(members).size === members.length, { message: 'Each member once' })
  .refine((members) => !members.includes('everyone') || members.every((m) => m === 'everyone' || m === 'others'), {
    message: 'Everyone replaces individual members',
  });

/** A surprise (spec 043): who it's kept from (people with the app), and what they see instead. */
export const SurpriseCover = z.strictObject({
  hidden_from: z.array(z.uuid()).min(1).max(20),
  cover_title: z.string().trim().min(1).max(60),
  cover_note: z.string().trim().min(1).max(200).nullable().optional(),
});
export type SurpriseCover = z.infer<typeof SurpriseCover>;

/** An event's checklist, in order; items with an id are kept (and stay ticked). */
export const ChecklistInput = z
  .array(z.strictObject({ id: z.uuid().optional(), label: z.string().trim().min(1).max(80), done: z.boolean().optional() }))
  .max(50);
export type ChecklistInput = z.infer<typeof ChecklistInput>;

const eventFields = {
  title: z.string().trim().min(1).max(60),
  category: EventCategory.nullable().optional(),
  location: z.string().trim().min(1).max(200).nullable().optional(),
  notes: z.string().trim().min(1).max(2000).nullable().optional(),
  starts_on: CalendarDate,
  ends_on: CalendarDate,
  time_type: TimeType,
  slots: z.array(SlotKey).max(SLOT_KEYS.length).optional(),
  // "24:00" only ends a day.
  start_time: ClockTime.refine((t) => t !== '24:00').nullable().optional(),
  end_time: ClockTime.nullable().optional(),
  recurrence: Recurrence.nullable().optional(),
  reminder: Reminder.optional(),
  members: EventMembers,
  responsible_member_id: z.uuid().nullable().optional(),
  visibility: Visibility.optional(),
  /** Null or left out: unchanged (only the creator sets it up). */
  surprise: SurpriseCover.nullable().optional(),
  /** Left out: unchanged. */
  checklist: ChecklistInput.optional(),
};

type EventFields = { [K in keyof typeof eventFields]?: z.infer<(typeof eventFields)[K]> };

/** The rules between fields, on whichever of them are given (so a patch is checked too). */
function checkEvent(e: EventFields, ctx: z.RefinementCtx): void {
  const issue = (message: string, path: string) => ctx.addIssue({ code: 'custom', message, path: [path] });
  if (e.starts_on && e.ends_on && e.ends_on < e.starts_on) issue('It ends before it starts', 'ends_on');
  const slots = e.slots?.length ?? 0;
  const times = e.start_time != null || e.end_time != null;
  if (e.time_type === 'slot' && (slots === 0 || times)) issue('A time of day needs a slot and no times', 'slots');
  if (e.time_type === 'custom' && (slots > 0 || e.start_time == null || e.end_time == null)) issue('Custom needs a start and an end time', 'start_time');
  if (e.time_type === 'all_day' && (slots > 0 || times)) issue('All day has no slot or time', 'time_type');
  if (e.surprise && e.visibility !== 'surprise') issue('Only a surprise has a cover', 'surprise');
  if (e.category === 'birthday' && (e.time_type !== 'all_day' || e.recurrence?.freq !== 'yearly')) {
    issue('A birthday repeats every year, all day', 'category');
  }
}

/** A new event, or a whole event as it's saved (FR-005: the app and the MCP server use it). */
export const EventInput = z.strictObject(eventFields).superRefine((e, ctx) => {
  checkEvent(e, ctx);
  if (e.visibility === 'surprise' && !e.surprise) ctx.addIssue({ code: 'custom', message: 'A surprise needs a cover', path: ['surprise'] });
});
export type EventInput = z.infer<typeof EventInput>;

/** Some fields of an event (an assistant's update, spec 044), merged into it before saving. */
export const EventPatch = z.strictObject(eventFields).partial().superRefine(checkEvent);
export type EventPatch = z.infer<typeof EventPatch>;

/** A slot's hours, "HH:MM" in the home time zone (family_calendar_settings). */
const SlotHours = z.strictObject({ start: ClockTime, end: ClockTime });
export const SlotTimes = z.strictObject({
  early_morning: SlotHours,
  morning: SlotHours,
  lunch: SlotHours,
  afternoon: SlotHours,
  evening: SlotHours,
});
export type SlotTimes = z.infer<typeof SlotTimes>;

/** The family's home time zone, an IANA name ("Europe/Paris"); the database checks it exists. */
export const TimeZone = z.string().regex(/^[A-Za-z][A-Za-z0-9_+-]*(?:\/[A-Za-z0-9_+-]+){0,2}$/).max(64);

/** Spec 029 Calendar page, For you. */
export const WeekStartSetting = z.enum(['automatic', 'sunday', 'monday']);
export type WeekStartSetting = z.infer<typeof WeekStartSetting>;
export const TimeFormatSetting = z.enum(['automatic', '24h', '12h']);
export type TimeFormatSetting = z.infer<typeof TimeFormatSetting>;
