import { describe, expect, it } from 'vitest';
import { ClockTime, EventException, EventMember, Recurrence } from './calendar';

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
  });
});
