import { z } from 'zod';
import { daysBetween, todayIn } from '@cocon/calendar';
import { completeReminder, createReminder, deleteReminder, snoozeReminder, updateReminder, type StoredReminder } from '@cocon/data';
import { toDraft } from '@cocon/reminders';
import { ClockTime, NOTES_MAX, ReminderDraft, ReminderRollover, ReminderSnoozeOption, type ParsedReminderDraft } from '@cocon/schemas';
import { defineTool, ToolError, type ToolContext } from '../../src/tools.js';
import { NOTES_HELP, recurrenceOf, fields as eventFields } from '../calendar/input.js';
import { Day, loadCalendar } from '../calendar/shared.js';
import { assigneeRef, localWhen, ReminderId, reminderFailure, reminderLink, storedReminder } from './shared.js';

type ReminderTool = 'create_reminder' | 'update_reminder' | 'complete_reminder' | 'snooze_reminder' | 'delete_reminder';

const tracked = (ctx: ToolContext, tool: ReminderTool) => ctx.tracker.track('assistant_reminder_action', { tool, assistant: ctx.assistant });

const fields = {
  title: z.string().max(200).describe('What to do, short: "Water the plants". Up to 80 characters.'),
  due_date: Day.describe('The day it’s due, YYYY-MM-DD, in the family’s time zone (list_members gives today). For a repeat, its first date.'),
  time: ClockTime.describe('Only when there’s a time: "09:00" (24-hour). Left out: any time that day.'),
  repeat: eventFields.repeat.unwrap().describe('How it repeats. Leave out for a one-off reminder.'),
  rollover: ReminderRollover.describe(
    'What happens while it’s late: "hour" comes back every hour (needs a time), "day" every morning, "week" a week later, "none" stays in Overdue quietly. Left out: "hour" with a time, "day" without.',
  ),
  assignee: z.string().trim().min(1).max(80).describe('Who it’s for: a name or id from list_members, or "everyone" (the default).'),
  notes: z.string().max(NOTES_MAX).describe(NOTES_HELP),
};

/** FR-004: the app's rules (ReminderDraft), and "every hour" only with a time, said rather than changed. */
function checkedDraft(draft: ParsedReminderDraft | Record<string, unknown>): ParsedReminderDraft {
  const parsed = ReminderDraft.parse(draft);
  if (parsed.rollover === 'hour' && !parsed.time) throw new ToolError('Rollover "hour" needs a time. Add a time, or use rollover "day".');
  return parsed;
}

export const createReminderTool = defineTool({
  name: 'create_reminder',
  title: 'Add a reminder',
  access: 'write',
  needs: 'reminders',
  description: [
    'Add a reminder for the family, as the member would in the app: "Remind me to water the plants every Sunday".',
    'Call list_members first for names and today’s date. Leave out what the member didn’t say: no time means any time that day, no assignee means Everyone.',
    'Put everything worth knowing in notes, as Markdown: details, context, links, steps, a "- [ ] " checklist when there are several things to do or buy, and a table for schedules or comparisons.',
    'It shows straight away in the app as added via you, and the family can correct or undo it. Reply with its link.',
  ].join('\n'),
  input: z.strictObject({
    title: fields.title,
    due_date: fields.due_date,
    time: fields.time.optional(),
    repeat: fields.repeat.optional(),
    rollover: fields.rollover.optional(),
    assignee: fields.assignee.optional(),
    notes: fields.notes.optional(),
  }),
  async run(args, ctx) {
    const cal = await loadCalendar(ctx);
    const draft = checkedDraft({
      title: args.title,
      due_date: args.due_date,
      time: args.time ?? null,
      repeat: args.repeat ? recurrenceOf(args.repeat) : null,
      ...(args.rollover ? { rollover: args.rollover } : {}),
      assignee: args.assignee ? assigneeRef(cal, args.assignee) : 'everyone',
      notes: args.notes ?? null,
    });
    const id = await createReminder(ctx.db, ctx.familyId, draft, cal.timeZone).catch(reminderFailure);
    tracked(ctx, 'create_reminder');
    ctx.tracker.track('reminder_created', {
      has_time: !!draft.time,
      repeating: draft.repeat != null,
      rollover: draft.rollover ?? (draft.time ? 'hour' : 'day'),
      has_notes: !!draft.notes,
      assignee_is_self: draft.assignee === cal.me,
    });
    const stored = await storedReminder(ctx, id);
    return { id, title: stored.title, due: localWhen(stored.due_at, cal.timeZone, stored.has_time), link: reminderLink(ctx, id) };
  },
});

export const updateReminderTool = defineTool({
  name: 'update_reminder',
  title: 'Change a reminder',
  access: 'write',
  needs: 'reminders',
  description: [
    'Change a reminder: send only what changes (null clears the time, the repeat or the notes). due_date moves it; for a repeating reminder, the repeat then counts from that date. notes replaces what was there: send the whole note, keeping what’s still true, with what’s new added in Markdown.',
    'To put it off for a while without changing when it’s due, use snooze_reminder instead.',
  ].join('\n'),
  input: z.strictObject({
    id: ReminderId,
    title: fields.title.optional(),
    due_date: fields.due_date.optional(),
    time: fields.time.nullable().optional(),
    repeat: fields.repeat.nullable().optional(),
    rollover: fields.rollover.optional(),
    assignee: fields.assignee.optional(),
    notes: fields.notes.nullable().optional(),
  }),
  async run({ id, ...patch }, ctx) {
    if (Object.keys(patch).length === 0) throw new ToolError('Nothing to change. Send what changes.');
    const cal = await loadCalendar(ctx);
    const stored = await storedReminder(ctx, id);
    if (stored.completed) throw new ToolError('This reminder is done. Add a new one instead.');
    const before = toDraft(stored, cal.timeZone);
    const draft = checkedDraft({
      ...before,
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.due_date !== undefined ? { due_date: patch.due_date } : {}),
      ...(patch.time !== undefined ? { time: patch.time } : {}),
      ...(patch.repeat !== undefined ? { repeat: patch.repeat ? recurrenceOf(patch.repeat) : null } : {}),
      // A time taken away takes "every hour" with it, unless a rollover is sent (as the app's sheet does).
      ...(patch.rollover !== undefined ? { rollover: patch.rollover } : patch.time === null && before.rollover === 'hour' ? { rollover: 'day' } : {}),
      ...(patch.assignee !== undefined ? { assignee: assigneeRef(cal, patch.assignee) } : {}),
      ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
    });
    await updateReminder(ctx.db, id, draft, cal.timeZone).catch(reminderFailure);
    tracked(ctx, 'update_reminder');
    const after = await storedReminder(ctx, id);
    return {
      id,
      title: after.title,
      changed: Object.keys(patch),
      due: localWhen(after.due_at, cal.timeZone, after.has_time),
      link: reminderLink(ctx, id),
    };
  },
});

/** Whole days late, as the badge counts them (spec 056 FR-006): from the snooze's end, else the due time; "any time" ones from the next day. */
function lateDays(r: Pick<StoredReminder, 'due_at' | 'has_time' | 'snoozed_until'>, tz: string, now = new Date()): number {
  const from = Math.max(Date.parse(r.due_at), r.snoozed_until ? Date.parse(r.snoozed_until) : 0);
  if (r.has_time) return Math.max(0, Math.floor((now.getTime() - from) / 86_400_000));
  return Math.max(0, daysBetween(todayIn(tz, new Date(from)), todayIn(tz, now)));
}

export const completeReminderTool = defineTool({
  name: 'complete_reminder',
  title: 'Tick off a reminder',
  access: 'write',
  needs: 'reminders',
  description: 'Mark a reminder as done. A repeating one moves on to its next date. The family can undo it in the app.',
  input: z.strictObject({ id: ReminderId }),
  async run(args, ctx) {
    const cal = await loadCalendar(ctx);
    const stored = await storedReminder(ctx, args.id);
    const done = await completeReminder(ctx.db, args.id, cal.timeZone).catch(reminderFailure);
    if (!done) throw new ToolError('This reminder is already done.');
    tracked(ctx, 'complete_reminder');
    ctx.tracker.track('reminder_completed', { repeating: done.repeating, late_days: Math.min(lateDays(stored, cal.timeZone), 3660), source: 'assistant' });
    return {
      done: stored.title,
      ...(done.nextDueAt ? { next_due: localWhen(done.nextDueAt, cal.timeZone, stored.has_time) } : {}),
      link: reminderLink(ctx, args.id),
    };
  },
});

const SnoozeFor = ReminderSnoozeOption.exclude(['date']);

export const snoozeReminderTool = defineTool({
  name: 'snooze_reminder',
  title: 'Snooze a reminder',
  access: 'write',
  needs: 'reminders',
  description: [
    'Hide a reminder until later, without changing when it’s due: until "hour" (in 1 hour, only for a reminder with a time), "tomorrow", "week" (a week from today), "month", or a day after today (YYYY-MM-DD).',
    'It comes back at its time that day, or at the start of the day for "any time". To move it for good, use update_reminder.',
  ].join('\n'),
  input: z.strictObject({
    id: ReminderId,
    until: z.union([SnoozeFor, Day]).describe('"hour", "tomorrow", "week", "month", or a day YYYY-MM-DD.'),
  }),
  async run(args, ctx) {
    const cal = await loadCalendar(ctx);
    const stored = await storedReminder(ctx, args.id);
    if (stored.completed) throw new ToolError('This reminder is already done.');
    const option = SnoozeFor.safeParse(args.until);
    const { until } = await snoozeReminder(ctx.db, args.id, option.success ? option.data : 'date', cal.timeZone, option.success ? {} : { picked: args.until }).catch(reminderFailure);
    tracked(ctx, 'snooze_reminder');
    ctx.tracker.track('reminder_snoozed', { option: option.success ? option.data : 'date', source: 'assistant' });
    return { snoozed: stored.title, back: localWhen(until, cal.timeZone), link: reminderLink(ctx, args.id) };
  },
});

export const deleteReminderTool = defineTool({
  name: 'delete_reminder',
  title: 'Delete a reminder',
  access: 'delete',
  needs: 'reminders',
  description: 'Delete a reminder for the whole family; a repeating one goes with all its dates. It stays in Recently deleted in the app for 30 days, and the family can restore it.',
  input: z.strictObject({ id: ReminderId }),
  async run(args, ctx) {
    const stored = await storedReminder(ctx, args.id);
    await deleteReminder(ctx.db, args.id).catch(reminderFailure);
    tracked(ctx, 'delete_reminder');
    return { deleted: stored.title, in_recently_deleted: true };
  },
});
