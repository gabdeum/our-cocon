import { z } from 'zod';
import { CalendarDate, ClockTime, QuietTime, Recurrence } from './calendar';

/**
 * Spec 056: reminders, things to do and tick off (not the event reminders of spec 049, which are
 * `Reminder` in ./calendar). Limits match the `reminders` table (supabase/migrations/*_reminders.sql).
 */

/** FR-008: what happens to an open reminder that's late. `hour` needs a time. */
export const ReminderRollover = z.enum(['hour', 'day', 'week', 'none']);
export type ReminderRollover = z.infer<typeof ReminderRollover>;

/** FR-012: the Reminders screen's sections, in order. */
export const ReminderSection = z.enum(['overdue', 'today', 'tomorrow', 'later', 'snoozed']);
export type ReminderSection = z.infer<typeof ReminderSection>;

/** FR-002: how a closed occurrence ended. */
export const ReminderOccurrenceStatus = z.enum(['done', 'missed', 'skipped']);
export type ReminderOccurrenceStatus = z.infer<typeof ReminderOccurrenceStatus>;

/** FR-007: the snooze choices, in the menu's order. */
export const ReminderSnoozeOption = z.enum(['hour', 'tomorrow', 'week', 'month', 'date']);
export type ReminderSnoozeOption = z.infer<typeof ReminderSnoozeOption>;

/** Where a reminder was ticked or snoozed from (the Tracking table). */
export const ReminderActionSource = z.enum(['home', 'list', 'drawer', 'calendar', 'notification', 'assistant']);
export type ReminderActionSource = z.infer<typeof ReminderActionSource>;

/** Spec 059 FR-001: a reminder notification: 1 hour before, at its time (or 09:00), or a nudge while it's late. */
export const ReminderNotificationKind = z.enum(['before', 'due', 'nudge']);
export type ReminderNotificationKind = z.infer<typeof ReminderNotificationKind>;

/** Spec 059 FR-002: a person's quiet hours, "HH:MM" in the home time zone; the same two times mean none. */
export const QuietHours = z.object({ from: QuietTime, to: QuietTime });
export type QuietHours = z.infer<typeof QuietHours>;
export const DEFAULT_QUIET_HOURS: QuietHours = { from: '22:00', to: '07:00' };

/** Who a reminder is for: a member, or the whole family. */
export const ReminderAssignee = z.union([z.uuid(), z.literal('everyone')]);
export type ReminderAssignee = z.infer<typeof ReminderAssignee>;

export const REMINDER_TITLE_MAX = 80;
export const REMINDER_NOTES_MAX = 1000;

const draftFields = {
  title: z.string().trim().min(1, 'Give your reminder a name.').max(REMINDER_TITLE_MAX, `Keep the name under ${REMINDER_TITLE_MAX} characters.`),
  /** Line breaks are kept (FR-009); blank means no notes. */
  notes: z
    .string()
    .max(REMINDER_NOTES_MAX, `Keep the notes under ${REMINDER_NOTES_MAX} characters.`)
    .transform((n) => (n.trim() === '' ? null : n))
    .nullable()
    .optional(),
  /** The day it's due, in the family's home time zone. */
  due_date: CalendarDate,
  /** Null or left out: any time that day. */
  time: ClockTime.refine((t) => t !== '24:00', 'Pick a time before midnight.').nullable().optional(),
  repeat: Recurrence.nullable().optional(),
  /** Left out: `hour` with a time, `day` without; `hour` without a time becomes `day` (FR-008). */
  rollover: ReminderRollover.optional(),
  assignee: ReminderAssignee.optional(),
};

type DraftFields = { [K in keyof typeof draftFields]?: z.infer<(typeof draftFields)[K]> };

function checkDraft(d: DraftFields, ctx: z.RefinementCtx): void {
  if (d.repeat?.ends.type === 'on' && d.due_date && d.repeat.ends.date < d.due_date) {
    ctx.addIssue({ code: 'custom', message: 'The repeat ends before the reminder is due.', path: ['repeat'] });
  }
}

/** A new reminder, or a whole reminder as it's saved (the app's sheet and the MCP server, spec 060). */
export const ReminderDraft = z.strictObject(draftFields).superRefine(checkDraft);
export type ReminderDraft = z.input<typeof ReminderDraft>;
export type ParsedReminderDraft = z.output<typeof ReminderDraft>;
