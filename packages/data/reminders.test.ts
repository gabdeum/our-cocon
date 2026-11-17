import { describe, expect, it, vi } from 'vitest';
import type { Db } from './client';
import { catchUpReminders, completeReminder, createReminder, loadReminderSection, loadRemindersHome, snoozeReminder, undoCompleteReminder } from './reminders';

const FAMILY = '3f0c1d6e-2b1a-4c8e-9a52-0d7e1f4b6a01';
const ID = '3f0c1d6e-2b1a-4c8e-9a52-0d7e1f4b6a02';
const tz = 'Europe/Paris';

/** Bins every Monday at 08:00 Paris, due Monday 9 (so missed once by Monday 16, 09:00). */
const bins = {
  id: ID,
  title: 'Bins',
  notes: null,
  assignee_id: null,
  due_at: '2026-11-09T07:00:00+00:00',
  has_time: true,
  repeat_rule: { freq: 'weekly', ends: { type: 'never' } },
  repeat_from: '2026-10-05',
  next_due_at: '2026-11-16T07:00:00+00:00',
  rollover: 'day',
  snoozed_until: null,
  source: 'app',
  created_by: null,
  created_at: '2026-10-05T10:00:00+00:00',
  updated_at: '2026-10-05T10:00:00+00:00',
};

function placed(n: number, section = 'overdue') {
  return {
    ...bins,
    id: `3f0c1d6e-2b1a-4c8e-9a52-${String(n).padStart(12, '0')}`,
    due_on: '2026-11-09',
    late_from: bins.due_at,
    late_hours: 26,
    late_days: 1,
    section,
    on_home: true,
    snoozed: false,
    sort_at: `2026-11-09T07:${String(n % 60).padStart(2, '0')}:00+00:00`,
  };
}

/** A client whose table reads answer `rows` (one answer per call, the last one repeating) and whose RPCs answer `rpc`. */
function fakeClient(rows: unknown[][], rpc: (name: string, args: Record<string, unknown>) => unknown) {
  const calls: { table: string; op: string; args: unknown[] }[] = [];
  let read = 0;
  const from = vi.fn((table: string) => {
    const builder: Record<string, unknown> = {};
    const chain = (op: string) =>
      vi.fn((...args: unknown[]) => {
        calls.push({ table, op, args });
        return builder;
      });
    for (const op of ['select', 'insert', 'update', 'eq', 'is', 'lte', 'limit', 'order']) builder[op] = chain(op);
    const answer = () => rows[Math.min(read++, rows.length - 1)] ?? [];
    builder.then = (resolve: (v: unknown) => unknown) => resolve({ data: answer(), error: null });
    builder.maybeSingle = () => Promise.resolve({ data: answer()[0] ?? null, error: null });
    builder.single = () => Promise.resolve({ data: { id: ID }, error: null });
    return builder;
  });
  const rpcMock = vi.fn((name: string, args: Record<string, unknown>) => Promise.resolve({ data: rpc(name, args), error: null }));
  return { client: { from, rpc: rpcMock } as unknown as Db, calls, rpc: rpcMock };
}

describe('reminders data (spec 056)', () => {
  it('closes what was missed before reading Home (FR-005)', async () => {
    vi.useFakeTimers({ now: new Date('2026-11-16T09:00:00Z') });
    const { client, rpc } = fakeClient([[bins]], (name) => (name === 'reminder_apply' ? true : { rows: [placed(1)], more_today: 2, snoozed: 1 }));
    const home = await loadRemindersHome(client, tz);
    expect(rpc.mock.calls[0]).toEqual([
      'reminder_apply',
      {
        p_id: ID,
        p_from_due_at: bins.due_at,
        p_closed: [{ due_at: bins.due_at, status: 'missed' }],
        p_due_at: '2026-11-16T07:00:00.000Z',
        p_complete: false,
        p_next_due_at: '2026-11-23T07:00:00.000Z',
        p_snoozed_until: undefined,
      },
    ]);
    expect(home).toMatchObject({ moreToday: 2, snoozed: 1, rows: [{ section: 'overdue', late_days: 1 }] });
    vi.useRealTimers();
  });

  it('counts the missed ones, and none when another phone got there first', async () => {
    const now = new Date('2026-11-16T09:00:00Z');
    expect(await catchUpReminders(fakeClient([[bins]], () => true).client, tz, now)).toBe(1);
    expect(await catchUpReminders(fakeClient([[bins]], () => false).client, tz, now)).toBe(0);
  });

  it('pages a section with a cursor (FR-012)', async () => {
    const first = fakeClient([[]], () => Array.from({ length: 51 }, (_, i) => placed(i)));
    const page = await loadReminderSection(first.client, { section: 'overdue', mine: true, tz });
    expect(first.rpc).toHaveBeenCalledWith('reminders_section', expect.objectContaining({ p_section: 'overdue', p_mine: true, p_limit: 51, p_after_sort: undefined }));
    expect(page.rows).toHaveLength(50);
    expect(page.nextCursor).toBe(`${placed(49).sort_at}|${placed(49).id}`);

    const next = fakeClient([[]], () => [placed(50)]);
    const more = await loadReminderSection(next.client, { section: 'overdue', mine: true, tz, cursor: page.nextCursor });
    expect(next.calls).toEqual([]);
    expect(next.rpc).toHaveBeenCalledWith('reminders_section', expect.objectContaining({ p_limit: 21, p_after_sort: placed(49).sort_at, p_after_id: placed(49).id }));
    expect(more).toEqual({ rows: [expect.objectContaining({ id: placed(50).id })], nextCursor: null });

    await expect(loadReminderSection(next.client, { section: 'later', mine: false, tz, cursor: 'nope' })).rejects.toThrow('Pull to refresh');
  });

  it('ticks the occurrence as it is now, and tries again when someone moved it (FR-004)', async () => {
    const moved = { ...bins, due_at: '2026-11-16T07:00:00+00:00', next_due_at: '2026-11-23T07:00:00+00:00' };
    let applies = 0;
    const { client } = fakeClient([[{ ...bins, completed_at: null }], [{ ...moved, completed_at: null }]], () => ++applies !== 1);
    const done = await completeReminder(client, ID, tz, new Date('2026-11-16T09:00:00Z'));
    expect(done).toEqual({
      repeating: true,
      nextDueAt: '2026-11-23T07:00:00.000Z',
      undo: { id: ID, from_due_at: '2026-11-23T07:00:00.000Z', reopen: [moved.due_at], due_at: moved.due_at, next_due_at: moved.next_due_at, snoozed_until: null },
    });
    if (!done) throw new Error('not completed');
    const undo = fakeClient([], () => true);
    expect(await undoCompleteReminder(undo.client, done.undo)).toBe(true);
    expect(undo.rpc).toHaveBeenCalledWith('reminder_revert', expect.objectContaining({ p_reopen: [moved.due_at], p_snoozed_until: undefined }));
  });

  it('leaves a reminder someone already completed', async () => {
    const { client, rpc } = fakeClient([[{ ...bins, repeat_rule: null, repeat_from: null, next_due_at: null, completed_at: '2026-11-16T08:00:00+00:00' }]], () => true);
    expect(await completeReminder(client, ID, tz)).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('saves a new reminder in the family, and snoozes without moving the due date (FR-007)', async () => {
    const created = fakeClient([[]], () => null);
    expect(await createReminder(created.client, FAMILY, { title: 'Bins', due_date: '2026-11-16', time: '08:00' }, tz)).toBe(ID);
    expect(created.calls[0]).toMatchObject({ op: 'insert', args: [expect.objectContaining({ family_id: FAMILY, due_at: '2026-11-16T07:00:00.000Z', rollover: 'hour' })] });

    const snoozed = fakeClient([[{ ...bins, completed_at: null }]], () => null);
    expect(await snoozeReminder(snoozed.client, ID, 'tomorrow', tz, { now: new Date('2026-11-16T09:00:00Z') })).toEqual({ until: '2026-11-17T07:00:00.000Z', previous: null });
    expect(snoozed.calls.find((c) => c.op === 'update')?.args).toEqual([{ snoozed_until: '2026-11-17T07:00:00.000Z' }]);
  });
});
