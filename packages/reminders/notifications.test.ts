import { calendarWordsByLanguage, zonedInstant } from '@cocon/calendar';
import type { QuietHours, ReminderRollover } from '@cocon/schemas';
import { describe, expect, it } from 'vitest';
import { quietEnd, reminderNotificationText, reminderSendDue, reminderSlots, reminderWordsByLanguage, todoRecipients, type NotifiedReminder } from './notifications';

// Paris: UTC+1 in winter, UTC+2 from 2027-03-28. Wednesday 2026-11-11, as on OC-NotifLockTodo.
const tz = 'Europe/Paris';
const paris = (date: string, time: string) => zonedInstant(date, time, tz);
const WED = '2026-11-11';
const THU = '2026-11-12';
const QUIET: QuietHours = { from: '22:00', to: '07:00' };

function reminder(time: string | null, rollover: ReminderRollover, more: Partial<NotifiedReminder> = {}): NotifiedReminder {
  return {
    id: 'r1',
    title: 'Book James’s check-up',
    assignee_id: null,
    has_time: time !== null,
    rollover,
    late_from: paris(WED, time ?? '00:00').toISOString(),
    snoozed: false,
    created_at: paris('2026-11-01', '12:00').toISOString(),
    ...more,
  };
}

describe('reminderSendDue (SC-001)', () => {
  it.each([
    // Timed, "Every hour": 1 hour before, at its time, then on the hour, quiet at night.
    ['timed hour, 1 hour before', reminder('15:00', 'hour'), WED, '14:00', QUIET, { kind: 'before', at: [WED, '14:00'] }],
    ['timed hour, between', reminder('15:00', 'hour'), WED, '14:30', QUIET, null],
    ['timed hour, at its time', reminder('15:00', 'hour'), WED, '15:00', QUIET, { kind: 'due', at: [WED, '15:00'] }],
    ['timed hour, never early', reminder('15:00', 'hour'), WED, '14:59', QUIET, null],
    ['timed hour, a tick 5 minutes late', reminder('15:00', 'hour'), WED, '15:05', QUIET, { kind: 'due', at: [WED, '15:00'] }],
    ['timed hour, over 10 minutes late', reminder('15:00', 'hour'), WED, '15:11', QUIET, null],
    ['timed hour, first nudge', reminder('15:00', 'hour'), WED, '16:00', QUIET, { kind: 'nudge', at: [WED, '16:00'] }],
    ['timed hour, last nudge before quiet', reminder('15:00', 'hour'), WED, '21:00', QUIET, { kind: 'nudge', at: [WED, '21:00'] }],
    ['timed hour, quiet at 22:00', reminder('15:00', 'hour'), WED, '22:00', QUIET, null],
    ['timed hour, quiet at 03:00', reminder('15:00', 'hour'), THU, '03:00', QUIET, null],
    ['timed hour, one nudge as quiet ends', reminder('15:00', 'hour'), THU, '07:00', QUIET, { kind: 'nudge', at: [THU, '07:00'] }],
    ['timed hour, quiet ending off the hour', reminder('15:00', 'hour'), THU, '06:15', { from: '23:30', to: '06:15' }, { kind: 'nudge', at: [THU, '06:15'] }],
    ['timed hour, no quiet hours', reminder('15:00', 'hour'), THU, '03:00', { from: '00:00', to: '00:00' }, { kind: 'nudge', at: [THU, '03:00'] }],
    // Timed, "Next day": each morning at 09:00.
    ['timed day, at its time', reminder('15:00', 'day'), WED, '15:00', QUIET, { kind: 'due', at: [WED, '15:00'] }],
    ['timed day, no hourly nudge', reminder('15:00', 'day'), WED, '16:00', QUIET, null],
    ['timed day, next morning', reminder('15:00', 'day'), THU, '09:00', QUIET, { kind: 'nudge', at: [THU, '09:00'] }],
    ['timed day, the morning after', reminder('15:00', 'day'), '2026-11-13', '09:00', QUIET, { kind: 'nudge', at: ['2026-11-13', '09:00'] }],
    // Timed, "Next week": on its weekday, at its time (when it's back in the lists, spec 058).
    ['timed week, not the next day', reminder('15:00', 'week'), THU, '09:00', QUIET, null],
    ['timed week, a week later', reminder('15:00', 'week'), '2026-11-18', '15:00', QUIET, { kind: 'nudge', at: ['2026-11-18', '15:00'] }],
    // Timed, "Leave it": nothing after its time.
    ['timed none, at its time', reminder('15:00', 'none'), WED, '15:00', QUIET, { kind: 'due', at: [WED, '15:00'] }],
    ['timed none, nothing after', reminder('15:00', 'none'), THU, '09:00', QUIET, null],
    // Without a time: 09:00 on the day, no "1 hour before".
    ['untimed day, no 1 hour before', reminder(null, 'day'), WED, '08:00', QUIET, null],
    ['untimed day, 09:00 on the day', reminder(null, 'day'), WED, '09:00', QUIET, { kind: 'due', at: [WED, '09:00'] }],
    ['untimed day, next morning', reminder(null, 'day'), THU, '09:00', QUIET, { kind: 'nudge', at: [THU, '09:00'] }],
    ['untimed week, a week later at 09:00', reminder(null, 'week'), '2026-11-18', '09:00', QUIET, { kind: 'nudge', at: ['2026-11-18', '09:00'] }],
    ['untimed week, not the day after', reminder(null, 'week'), THU, '09:00', QUIET, null],
    ['untimed none, 09:00 on the day', reminder(null, 'none'), WED, '09:00', QUIET, { kind: 'due', at: [WED, '09:00'] }],
    ['untimed none, nothing after', reminder(null, 'none'), THU, '09:00', QUIET, null],
    ['untimed, back from a snooze at 14:00', reminder(null, 'day', { late_from: paris(WED, '14:00').toISOString() }), WED, '14:00', QUIET, { kind: 'due', at: [WED, '14:00'] }],
    // Snoozed: nothing until it's back.
    ['snoozed', reminder('15:00', 'hour', { snoozed: true }), WED, '15:00', QUIET, null],
    // Quiet hours hold "1 hour before" and "at its time"; several held together are one, the furthest along.
    ['07:30, 1 hour before held to 07:00', reminder('07:30', 'day'), WED, '07:00', QUIET, { kind: 'before', at: [WED, '07:00'] }],
    ['07:30, then at its time', reminder('07:30', 'day'), WED, '07:30', QUIET, { kind: 'due', at: [WED, '07:30'] }],
    ['06:00 hour: one nudge at 07:00', reminder('06:00', 'hour'), WED, '07:00', QUIET, { kind: 'nudge', at: [WED, '07:00'] }],
    ['06:00 hour: nothing at 05:00', reminder('06:00', 'hour'), WED, '05:00', QUIET, null],
    ['06:00 day: on time, held to 07:00', reminder('06:00', 'day'), WED, '07:00', QUIET, { kind: 'due', at: [WED, '07:00'] }],
    ['23:00 hour: nothing at 22:00', reminder('23:00', 'hour'), WED, '22:00', QUIET, null],
    ['23:00 hour: one nudge as quiet ends', reminder('23:00', 'hour'), THU, '07:00', QUIET, { kind: 'nudge', at: [THU, '07:00'] }],
    // Added after its "1 hour before": that one never comes.
    ['added after 1 hour before', reminder('15:00', 'hour', { created_at: paris(WED, '14:05').toISOString() }), WED, '14:05', QUIET, null],
    ['added after 1 hour before, still on time', reminder('15:00', 'hour', { created_at: paris(WED, '14:05').toISOString() }), WED, '15:00', QUIET, { kind: 'due', at: [WED, '15:00'] }],
    // Across the clock change (2027-03-28): 09:00 stays 09:00, and the skipped hour is nudged once.
    ['day nudge after the clocks change', reminder('15:00', 'day', { late_from: paris('2027-03-27', '15:00').toISOString() }), '2027-03-28', '09:00', QUIET, { kind: 'nudge', at: ['2027-03-28', '09:00'] }],
    ['hour nudge after the clocks change', reminder('01:00', 'hour', { late_from: paris('2027-03-28', '01:00').toISOString() }), '2027-03-28', '03:00', { from: '12:00', to: '12:00' }, { kind: 'nudge', at: ['2027-03-28', '03:00'] }],
  ] as const)('%s', (_, r, date, time, quiet, expected) => {
    const sent = reminderSendDue(r, quiet, tz, paris(date, time));
    expect(sent).toEqual(expected && { kind: expected.kind, slotAt: paris(expected.at[0], expected.at[1]).toISOString() });
  });

  it('nudges every hour, all day, outside quiet hours', () => {
    const r = reminder('15:00', 'hour');
    const sent = Array.from({ length: 24 }, (_, h) => reminderSendDue(r, QUIET, tz, new Date(paris(WED, '15:00').getTime() + h * 3_600_000)));
    expect(sent.map((s) => s?.kind ?? '-')).toEqual(['due', ...Array(6).fill('nudge'), ...Array(9).fill('-'), ...Array(8).fill('nudge')]);
  });
});

describe('reminderSlots', () => {
  it('lists the slots in a window, before quiet hours', () => {
    const slots = reminderSlots(reminder('15:00', 'hour'), tz, paris(WED, '13:00'), paris(WED, '17:00'));
    expect(slots.map((s) => [s.kind, s.at.toISOString()])).toEqual([
      ['before', paris(WED, '14:00').toISOString()],
      ['due', paris(WED, '15:00').toISOString()],
      ['nudge', paris(WED, '16:00').toISOString()],
      ['nudge', paris(WED, '17:00').toISOString()],
    ]);
  });

  it('starts weeks late without listing every week before', () => {
    const slots = reminderSlots(reminder(null, 'week'), tz, paris('2027-01-01', '00:00'), paris('2027-01-14', '00:00'));
    expect(slots.map((s) => s.at.toISOString())).toEqual([paris('2027-01-06', '09:00').toISOString(), paris('2027-01-13', '09:00').toISOString()]);
  });
});

describe('quietEnd (FR-002)', () => {
  it.each([
    [QUIET, WED, '22:00', [THU, '07:00']],
    [QUIET, WED, '23:59', [THU, '07:00']],
    [QUIET, THU, '06:59', [THU, '07:00']],
    [QUIET, THU, '07:00', null],
    [QUIET, WED, '21:59', null],
    [{ from: '13:00', to: '15:00' }, WED, '14:00', [WED, '15:00']],
    [{ from: '13:00', to: '15:00' }, WED, '15:00', null],
    [{ from: '13:00', to: '15:00' }, WED, '12:00', null],
    [{ from: '07:00', to: '07:00' }, WED, '07:00', null],
  ] as const)('%o at %s %s', (quiet, date, time, end) => {
    expect(quietEnd(paris(date, time), quiet, tz)).toEqual(end && paris(end[0], end[1]));
  });
});

describe('todoRecipients (FR-003)', () => {
  const members = [
    { id: 'gabriel', display_name: 'Gabriel', user_id: 'u1' },
    { id: 'eva', display_name: 'Eva', user_id: 'u2' },
    { id: 'james', display_name: 'James', user_id: null },
  ];

  it('the assignee only, without their name', () => {
    expect(todoRecipients({ assignee_id: 'eva' }, members)).toEqual([{ memberId: 'eva', forName: null, forEveryone: false }]);
  });

  it('Everyone: every member with the app, "for everyone"', () => {
    expect(todoRecipients({ assignee_id: null }, members)).toEqual([
      { memberId: 'gabriel', forName: null, forEveryone: true },
      { memberId: 'eva', forName: null, forEveryone: true },
    ]);
  });

  it('a member without the app: everyone with the app, with their name', () => {
    expect(todoRecipients({ assignee_id: 'james' }, members).map((r) => r.forName)).toEqual(['James', 'James']);
  });

  it('Everyone in a family of one: no name', () => {
    expect(todoRecipients({ assignee_id: null }, members.slice(0, 1))).toEqual([{ memberId: 'gabriel', forName: null, forEveryone: false }]);
  });
});

describe('reminderNotificationText (FR-001)', () => {
  const opts = { use24h: true, tz, forName: null };
  const at = (date: string, time: string) => paris(date, time).toISOString();

  it.each([
    ['1 hour before, for someone else', reminder('15:00', 'hour'), 'before', at(WED, '14:00'), { ...opts, forName: 'Gabriel' }, 'In 1 hour: Book James’s check-up', 'Due at 15:00 · for Gabriel'],
    ['at its time, every hour', reminder('15:00', 'hour'), 'due', at(WED, '15:00'), opts, 'Now: Book James’s check-up', 'Nudges every hour until it’s done.'],
    ['at its time, otherwise', reminder('15:00', 'day'), 'due', at(WED, '15:00'), { ...opts, forName: 'everyone' }, 'Now: Book James’s check-up', 'Due now · for everyone'],
    ['without a time', reminder(null, 'day'), 'due', at(WED, '09:00'), opts, 'Today: Book James’s check-up', 'Due today'],
    ['a nudge, 2 hours late', reminder('15:00', 'hour'), 'nudge', at(WED, '17:00'), opts, 'Still to do: Book James’s check-up', 'Was due at 15:00 · 2 hours late'],
    ['a nudge, 1 hour late, 12-hour clock', reminder('15:00', 'hour'), 'nudge', at(WED, '16:00'), { ...opts, use24h: false }, 'Still to do: Book James’s check-up', 'Was due at 3:00 PM · 1 hour late'],
    ['a nudge, a day late', reminder(null, 'day'), 'nudge', at(THU, '09:00'), opts, 'Still to do: Book James’s check-up', 'Was due yesterday'],
    ['a nudge, a week late', reminder('15:00', 'week'), 'nudge', at('2026-11-18', '15:00'), { ...opts, forName: 'James' }, 'Still to do: Book James’s check-up', 'Was due Wed, Nov 11 · for James'],
  ] as const)('%s', (_, r, kind, slotAt, options, title, body) => {
    expect(reminderNotificationText(r, { kind, slotAt }, options)).toEqual({ title, body });
  });
});

describe('spec 076: in the recipient’s language', () => {
  it('writes a late reminder in French, for everyone', () => {
    const r = { title: 'Sortir les poubelles', has_time: true, rollover: 'day' as const, late_from: '2026-11-28T09:00:00Z' };
    const text = reminderNotificationText(r, { kind: 'nudge', slotAt: '2026-11-28T11:00:00Z' }, {
      use24h: true,
      tz: 'UTC',
      forName: null,
      forEveryone: true,
      words: reminderWordsByLanguage.fr,
      calendarWords: calendarWordsByLanguage.fr,
    });
    expect(text).toEqual({ title: 'Toujours à faire : Sortir les poubelles', body: 'Prévu à 09:00 · 2 heures de retard · pour tout le monde' });
  });
});
