import { z } from 'zod';
import { timeIn, todayIn } from '@cocon/calendar';
import { loadReminder, type PlacedReminder, type StoredReminder } from '@cocon/data';
import { ReminderError } from '@cocon/reminders';
import { ToolError, type ToolContext } from '../../src/tools.js';
import { dayName, member, repeatWords, type Calendar } from '../calendar/shared.js';

export const ReminderId = z.uuid({ error: 'Use a reminder id from list_reminders.' }).describe('The reminder’s id, from list_reminders.');

export const notFound = 'That reminder isn’t there any more: it was deleted. Use list_reminders to find it.';

/** The reminder in the app: its drawer on the Reminders screen (design/flows.md). */
export const reminderLink = (ctx: Pick<ToolContext, 'appUrl'>, id: string) => `${ctx.appUrl}/reminders?open=${id}`;

/** A day and, when it has one, a time, in the family's time zone: { date: "2026-11-18", day: "Wednesday, Nov 18", time: "09:00" }. */
export function localWhen(instant: string, tz: string, withTime = true) {
  const at = new Date(instant);
  const date = todayIn(tz, at);
  return { date, day: dayName(date), ...(withTime ? { time: timeIn(tz, at) } : {}) };
}

/** Who a reminder is for, as `assignee` takes it: a name or id from list_members, or "everyone". */
export function assigneeRef(cal: Calendar, value: string): string {
  return value.trim().toLowerCase() === 'everyone' ? 'everyone' : member(cal, value).id;
}

const assigneeName = (cal: Calendar, id: string | null) => (id ? (cal.members.find((m) => m.id === id)?.name ?? 'Former member') : 'Everyone');

/** One open reminder, as an assistant reads it (FR-001). */
export function shownReminder(r: PlacedReminder, cal: Calendar, ctx: Pick<ToolContext, 'appUrl'>) {
  return {
    id: r.id,
    title: r.title,
    ...(r.notes ? { notes: r.notes } : {}),
    assignee: assigneeName(cal, r.assignee_id),
    due: localWhen(r.due_at, cal.timeZone, r.has_time),
    has_time: r.has_time,
    ...(r.repeat_rule ? { repeat: repeatWords(r.repeat_rule) } : {}),
    rollover: r.rollover,
    section: r.section,
    late_days: r.late_days,
    ...(r.snoozed ? { snoozed_until: localWhen(r.snoozed_until ?? r.due_at, cal.timeZone, r.has_time) } : {}),
    link: reminderLink(ctx, r.id),
  };
}

/** The reminder as stored, or the sentence saying it's gone (deleted, or not this family's). */
export async function storedReminder(ctx: Pick<ToolContext, 'db'>, id: string): Promise<StoredReminder & { completed: boolean }> {
  try {
    return await loadReminder(ctx.db, id);
  } catch (error) {
    if (error instanceof Error && error.message === 'This reminder was deleted.') throw new ToolError(notFound);
    throw error;
  }
}

/** One plain sentence for what went wrong, when the assistant can act on it. */
export function reminderFailure(error: unknown): never {
  if (error instanceof ReminderError) {
    switch (error.code) {
      case 'NeedsTime':
        throw new ToolError('“In 1 hour” needs a reminder with a time. Use tomorrow, week, month or a date instead.');
      case 'NotInFuture':
        throw new ToolError('Pick a day after today to snooze to.');
      case 'NoDate':
        throw new ToolError('The repeat ends before the reminder is due. Change the due date or when the repeat ends.');
    }
  }
  if (error instanceof Error && error.message === 'This reminder was deleted.') throw new ToolError(notFound);
  throw error;
}
