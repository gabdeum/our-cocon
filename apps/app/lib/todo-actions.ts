import { daysBetween, todayIn } from '@cocon/calendar';
import { completeReminder, loadCalendarSettings, loadReminder, snoozeReminder } from '@cocon/data';
import { PushPayload, TODO_CATEGORY, TodoAction, type Tracker } from '@cocon/schemas';
import type { Client } from './supabase';

/** A tap on a reminder notification's "Done", "In 1 hour" or "Tomorrow", as the phone reports it. */
export interface TodoActionResponse {
  actionIdentifier: string;
  categoryIdentifier: string | null;
  data: unknown;
}

export interface TodoActionDeps {
  client: Pick<Client, 'from' | 'rpc' | 'auth'>;
  tracker: Tracker;
  now?: () => Date;
}

const OPEN = /^\/reminders\?open=([0-9a-f-]{36})$/;
const CATEGORIES: readonly string[] = Object.values(TODO_CATEGORY);
export const isTodoCategory = (category: string | null) => CATEGORIES.includes(category ?? '');

/**
 * Spec 059 FR-004: the Lock Screen's actions, through the same writes as the app (056): Done ticks the
 * occurrence the notification was about, "In 1 hour" and "Tomorrow" snooze it. A notification about
 * a date that has since moved on (ticked elsewhere, missed, done) changes nothing. Anything that isn't
 * one of ours, or nobody signed in, is ignored. Returns whether it was handled.
 */
export async function handleTodoAction(response: TodoActionResponse, deps: TodoActionDeps): Promise<boolean> {
  const action = TodoAction.safeParse(response.actionIdentifier);
  const payload = PushPayload.safeParse(response.data);
  const todo = payload.success && payload.data.kind === 'todo' ? payload.data : null;
  const id = todo ? OPEN.exec(todo.route)?.[1] : undefined;
  if (!action.success || !todo || !id || !isTodoCategory(response.categoryIdentifier)) return false;
  const { data: session } = await deps.client.auth.getSession();
  if (!session.session) return false;
  deps.tracker.track('reminder_notification_action', { action: action.data });

  const now = deps.now?.() ?? new Date();
  const [settings, row] = await Promise.all([loadCalendarSettings(deps.client), loadReminder(deps.client, id).catch(() => null)]);
  if (!row || row.completed) return true;
  if (todo.due_at && Date.parse(todo.due_at) !== Date.parse(row.due_at)) return true;
  // The family's home time zone, or the phone's until one is set (as the Reminders screen).
  const tz = settings.homeTimeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (action.data === 'done') {
    const done = await completeReminder(deps.client, id, tz, now);
    if (done) deps.tracker.track('reminder_completed', { repeating: done.repeating, late_days: Math.max(0, daysBetween(todayIn(tz, new Date(row.due_at)), todayIn(tz, now))), source: 'notification' });
    return true;
  }
  await snoozeReminder(deps.client, id, action.data, tz, { now });
  deps.tracker.track('reminder_snoozed', { option: action.data, source: 'notification' });
  return true;
}
