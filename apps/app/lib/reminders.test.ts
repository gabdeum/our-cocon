import { describe, expect, it } from 'vitest';
import { ReminderDraft } from '@cocon/schemas';
import type { ReminderOccurrence } from '@cocon/data';
import { draftToFields } from '@cocon/reminders';
import { alex, gabriel, placedReminder } from '../test/fakes';
import {
  createdProps,
  detailLine,
  formFromReminder,
  formRollover,
  formToDraft,
  homeFooterHint,
  lateBadge,
  lateText,
  newReminderForm,
  notifySummary,
  reminderMember,
  rolloverChoices,
  snoozeChoices,
  snoozedTitle,
  whenLine,
  type ReminderForm,
} from './reminders';

// Wednesday, Nov 11, 2026 in Paris (UTC+1), as on the screens.
const tz = 'Europe/Paris';
const today = '2026-11-11';
const o = { today, tz, use24h: true };
const mondays = { freq: 'weekly' as const, weekdays: [1], ends: { type: 'never' as const } };
const wednesdays = { freq: 'weekly' as const, weekdays: [3], ends: { type: 'never' as const } };
/** Midnight Paris on `date`: an "any time" reminder's due_at. */
const anyTime = (date: string) => new Date(`${date}T00:00:00+01:00`).toISOString();

describe('detailLine (Reminder row)', () => {
  it.each([
    ['late since Monday', { due_on: '2026-11-09', due_at: anyTime('2026-11-09'), has_time: false, section: 'overdue' }, 'list', 'Was due Mon'],
    ['late since yesterday', { due_on: '2026-11-10', due_at: anyTime('2026-11-10'), has_time: false, section: 'overdue' }, 'home', 'Was due yesterday'],
    ['late for weeks', { due_on: '2026-10-20', due_at: anyTime('2026-10-20'), has_time: false, section: 'overdue' }, 'list', 'Was due Tue, Oct 20'],
    ['today at 15:00, hourly', {}, 'home', '15:00 · nudges hourly'],
    ['today at 15:00, next day', { rollover: 'day' }, 'list', '15:00'],
    ['today any time on Home', { has_time: false, due_at: anyTime(today), rollover: 'day' }, 'home', 'Today'],
    ['today any time in its section', { has_time: false, due_at: anyTime(today), rollover: 'day' }, 'list', 'Any time'],
    ['tomorrow at 20:00', { due_on: '2026-11-12', due_at: '2026-11-12T19:00:00.000Z', section: 'tomorrow' }, 'list', '20:00'],
    ['later, any time', { due_on: '2026-11-14', due_at: anyTime('2026-11-14'), has_time: false, section: 'later' }, 'list', 'Sat, Nov 14'],
    ['later, at a time', { due_on: '2026-11-14', due_at: '2026-11-14T14:00:00.000Z', section: 'later' }, 'list', 'Sat, Nov 14 · 15:00'],
    ['snoozed to tomorrow', { section: 'snoozed', snoozed_until: anyTime('2026-11-12') }, 'list', 'Back tomorrow, Thu, Nov 12'],
    ['snoozed to next week', { section: 'snoozed', snoozed_until: anyTime('2026-11-18') }, 'list', 'Back Wed, Nov 18'],
  ] as const)('%s', (_, fields, where, expected) => {
    expect(detailLine(placedReminder(fields), { ...o, where })).toBe(expected);
  });

  it('reads the time in 12-hour clocks', () => {
    expect(detailLine(placedReminder({ rollover: 'day' }), { ...o, use24h: false, where: 'list' })).toBe('3:00 PM');
  });
});

describe('whenLine (drawer)', () => {
  it.each([
    ['a late weekly one', { repeat_rule: mondays, repeat_from: '2026-11-02', due_on: '2026-11-09', due_at: anyTime('2026-11-09'), has_time: false, late_days: 2, late_hours: 48 }, 'Every Monday · was due Mon, Nov 9'],
    ['a late one-off', { due_on: '2026-11-10', due_at: anyTime('2026-11-10'), has_time: false }, 'Was due Tue, Nov 10'],
    ['today at 15:00, hourly', {}, 'Today at 15:00 · nudges every hour until done'],
    ['today, any time', { has_time: false, due_at: anyTime(today), rollover: 'day' }, 'Today, any time'],
    ['repeating, today at 20:00', { repeat_rule: wednesdays, due_at: '2026-11-11T19:00:00.000Z', rollover: 'day' }, 'Every Wednesday at 20:00'],
    ['repeating, later', { repeat_rule: { freq: 'monthly', ends: { type: 'never' } }, due_on: '2026-11-14', due_at: anyTime('2026-11-14'), has_time: false }, 'Every month · Sat, Nov 14'],
    ['a one-off later', { due_on: '2026-11-16', due_at: anyTime('2026-11-16'), has_time: false, rollover: 'day' }, 'Mon, Nov 16'],
  ] as const)('%s', (_, fields, expected) => {
    expect(whenLine(placedReminder(fields), o)).toBe(expected);
  });
});

describe('lateBadge and lateText', () => {
  const late = placedReminder({ repeat_rule: mondays, due_on: '2026-11-09', late_days: 2, late_hours: 50 });
  const occ = (date: string, status: ReminderOccurrence['status']): ReminderOccurrence => ({ due_at: anyTime(date), status, closed_at: anyTime(date), closed_by: null });

  it('badges days, then hours, from 1 hour', () => {
    expect(lateBadge(late)).toBe('2d late');
    expect(lateBadge({ late_days: 0, late_hours: 3 })).toBe('3h late');
    expect(lateBadge({ late_days: 0, late_hours: 0 })).toBeNull();
  });

  it.each([
    ['nothing missed', [], '2 days late.'],
    ['last week missed', [occ('2026-11-02', 'missed'), occ('2026-10-26', 'done')], '2 days late. Last week’s (Mon, Nov 2) was missed too.'],
    ['three missed since', [occ('2026-11-02', 'missed'), occ('2026-10-26', 'missed'), occ('2026-10-19', 'skipped'), occ('2026-10-12', 'missed'), occ('2026-10-05', 'done'), occ('2026-09-28', 'missed')], '2 days late. Missed 3 times since Mon, Oct 12.'],
  ] as const)('%s', (_, history, expected) => {
    expect(lateText(late, history, tz)).toBe(expected);
  });

  it('says hours under a day, and the date for a repeat that is not weekly', () => {
    const daily = placedReminder({ repeat_rule: { freq: 'daily', ends: { type: 'never' } }, late_hours: 3 });
    expect(lateText(daily, [occ('2026-11-10', 'missed')], tz)).toBe('3 hours late. The one on Tue, Nov 10 was missed too.');
    expect(lateText(placedReminder({}), [], tz)).toBeNull();
  });
});

describe('homeFooterHint', () => {
  it.each([
    [2, 1, '2 more today · 1 snoozed'],
    [0, 1, '1 snoozed'],
    [3, 0, '3 more today'],
    [0, 0, ''],
  ])('%i more, %i snoozed', (more, snoozed, expected) => {
    expect(homeFooterHint(more, snoozed)).toBe(expected);
  });
});

describe('snoozeChoices', () => {
  // Wednesday 11 at 15:00 Paris.
  const now = new Date('2026-11-11T14:00:00.000Z');

  it('offers In 1 hour only with a time, and words each for the menu and the drawer', () => {
    expect(snoozeChoices(placedReminder({}), { now, tz, use24h: true, style: 'menu' }).map((c) => [c.label, c.detail])).toEqual([
      ['In 1 hour', '16:00'],
      ['Tomorrow', 'Thu 12'],
      ['Next week', 'Wed 18'],
      ['Next month', 'Fri, Dec 11'],
    ]);
    expect(snoozeChoices(placedReminder({ has_time: false, due_at: anyTime(today) }), { now, tz, use24h: true, style: 'drawer' }).map((c) => [c.label, c.detail])).toEqual([
      ['Tomorrow', 'Thu, Nov 12'],
      ['Next week', 'Wed, Nov 18'],
      ['Next month', 'Fri, Dec 11'],
    ]);
  });

  it('titles the confirmation with the day, or the time today', () => {
    expect(snoozedTitle(anyTime('2026-11-12'), o)).toBe('Snoozed until Thu, Nov 12');
    expect(snoozedTitle('2026-11-11T15:00:00.000Z', o)).toBe('Snoozed until 16:00');
  });
});

describe('the sheet', () => {
  const base = newReminderForm(gabriel.id, today);
  const form = (f: Partial<ReminderForm>): ReminderForm => ({ ...base, title: 'Book the check-up', ...f });

  it('starts today, any time, for me, not repeating', () => {
    expect(base).toMatchObject({ date: today, hasTime: false, assignee: gabriel.id, repeat: 'never', rollover: null });
  });

  it('offers Every hour only with a time, and drops it silently when the time goes', () => {
    expect(rolloverChoices(true)).toEqual(['hour', 'day', 'week', 'none']);
    expect(rolloverChoices(false)).toEqual(['day', 'week', 'none']);
    expect(formRollover({ hasTime: true, rollover: null })).toBe('hour');
    expect(formRollover({ hasTime: false, rollover: 'hour' })).toBe('day');
  });

  it.each([
    ['never', {}, null],
    ['every day', { repeat: 'daily' }, { freq: 'daily', ends: { type: 'never' } }],
    ['every week, on its day', { repeat: 'weekly' }, { freq: 'weekly', weekdays: [3], ends: { type: 'never' } }],
    ['every month', { repeat: 'monthly' }, { freq: 'monthly', ends: { type: 'never' } }],
    ['custom, every 2 weeks, 5 times', { repeat: 'custom', custom: { repeat: 'biweekly', weekdays: [], ends: { type: 'after', count: '5' } } }, { freq: 'biweekly', ends: { type: 'after', count: 5 } }],
  ] as const)('saves a repeat: %s', (_, f, repeat) => {
    expect(formToDraft(form(f as Partial<ReminderForm>)).repeat).toEqual(repeat);
  });

  // The database's member ids are uuids (the fakes' aren't).
  const me = '6f1c9a3e-1b2c-4d5e-8f90-123456789abc';

  it('comes back from a save as the same choices', () => {
    for (const f of [
      form({ hasTime: true, time: '15:00', repeat: 'weekly', assignee: 'everyone', notes: 'Ask for Dr. Lee\nThursday' }),
      form({ repeat: 'monthly', rollover: 'none', assignee: me }),
      form({ repeat: 'custom', custom: { repeat: 'weekly', weekdays: [1, 3], ends: { type: 'never' } }, date: '2026-11-16', assignee: me }),
    ]) {
      const fields = draftToFields(ReminderDraft.parse(formToDraft(f)), tz);
      const back = formFromReminder({ ...placedReminder({}), ...fields }, tz);
      expect(back).toEqual({ ...f, rollover: formRollover(f) });
    }
  });

  it('tracks only shapes, never text', () => {
    const d = ReminderDraft.parse(formToDraft(form({ hasTime: true, time: '15:00', notes: 'Call first', assignee: me })));
    expect(createdProps(d, me)).toEqual({ has_time: true, repeating: false, rollover: 'hour', has_notes: true, assignee_is_self: true });
  });

  it.each([
    ['timed, hourly', { hasTime: true, time: '15:00' }, true, 'Notifies Gabriel at 14:00 and 15:00, then every hour until done. Quiet from 22:00 to 07:00.'],
    ['timed, next day', { hasTime: true, time: '15:00', rollover: 'day' }, true, 'Notifies Gabriel at 14:00 and 15:00.'],
    ['any time, for everyone', { assignee: 'everyone' }, true, 'Notifies everyone at 09:00 on the day, then each morning while it’s late.'],
    ['any time, leave it', { rollover: 'none', assignee: alex.id }, true, 'Notifies Alex at 09:00 on the day.'],
    ['12-hour clock', { hasTime: true, time: '00:30', rollover: 'week' }, false, 'Notifies Gabriel at 11:30 PM and 12:30 AM.'],
  ] as const)('summarises notifications: %s', (_, f, use24h, expected) => {
    expect(notifySummary(form(f as Partial<ReminderForm>), [gabriel, alex], use24h)).toBe(expected);
  });
});

describe('reminderMember', () => {
  it('draws a member, and Everyone for none or someone who left', () => {
    expect(reminderMember(alex.id, [gabriel, alex])).toEqual({ initial: 'A', color: 'rose', name: 'Alex' });
    expect(reminderMember(null, [gabriel])).toEqual({ initial: 'All', color: 'everyone', name: 'Everyone' });
    expect(reminderMember('gone', [gabriel]).name).toBe('Everyone');
  });
});
