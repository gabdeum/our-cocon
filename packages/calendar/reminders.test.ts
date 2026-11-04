import { describe, expect, it } from 'vitest';
import type { ReminderKind } from '@cocon/schemas/calendar';
import { zonedInstant } from './dates';
import { EVA, GABRIEL, JAMES, event } from './event.fixture';
import { reminderAt, reminderRecipients, reminderText, remindersDue, responsibleLine, type ReminderEvent, type ReminderFamily, type ReminderMember } from './reminders';
import { DEFAULT_SLOT_TIMES } from './slots';

const MIA = '0b8e6a1e-0000-4000-8000-000000000004';
const LOU = '0b8e6a1e-0000-4000-8000-000000000005';
const FAMILY = 'f1';
const TZ = 'America/New_York';

const members: ReminderMember[] = [
  { id: GABRIEL, display_name: 'Gabriel', user_id: 'u-gabriel' },
  { id: EVA, display_name: 'Eva', user_id: 'u-eva' },
  { id: JAMES, display_name: 'James', user_id: null },
  { id: MIA, display_name: 'Mia', user_id: null },
  { id: LOU, display_name: 'Lou', user_id: 'u-lou' },
];
const families = new Map<string, ReminderFamily>([[FAMILY, { timeZone: TZ, slotTimes: DEFAULT_SLOT_TIMES, members }]]);

function reminding(kind: ReminderKind, fields: Partial<ReminderEvent> = {}): ReminderEvent {
  return { ...event(), family_id: FAMILY, reminder: kind, exceptions: [], created_at: '2026-10-01T00:00:00Z', ...fields };
}

/** Baby swim class, Sunday Nov 8 2026 14:30 in New York, for James; Gabriel takes him. */
const swim = (kind: ReminderKind = 'hour_before', fields: Partial<ReminderEvent> = {}) =>
  reminding(kind, {
    id: 'swim',
    title: 'Baby swim class',
    location: 'Aquatic Center',
    starts_on: '2026-11-08',
    ends_on: '2026-11-08',
    time_type: 'custom',
    start_time: '14:30',
    end_time: '15:15',
    ...fields,
  });
const at = (date: string, time: string) => zonedInstant(date, time, TZ);
const who = (e: ReminderEvent, now: Date) => remindersDue([e], families, now).map((d) => d.recipients);

describe('reminderAt (FR-002)', () => {
  const custom = (start: string) => ({ ...swim(), start_time: start, end_time: '23:00' });
  it.each([
    ['15 minutes before a custom time', custom('14:30'), 'minutes_15', '2026-11-08', '14:15'],
    ['1 hour before', custom('14:30'), 'hour_before', '2026-11-08', '13:30'],
    ['1 hour before a slot, from its start', event({ starts_on: '2026-11-08', ends_on: '2026-11-08' }), 'hour_before', '2026-11-08', '08:00'],
    ['1 hour before an all-day event is the morning of', event({ starts_on: '2026-11-08', ends_on: '2026-11-08', time_type: 'all_day', slots: [] }), 'hour_before', '2026-11-08', '07:30'],
    ['morning of at 07:30', custom('10:00'), 'morning_of', '2026-11-08', '07:30'],
    ['morning of, 1 hour before a start before 08:30', custom('08:00'), 'morning_of', '2026-11-08', '07:00'],
    ['morning of an all-day event', event({ starts_on: '2026-11-08', ends_on: '2026-11-08', time_type: 'all_day', slots: [] }), 'morning_of', '2026-11-08', '07:30'],
    ['1 day before at 18:00 the evening before', custom('14:30'), 'day_before', '2026-11-07', '18:00'],
    ['15 minutes before just after midnight is the day before', custom('00:10'), 'minutes_15', '2026-11-07', '23:55'],
  ] as const)('%s', (_, o, kind, date, time) => {
    expect(reminderAt(o, kind)).toEqual({ date, time });
  });
});

describe('reminderRecipients (FR-003)', () => {
  const ids = (e: Parameters<typeof reminderRecipients>[0]) => reminderRecipients(e, members);
  it('reminds the one who takes a member without the app; the rest only by "All family events"', () => {
    expect(ids(swim())).toEqual([
      { memberId: GABRIEL, via: 'event' },
      { memberId: EVA, via: 'all' },
      { memberId: LOU, via: 'all' },
    ]);
  });
  it('reminds everyone with the app while nobody takes them', () => {
    expect(ids(swim('hour_before', { responsible_member_id: null })).filter((r) => r.via === 'event')).toHaveLength(3);
  });
  it('Everyone is every member with the app', () => {
    expect(ids(swim('hour_before', { members: ['everyone'], responsible_member_id: null })).every((r) => r.via === 'event')).toBe(true);
  });
  it('members with the app on it, and Others reminds the creator', () => {
    expect(ids(swim('hour_before', { members: [EVA, 'others'], responsible_member_id: null, creator_member_id: LOU }))).toEqual([
      { memberId: EVA, via: 'event' },
      { memberId: LOU, via: 'event' },
      { memberId: GABRIEL, via: 'all' },
    ]);
  });
  it('a private event reminds only its owner', () => {
    expect(ids(swim('hour_before', { visibility: 'private', members: ['everyone'], creator_member_id: EVA }))).toEqual([{ memberId: EVA, via: 'event' }]);
    expect(ids(swim('hour_before', { visibility: 'private', creator_member_id: '' }))).toEqual([]);
  });
  it('a surprise never reminds the person it is hidden from', () => {
    const surprise = swim('hour_before', { visibility: 'surprise', members: ['everyone'], surprise: { hidden_from: [EVA], cover_title: 'Dinner out' } });
    expect(ids(surprise).map((r) => r.memberId)).toEqual([GABRIEL, LOU]);
  });
  it('a surprise whose cover is gone or whose creator left reminds only its creator, or nobody (security review)', () => {
    const lost = swim('hour_before', { visibility: 'surprise', members: ['everyone'], surprise: null, creator_member_id: GABRIEL });
    expect(ids(lost)).toEqual([{ memberId: GABRIEL, via: 'event' }]);
    const orphan = swim('hour_before', { visibility: 'surprise', members: ['everyone'], surprise: { hidden_from: [EVA], cover_title: 'Dinner out' }, creator_member_id: '' });
    expect(ids(orphan)).toEqual([]);
  });
  it('ignores members who left', () => {
    expect(ids(swim('hour_before', { members: ['gone'], responsible_member_id: null })).every((r) => r.via === 'all')).toBe(true);
  });
});

describe('responsibleLine', () => {
  it('"takes" for members without the app, "drives" otherwise, nothing without a driver', () => {
    expect(responsibleLine(GABRIEL, [JAMES, MIA], members)).toBe('Gabriel takes James and Mia');
    expect(responsibleLine(GABRIEL, [EVA], members)).toBe('Gabriel drives');
    expect(responsibleLine(null, [JAMES], members)).toBeNull();
  });
});

describe('reminderText (FR-004, OC-Notifications)', () => {
  const text = (o: ReminderEvent, use24h = true, recipient = GABRIEL) => reminderText(o, o.reminder, recipient, { use24h, members });
  it('15 minutes and 1 hour before', () => {
    expect(text(swim('hour_before'))).toEqual({ title: 'Baby swim class in 1 hour', body: '14:30 · Aquatic Center · Gabriel takes James' });
    expect(text(swim('minutes_15', { title: 'Pediatrician', location: 'Dr. Lee', start_time: '10:00', end_time: '11:00' }))).toEqual({
      title: 'Pediatrician in 15 minutes',
      body: '10:00 · Dr. Lee · Gabriel takes James',
    });
  });
  it('follows the recipient\'s clock', () => {
    expect(text(swim('hour_before'), false).body).toBe('2:30 PM · Aquatic Center · Gabriel takes James');
  });
  it('morning of: the time, the slot or Today in the title, who it\'s for in the body', () => {
    const pediatrician = swim('morning_of', { title: 'Pediatrician', location: 'Dr. Lee', start_time: '10:00', end_time: '11:00' });
    expect(text(pediatrician)).toEqual({ title: 'Pediatrician at 10:00', body: 'James · Dr. Lee · Gabriel takes James' });
    expect(text(reminding('morning_of', { title: 'Baby music', location: null }))).toEqual({ title: 'Baby music this morning', body: 'James · Gabriel takes James' });
    const visit = reminding('hour_before', { title: 'Grandma visits', time_type: 'all_day', slots: [], location: null, members: ['everyone', 'others'], responsible_member_id: null });
    expect(text(visit)).toEqual({ title: 'Today: Grandma visits', body: 'Everyone' });
  });
  it('leaves out the names when the recipient is the only one on it', () => {
    expect(text(swim('morning_of', { members: [GABRIEL], responsible_member_id: null, location: null })).body).toBe('');
  });
  it.each([
    ['early_morning', 'Swim early this morning'],
    ['morning', 'Swim this morning'],
    ['lunch', 'Swim at lunch'],
    ['afternoon', 'Swim this afternoon'],
    ['evening', 'Swim this evening'],
  ] as const)('a %s slot says so in the title', (slot, title) => {
    expect(text(reminding('morning_of', { title: 'Swim', slots: [slot] })).title).toBe(title);
  });
  it('a slot that starts after its start time says the time', () => {
    expect(text(swim('morning_of', { start_time: '09:30' })).title).toBe('Baby swim class at 09:30');
  });
  it('1 day before', () => {
    const birthday = reminding('day_before', { title: 'Eva’s birthday', starts_on: '2026-11-10', ends_on: '2026-11-10', time_type: 'all_day', slots: [], location: null, members: ['everyone'], responsible_member_id: null });
    expect(text(birthday)).toEqual({ title: 'Tomorrow: Eva’s birthday', body: 'All day · Tuesday' });
  });
});

describe('remindersDue (FR-005, SC-001)', () => {
  it('Story 1: Gabriel at 13:30 for the 14:30 swim class', () => {
    const [due] = remindersDue([swim()], families, at('2026-11-08', '13:30'));
    expect(due).toMatchObject({ familyId: FAMILY, kind: 'hour_before', at: at('2026-11-08', '13:30') });
    expect(due?.occurrence.occurrence_date).toBe('2026-11-08');
    expect(due?.recipients[0]).toEqual({ memberId: GABRIEL, via: 'event' });
  });
  it('Story 2: the evening before at 18:00', () => {
    const birthday = reminding('day_before', { starts_on: '2026-11-10', ends_on: '2026-11-10', time_type: 'all_day', slots: [], members: ['everyone'] });
    expect(remindersDue([birthday], families, at('2026-11-09', '18:00'))).toHaveLength(1);
    expect(remindersDue([birthday], families, at('2026-11-09', '17:58'))).toHaveLength(0);
  });
  it('goes out from 30 s before its time', () => {
    expect(who(swim(), new Date(at('2026-11-08', '13:30').getTime() - 30_000))).toHaveLength(1);
    expect(who(swim(), new Date(at('2026-11-08', '13:30').getTime() - 31_000))).toHaveLength(0);
  });
  it('skips a reminder more than 30 minutes late, 2 hours for the day before', () => {
    expect(who(swim(), at('2026-11-08', '14:00'))).toHaveLength(1);
    expect(who(swim(), at('2026-11-08', '14:01'))).toHaveLength(0);
    expect(who(swim('day_before'), at('2026-11-07', '20:00'))).toHaveLength(1);
    expect(who(swim('day_before'), at('2026-11-07', '20:01'))).toHaveLength(0);
  });
  it('Story 3: follows a moved time', () => {
    const moved = swim('hour_before', { start_time: '15:30', end_time: '16:15' });
    expect(who(moved, at('2026-11-08', '13:30'))).toHaveLength(0);
    expect(who(moved, at('2026-11-08', '14:30'))).toHaveLength(1);
  });
  it('an event added after its reminder time doesn\'t remind', () => {
    expect(who(swim('hour_before', { created_at: at('2026-11-08', '13:45').toISOString() }), at('2026-11-08', '13:50'))).toHaveLength(0);
  });
  it('each occurrence of a repeating event reminds, respecting exceptions', () => {
    const weekly = swim('hour_before', { starts_on: '2026-10-04', ends_on: '2026-10-04', recurrence: { freq: 'weekly', ends: { type: 'never' } } });
    expect(remindersDue([weekly], families, at('2026-11-08', '13:30'))[0]?.occurrence.occurrence_date).toBe('2026-11-08');
    expect(who({ ...weekly, exceptions: [{ occurrence_date: '2026-11-08', cancelled: true }] }, at('2026-11-08', '13:30'))).toHaveLength(0);
    const moved = { ...weekly, exceptions: [{ occurrence_date: '2026-11-08', override: { start_time: '16:00', end_time: '17:00' } }] };
    expect(who(moved, at('2026-11-08', '13:30'))).toHaveLength(0);
    expect(who(moved, at('2026-11-08', '15:00'))).toHaveLength(1);
  });
  it('counts days in the home time zone, across daylight saving', () => {
    // Clocks went back on Nov 1 2026 in New York: 13:30 EST is 18:30 UTC.
    expect(at('2026-11-08', '13:30').toISOString()).toBe('2026-11-08T18:30:00.000Z');
    expect(at('2026-10-25', '13:30').toISOString()).toBe('2026-10-25T17:30:00.000Z');
  });
  it('nothing without a home time zone, for an event the engine can\'t place, or for nobody', () => {
    const noZone = new Map([[FAMILY, { timeZone: null, slotTimes: DEFAULT_SLOT_TIMES, members }]]);
    expect(remindersDue([swim()], noZone, at('2026-11-08', '13:30'))).toEqual([]);
    expect(who(swim('hour_before', { ends_on: '2026-11-01' }), at('2026-11-08', '13:30'))).toEqual([]);
    expect(who(swim('hour_before', { visibility: 'private', creator_member_id: JAMES }), at('2026-11-08', '13:30'))).toEqual([]);
  });
});
