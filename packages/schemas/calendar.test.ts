import { describe, expect, it } from 'vitest';
import { ClockTime, EventException, EventInput, EventMember, EventMembers, EventPatch, Recurrence, SlotTimes, SurpriseCover } from './calendar';

describe('calendar schemas (spec 034)', () => {
  it.each([
    [{ freq: 'weekly', weekdays: [6], ends: { type: 'never' } }, true],
    [{ freq: 'biweekly', ends: { type: 'after', count: 10 } }, true],
    [{ freq: 'monthly', ends: { type: 'on', date: '2027-06-30' } }, true],
    [{ freq: 'daily', weekdays: [1], ends: { type: 'never' } }, false],
    [{ freq: 'weekly', weekdays: [], ends: { type: 'never' } }, false],
    [{ freq: 'weekly', weekdays: [7], ends: { type: 'never' } }, false],
    [{ freq: 'yearly', ends: { type: 'after', count: 0 } }, false],
    [{ freq: 'hourly', ends: { type: 'never' } }, false],
  ])('recurrence %j valid: %s', (value, valid) => {
    expect(Recurrence.safeParse(value).success).toBe(valid);
  });

  it.each([
    ['00:00', true],
    ['18:30', true],
    ['24:00', true],
    ['24:30', false],
    ['9:00', false],
  ])('time %s valid: %s', (value, valid) => {
    expect(ClockTime.safeParse(value).success).toBe(valid);
  });

  it('takes member ids, Everyone and Others', () => {
    expect(EventMember.safeParse('everyone').success).toBe(true);
    expect(EventMember.safeParse('others').success).toBe(true);
    expect(EventMember.safeParse('3f0c1d6e-2b1a-4c8e-9a52-0d7e1f4b6a10').success).toBe(true);
    expect(EventMember.safeParse('James').success).toBe(false);
  });

  it('keeps visibility, creator and surprise out of a "this event only" change', () => {
    expect(EventException.safeParse({ occurrence_date: '2026-11-07', override: { title: 'Final' } }).success).toBe(true);
    for (const key of ['visibility', 'creator_member_id', 'surprise', 'id']) {
      expect(EventException.safeParse({ occurrence_date: '2026-11-07', override: { [key]: 'x' } }).success).toBe(false);
    }
    expect(EventException.safeParse({ occurrence_date: '9999-99-99', cancelled: true }).success).toBe(false);
    expect(EventException.safeParse({ occurrence_date: '2026-11-07' }).success).toBe(false);
  });
});

const EVA = '3f0c1d6e-2b1a-4c8e-9a52-0d7e1f4b6a10';
const JAMES = '3f0c1d6e-2b1a-4c8e-9a52-0d7e1f4b6a11';
const yoga = { title: 'Yoga', starts_on: '2026-11-03', ends_on: '2026-11-03', time_type: 'slot', slots: ['evening'], members: [EVA] };
const errors = (value: unknown, schema: typeof EventInput | typeof EventPatch = EventInput) => {
  const result = schema.safeParse(value);
  return result.success ? [] : result.error.issues.map((i) => i.message);
};

describe('event schemas (spec 035 FR-005)', () => {
  it('takes an event and trims its text', () => {
    expect(EventInput.parse({ ...yoga, title: '  Yoga ', location: ' Studio 4 ' })).toMatchObject({ title: 'Yoga', location: 'Studio 4' });
  });

  it.each([
    [{ ...yoga, title: '' }, 'Too small: expected string to have >=1 characters'],
    [{ ...yoga, title: 'x'.repeat(61) }, 'Too big: expected string to have <=60 characters'],
    [{ ...yoga, ends_on: '2026-11-02' }, 'It ends before it starts'],
    [{ ...yoga, slots: [] }, 'A time of day needs a slot and no times'],
    [{ ...yoga, start_time: '18:00' }, 'A time of day needs a slot and no times'],
    [{ ...yoga, time_type: 'custom', slots: [], start_time: '18:00' }, 'Custom needs a start and an end time'],
    [{ ...yoga, time_type: 'all_day' }, 'All day has no slot or time'],
    [{ ...yoga, visibility: 'surprise' }, 'A surprise needs a cover'],
    [{ ...yoga, surprise: { hidden_from: [EVA], cover_title: 'Out' } }, 'Only a surprise has a cover'],
    [{ ...yoga, category: 'birthday' }, 'A birthday repeats every year, all day'],
  ])('refuses %j', (value, message) => {
    expect(errors(value)).toContain(message);
  });

  it('takes custom times, but not "24:00" as a start', () => {
    expect(errors({ ...yoga, time_type: 'custom', slots: [], start_time: '22:30', end_time: '24:00' })).toEqual([]);
    expect(errors({ ...yoga, time_type: 'custom', slots: [], start_time: '24:00', end_time: '24:00' })).not.toEqual([]);
  });

  it('takes a birthday as a yearly all-day event (FR-006)', () => {
    const birthday = { ...yoga, title: "Alex's birthday", category: 'birthday', time_type: 'all_day', slots: [], recurrence: { freq: 'yearly', ends: { type: 'never' } } };
    expect(errors(birthday)).toEqual([]);
  });

  it('takes a surprise with its cover', () => {
    expect(errors({ ...yoga, visibility: 'surprise', surprise: { hidden_from: [EVA], cover_title: 'Dinner out', cover_note: 'Dress nice!' } })).toEqual([]);
  });

  it('checks the fields a patch gives, and only those', () => {
    expect(errors({ title: 'Pilates' }, EventPatch)).toEqual([]);
    expect(errors({ time_type: 'custom' }, EventPatch)).toContain('Custom needs a start and an end time');
    expect(errors({ visibility: 'private', creator_member_id: EVA }, EventPatch)).not.toEqual([]);
  });

  it.each([
    [['everyone'], true],
    [['everyone', 'others'], true],
    [[EVA, 'others'], true],
    [[EVA, JAMES], true],
    [['everyone', EVA], false],
    [[EVA, EVA], false],
    [[], false],
  ])('who %j valid: %s', (value, valid) => {
    expect(EventMembers.safeParse(value).success).toBe(valid);
  });

  it('limits a surprise cover', () => {
    expect(SurpriseCover.safeParse({ hidden_from: [EVA], cover_title: 'x'.repeat(60), cover_note: 'x'.repeat(200) }).success).toBe(true);
    expect(SurpriseCover.safeParse({ hidden_from: [EVA], cover_title: 'x'.repeat(61) }).success).toBe(false);
    expect(SurpriseCover.safeParse({ hidden_from: [EVA], cover_title: 'Out', cover_note: 'x'.repeat(201) }).success).toBe(false);
    expect(SurpriseCover.safeParse({ hidden_from: [], cover_title: 'Out' }).success).toBe(false);
  });

  it('takes the five slots with their hours', () => {
    const hours = { start: '09:00', end: '12:00' };
    expect(SlotTimes.safeParse({ early_morning: hours, morning: hours, lunch: hours, afternoon: hours, evening: hours }).success).toBe(true);
    expect(SlotTimes.safeParse({ morning: hours }).success).toBe(false);
  });
});
