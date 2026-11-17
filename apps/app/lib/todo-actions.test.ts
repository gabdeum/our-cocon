// Spec 059 FR-004 / SC-003: a reminder notification's Done, In 1 hour and Tomorrow, through the same
// writes as the app. The writes are faked; their rules are tested in @cocon/data and @cocon/reminders.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { completeReminder, loadCalendarSettings, loadReminder, snoozeReminder } from '@cocon/data';
import { fakeTracker } from '../test/fakes';
import { handleTodoAction, type TodoActionDeps } from './todo-actions';

vi.mock('@cocon/data', () => ({
  completeReminder: vi.fn(),
  loadCalendarSettings: vi.fn(),
  loadReminder: vi.fn(),
  snoozeReminder: vi.fn(),
}));

const ID = '6f1c9a3e-1b2c-4d5e-8f90-123456789abc';
const DUE = '2026-11-11T14:00:00.000Z';
const NOW = new Date('2026-11-11T16:00:00.000Z');
const data = { kind: 'todo', route: `/reminders?open=${ID}`, due_at: DUE };
const tap = (actionIdentifier: string, more: Partial<{ categoryIdentifier: string | null; data: unknown }> = {}) => ({ actionIdentifier, categoryIdentifier: 'todo_timed', data, ...more });

function deps(signedIn = true): TodoActionDeps & { tracker: ReturnType<typeof fakeTracker> } {
  const auth = { getSession: vi.fn().mockResolvedValue({ data: { session: signedIn ? { user: { id: 'u1' } } : null } }) };
  return { client: { auth } as unknown as TodoActionDeps['client'], tracker: fakeTracker(), now: () => NOW };
}

beforeEach(() => {
  vi.mocked(loadCalendarSettings).mockResolvedValue({ homeTimeZone: 'Europe/Paris', slotTimes: {} as never });
  vi.mocked(loadReminder).mockResolvedValue({ id: ID, due_at: DUE, completed: false } as never);
  vi.mocked(completeReminder).mockReset().mockResolvedValue({ repeating: false, undo: {} as never, nextDueAt: null });
  vi.mocked(snoozeReminder).mockReset().mockResolvedValue({ until: DUE, previous: null });
});

describe('handleTodoAction', () => {
  it('Done ticks the reminder, from the notification', async () => {
    const d = deps();
    expect(await handleTodoAction(tap('done'), d)).toBe(true);
    expect(completeReminder).toHaveBeenCalledWith(d.client, ID, 'Europe/Paris', NOW);
    expect(d.tracker.track).toHaveBeenCalledWith('reminder_notification_action', { action: 'done' });
    expect(d.tracker.track).toHaveBeenCalledWith('reminder_completed', { repeating: false, late_days: 0, source: 'notification' });
  });

  it.each([
    ['hour', 'todo_timed'],
    ['tomorrow', 'todo'],
  ] as const)('%s snoozes it', async (action, categoryIdentifier) => {
    const d = deps();
    expect(await handleTodoAction(tap(action, { categoryIdentifier }), d)).toBe(true);
    expect(snoozeReminder).toHaveBeenCalledWith(d.client, ID, action, 'Europe/Paris', { now: NOW });
    expect(d.tracker.track).toHaveBeenCalledWith('reminder_snoozed', { option: action, source: 'notification' });
  });

  it('a notification about a date that has moved on changes nothing', async () => {
    vi.mocked(loadReminder).mockResolvedValue({ id: ID, due_at: '2026-11-12T14:00:00+00:00', completed: false } as never);
    expect(await handleTodoAction(tap('done'), deps())).toBe(true);
    expect(completeReminder).not.toHaveBeenCalled();
  });

  it('nor one already done or deleted', async () => {
    vi.mocked(loadReminder).mockResolvedValue({ id: ID, due_at: DUE, completed: true } as never);
    expect(await handleTodoAction(tap('done'), deps())).toBe(true);
    vi.mocked(loadReminder).mockRejectedValue(new Error('This reminder was deleted.'));
    expect(await handleTodoAction(tap('tomorrow'), deps())).toBe(true);
    expect(completeReminder).not.toHaveBeenCalled();
    expect(snoozeReminder).not.toHaveBeenCalled();
  });

  it.each([
    ['another category', tap('done', { categoryIdentifier: 'timer_done' })],
    ['an unknown action', tap('stop')],
    ['an event reminder', tap('done', { data: { kind: 'reminder', route: `/calendar/${ID}?date=2026-11-11` } })],
    ['a route elsewhere', tap('done', { data: { kind: 'todo', route: '/timers' } })],
    ['no data', tap('done', { data: null })],
  ])('ignores %s', async (_, response) => {
    expect(await handleTodoAction(response, deps())).toBe(false);
    expect(completeReminder).not.toHaveBeenCalled();
  });

  it('does nothing when nobody is signed in', async () => {
    expect(await handleTodoAction(tap('done'), deps(false))).toBe(false);
    expect(completeReminder).not.toHaveBeenCalled();
  });
});
