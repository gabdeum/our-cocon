import { z } from 'zod';

/**
 * Spec 034: the calendar's building blocks, shared by `@cocon/calendar`, the app and the MCP
 * server. Spec 035 adds the event create and update schemas on top of these.
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
  category: z.string().max(40).nullable(),
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

export const EventException = z.strictObject({
  occurrence_date: CalendarDate,
  cancelled: z.boolean().optional(),
  override: EventOverride.nullable().optional(),
});
export type EventException = z.infer<typeof EventException>;

/** Spec 029 Calendar page, For you. */
export const WeekStartSetting = z.enum(['automatic', 'sunday', 'monday']);
export type WeekStartSetting = z.infer<typeof WeekStartSetting>;
export const TimeFormatSetting = z.enum(['automatic', '24h', '12h']);
export type TimeFormatSetting = z.infer<typeof TimeFormatSetting>;
