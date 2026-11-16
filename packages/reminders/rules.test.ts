import type { Recurrence } from '@cocon/schemas';
import { ReminderDraft } from '@cocon/schemas';
import { describe, expect, it } from 'vitest';
import { ReminderError, catchUp, complete, draftToFields, invert, nextDueAfter, rolloverFor, snoozeOptions, snoozeUntil, type ReminderTiming } from './rules';

// Paris: UTC+1 in winter, UTC+2 in summer (clocks change on 2026-10-25 and 2027-03-28).
const tz = 'Europe/Paris';
const weekly: Recurrence = { freq: 'weekly', ends: { type: 'never' } };
const at = (iso: string) => new Date(iso);

/** A reminder every Monday at 08:00 Paris (07:00Z in winter), from Monday 2026-10-05. */
function mondays(due_at: string, more: Partial<ReminderTiming> = {}): ReminderTiming {
  return { due_at, has_time: true, repeat_rule: weekly, repeat_from: '2026-10-05', snoozed_until: null, ...more };
}

describe('rolloverFor (FR-008)', () => {
  it.each([
    [true, undefined, 'hour'],
    [false, undefined, 'day'],
    [false, 'hour', 'day'],
    [true, 'hour', 'hour'],
    [true, 'week', 'week'],
    [false, 'none', 'none'],
  ] as const)('with a time %s and %s → %s', (hasTime, chosen, expected) => {
    expect(rolloverFor(hasTime, chosen)).toBe(expected);
  });
});

describe('draftToFields (FR-001)', () => {
  const draft = (d: ReminderDraft) => draftToFields(ReminderDraft.parse(d), tz);

  it('stores a time as that instant, and "any time" as the start of the day', () => {
    expect(draft({ title: 'Pay the daycare', due_date: '2026-11-16', time: '08:00' })).toMatchObject({
      due_at: '2026-11-16T07:00:00.000Z', has_time: true, rollover: 'hour', repeat_rule: null, repeat_from: null, next_due_at: null, assignee_id: null, notes: null,
    });
    expect(draft({ title: 'Bins', due_date: '2026-11-16', notes: 'Green bin\nand glass', assignee: 'everyone' })).toMatchObject({
      due_at: '2026-11-15T23:00:00.000Z', has_time: false, rollover: 'day', notes: 'Green bin\nand glass', assignee_id: null,
    });
  });

  it('turns "Every hour" into "Next day" without a time', () => {
    expect(draft({ title: 'Bins', due_date: '2026-11-16', rollover: 'hour' }).rollover).toBe('day');
  });

  it('keeps a member and blank notes as none', () => {
    const member = '6f1c9a3e-1b2c-4d5e-8f90-123456789abc';
    expect(draft({ title: 'Call the vet', due_date: '2026-11-16', assignee: member, notes: '  ' })).toMatchObject({ assignee_id: member, notes: null });
  });

  it('starts a repeat on its first date, with the next one', () => {
    // Tuesday 17, repeating on Mondays and Wednesdays: due Wednesday 18.
    expect(draft({ title: 'Swim bag', due_date: '2026-11-17', time: '07:30', repeat: { freq: 'weekly', weekdays: [1, 3], ends: { type: 'never' } } })).toMatchObject({
      due_at: '2026-11-18T06:30:00.000Z', next_due_at: '2026-11-23T06:30:00.000Z', repeat_from: '2026-11-17',
    });
  });

  it('refuses a repeat that ends before its first date', () => {
    // From Tuesday 17, on Mondays, until Friday 20: no Monday.
    expect(() => draft({ title: 'Swim bag', due_date: '2026-11-17', repeat: { freq: 'weekly', weekdays: [1], ends: { type: 'on', date: '2026-11-20' } } })).toThrow(ReminderError);
  });

  it('says what to fix', () => {
    const issues = (d: unknown) => ReminderDraft.safeParse(d).error?.issues.map((i) => i.message);
    expect(issues({ title: ' ', due_date: '2026-11-16' })).toEqual(['Give your reminder a name.']);
    expect(issues({ title: 'Bins', due_date: '2026-11-16', repeat: { freq: 'daily', ends: { type: 'on', date: '2026-11-01' } } })).toEqual(['The repeat ends before the reminder is due.']);
  });
});

describe('complete (FR-004)', () => {
  it.each([
    ['a one-off', { repeat_rule: null, repeat_from: null }, { complete: true, closed: [], due_at: '2026-11-16T07:00:00.000Z', next_due_at: null }],
    ['a repeat, on time or late: the next date from the schedule', {}, {
      complete: false, closed: [{ due_at: '2026-11-16T07:00:00.000Z', status: 'done' }], due_at: '2026-11-23T07:00:00.000Z', next_due_at: '2026-11-30T07:00:00.000Z',
    }],
    ['the last time of a repeat', { repeat_rule: { freq: 'weekly', ends: { type: 'on', date: '2026-11-20' } } as Recurrence }, {
      complete: true, closed: [{ due_at: '2026-11-16T07:00:00.000Z', status: 'done' }], due_at: '2026-11-16T07:00:00.000Z',
    }],
    ['a snoozed repeat: the snooze goes', { snoozed_until: '2026-11-18T07:00:00.000Z' }, { snoozed_until: null, due_at: '2026-11-23T07:00:00.000Z' }],
  ])('%s', (_, more, expected) => {
    expect(complete(mondays('2026-11-16T07:00:00.000Z', more), tz)).toMatchObject(expected);
  });

  it.each([
    ['autumn', '2026-10-19T06:00:00.000Z', '2026-10-26T07:00:00.000Z'],
    ['spring', '2027-03-22T07:00:00.000Z', '2027-03-29T06:00:00.000Z'],
  ])('keeps 08:00 across the %s clock change', (_, due, next) => {
    expect(complete(mondays(due), tz).due_at).toBe(next);
  });

  it('keeps "any time" at the start of the day across a clock change', () => {
    const r = mondays('2026-10-18T22:00:00.000Z', { has_time: false });
    expect(complete(r, tz).due_at).toBe('2026-10-25T23:00:00.000Z');
  });

  it('counts every 2 weeks from the repeat\'s first date', () => {
    const r = mondays('2026-11-16T07:00:00.000Z', { repeat_rule: { freq: 'biweekly', ends: { type: 'never' } }, repeat_from: '2026-11-02' });
    expect(complete(r, tz).due_at).toBe('2026-11-30T07:00:00.000Z');
  });

  it('undoes', () => {
    const before = { ...mondays('2026-11-16T07:00:00.000Z', { snoozed_until: '2026-11-16T09:00:00.000Z' }), next_due_at: '2026-11-23T07:00:00.000Z' };
    expect(invert(complete(before, tz), before)).toEqual({
      from_due_at: '2026-11-23T07:00:00.000Z', reopen: ['2026-11-16T07:00:00.000Z'], due_at: '2026-11-16T07:00:00.000Z', next_due_at: '2026-11-23T07:00:00.000Z', snoozed_until: '2026-11-16T09:00:00.000Z',
    });
  });
});

describe('catchUp (FR-005, FR-007)', () => {
  it.each([
    ['nothing before the next date comes', mondays('2026-11-09T07:00:00.000Z'), '2026-11-16T06:59:00Z', null],
    ['a one-off never', mondays('2026-11-09T07:00:00.000Z', { repeat_rule: null, repeat_from: null }), '2026-12-16T00:00:00Z', null],
    ['missed after 1 week', mondays('2026-11-09T07:00:00.000Z'), '2026-11-16T09:00:00Z', {
      closed: [{ due_at: '2026-11-09T07:00:00.000Z', status: 'missed' }], due_at: '2026-11-16T07:00:00.000Z', next_due_at: '2026-11-23T07:00:00.000Z', snoozed_until: null,
    }],
    ['missed after 3 weeks, across the clock change', mondays('2026-10-19T06:00:00.000Z'), '2026-11-02T09:00:00Z', {
      closed: [{ due_at: '2026-10-19T06:00:00.000Z', status: 'missed' }, { due_at: '2026-10-26T07:00:00.000Z', status: 'missed' }],
      due_at: '2026-11-02T07:00:00.000Z', next_due_at: '2026-11-09T07:00:00.000Z',
    }],
    ['3 weeks missed', mondays('2026-10-26T07:00:00.000Z'), '2026-11-16T09:00:00Z', {
      closed: ['2026-10-26', '2026-11-02', '2026-11-09'].map((d) => ({ due_at: `${d}T07:00:00.000Z`, status: 'missed' })), due_at: '2026-11-16T07:00:00.000Z',
    }],
    ['any time: from the start of the next date', mondays('2026-11-08T23:00:00.000Z', { has_time: false }), '2026-11-15T23:30:00Z', {
      closed: [{ due_at: '2026-11-08T23:00:00.000Z', status: 'missed' }], due_at: '2026-11-15T23:00:00.000Z', next_due_at: '2026-11-22T23:00:00.000Z',
    }],
    ['a snooze that ended before the next date: missed, snooze gone', mondays('2026-11-09T07:00:00.000Z', { snoozed_until: '2026-11-12T07:00:00.000Z' }), '2026-11-16T09:00:00Z', {
      closed: [{ due_at: '2026-11-09T07:00:00.000Z', status: 'missed' }], snoozed_until: null,
    }],
    ['snoozed past the next date: skipped, still snoozed', mondays('2026-11-09T07:00:00.000Z', { snoozed_until: '2026-11-20T07:00:00.000Z' }), '2026-11-16T09:00:00Z', {
      closed: [{ due_at: '2026-11-09T07:00:00.000Z', status: 'skipped' }], due_at: '2026-11-16T07:00:00.000Z', snoozed_until: '2026-11-20T07:00:00.000Z',
    }],
    ['snoozed past two dates, back since', mondays('2026-11-02T07:00:00.000Z', { snoozed_until: '2026-11-12T07:00:00.000Z' }), '2026-11-16T09:00:00Z', {
      closed: [{ due_at: '2026-11-02T07:00:00.000Z', status: 'skipped' }, { due_at: '2026-11-09T07:00:00.000Z', status: 'missed' }], snoozed_until: null,
    }],
    ['a repeat that has ended stays on its last date', mondays('2026-11-09T07:00:00.000Z', { repeat_rule: { freq: 'weekly', ends: { type: 'after', count: 7 } } }), '2026-12-01T09:00:00Z', {
      closed: [{ due_at: '2026-11-09T07:00:00.000Z', status: 'missed' }], due_at: '2026-11-16T07:00:00.000Z', next_due_at: null,
    }],
  ])('%s', (_, r, now, expected) => {
    const change = catchUp(r, at(now), tz);
    if (expected === null) expect(change).toBeNull();
    else expect(change).toMatchObject({ from_due_at: r.due_at, complete: false, ...expected });
  });

  it('closes years of a daily repeat in one go', () => {
    const r: ReminderTiming = { due_at: '2023-01-01T08:00:00.000Z', has_time: true, repeat_rule: { freq: 'daily', ends: { type: 'never' } }, repeat_from: '2023-01-01', snoozed_until: null };
    const change = catchUp(r, at('2026-11-15T12:00:00Z'), 'UTC');
    expect(change?.closed).toHaveLength(1414);
    expect(change).toMatchObject({ due_at: '2026-11-15T08:00:00.000Z', next_due_at: '2026-11-16T08:00:00.000Z' });
  });
});

describe('nextDueAfter', () => {
  it('finds a Feb 29 years ahead, and nothing for a one-off', () => {
    const r: ReminderTiming = { due_at: '2028-02-29T09:00:00.000Z', has_time: true, repeat_rule: { freq: 'yearly', ends: { type: 'never' } }, repeat_from: '2028-02-29', snoozed_until: null };
    expect(nextDueAfter(r, r.due_at, 'UTC')).toBe('2032-02-29T09:00:00.000Z');
    expect(nextDueAfter({ ...r, repeat_rule: null, repeat_from: null }, r.due_at, 'UTC')).toBeNull();
  });
});

describe('snoozeUntil (FR-007)', () => {
  // Wednesday 2026-11-11, 15:00 in Paris.
  const now = at('2026-11-11T14:00:00Z');
  const timed = { due_at: '2026-11-11T14:00:00.000Z', has_time: true };
  const anyTime = { due_at: '2026-11-10T23:00:00.000Z', has_time: false };

  it.each([
    ['hour', timed, '2026-11-11T15:00:00.000Z'],
    ['tomorrow', timed, '2026-11-12T14:00:00.000Z'],
    ['week', timed, '2026-11-18T14:00:00.000Z'],
    ['month', timed, '2026-12-11T14:00:00.000Z'],
    ['tomorrow', anyTime, '2026-11-11T23:00:00.000Z'],
  ] as const)('%s', (option, r, expected) => {
    expect(snoozeUntil(option, r, now, tz)).toBe(expected);
  });

  it('picks a date at its time, and only after today', () => {
    expect(snoozeUntil('date', timed, now, tz, '2026-12-24')).toBe('2026-12-24T14:00:00.000Z');
    expect(() => snoozeUntil('date', timed, now, tz, '2026-11-11')).toThrow(expect.objectContaining({ code: 'NotInFuture' }));
    expect(() => snoozeUntil('date', timed, now, tz)).toThrow(expect.objectContaining({ code: 'NotInFuture' }));
  });

  it('has no "In 1 hour" without a time', () => {
    expect(() => snoozeUntil('hour', anyTime, now, tz)).toThrow(expect.objectContaining({ code: 'NeedsTime' }));
    expect(snoozeOptions(anyTime, now, tz).map((o) => o.option)).toEqual(['tomorrow', 'week', 'month']);
    expect(snoozeOptions(timed, now, tz).map((o) => o.option)).toEqual(['hour', 'tomorrow', 'week', 'month']);
  });

  it('ends next month on its last day when it has no such date, and turns the year', () => {
    expect(snoozeUntil('month', anyTime, at('2027-01-31T12:00:00Z'), tz)).toBe('2027-02-27T23:00:00.000Z');
    expect(snoozeUntil('month', anyTime, at('2026-12-15T12:00:00Z'), tz)).toBe('2027-01-14T23:00:00.000Z');
  });
});
