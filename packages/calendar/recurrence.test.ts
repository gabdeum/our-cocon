import type { EventOverride, Recurrence } from '@cocon/schemas/calendar';
import { describe, expect, it } from 'vitest';
import { event } from './event.fixture';
import { expand, occurrenceOn, splitSeries } from './recurrence';

const days = (occurrences: { starts_on: string }[]) => occurrences.map((o) => o.starts_on);
const repeat = (starts_on: string, recurrence: Recurrence) => event({ starts_on, ends_on: starts_on, recurrence });

describe('expand (FR-004)', () => {
  it('returns a one-off event only when it is in range', () => {
    expect(days(expand(event(), '2026-10-01', '2026-10-31'))).toEqual(['2026-10-31']);
    expect(expand(event(), '2026-11-01', '2026-11-30')).toEqual([]);
  });

  it.each([
    ['daily', repeat('2026-10-30', { freq: 'daily', ends: { type: 'never' } }), '2026-10-31', '2026-11-02', ['2026-10-31', '2026-11-01', '2026-11-02']],
    ['weekly, the start’s weekday', repeat('2026-10-31', { freq: 'weekly', ends: { type: 'never' } }), '2026-10-01', '2026-11-21', ['2026-10-31', '2026-11-07', '2026-11-14', '2026-11-21']],
    [
      'weekly on Tue and Thu',
      repeat('2026-10-27', { freq: 'weekly', weekdays: [4, 2], ends: { type: 'never' } }),
      '2026-10-01',
      '2026-11-05',
      ['2026-10-27', '2026-10-29', '2026-11-03', '2026-11-05'],
    ],
    ['weekly days before the start are skipped', repeat('2026-10-29', { freq: 'weekly', weekdays: [2, 4], ends: { type: 'never' } }), '2026-10-25', '2026-11-04', ['2026-10-29', '2026-11-03']],
    ['every 2 weeks', repeat('2026-10-31', { freq: 'biweekly', ends: { type: 'never' } }), '2026-10-01', '2026-11-30', ['2026-10-31', '2026-11-14', '2026-11-28']],
    [
      'every 2 weeks on Mon and Sat',
      repeat('2026-10-26', { freq: 'biweekly', weekdays: [1, 6], ends: { type: 'never' } }),
      '2026-10-01',
      '2026-11-14',
      ['2026-10-26', '2026-10-31', '2026-11-09', '2026-11-14'],
    ],
    ['monthly on the 15th', repeat('2026-10-15', { freq: 'monthly', ends: { type: 'never' } }), '2026-10-01', '2027-01-31', ['2026-10-15', '2026-11-15', '2026-12-15', '2027-01-15']],
    ['monthly on the 31st skips short months', repeat('2026-10-31', { freq: 'monthly', ends: { type: 'never' } }), '2026-10-01', '2027-04-30', ['2026-10-31', '2026-12-31', '2027-01-31', '2027-03-31']],
    ['yearly', repeat('2026-11-02', { freq: 'yearly', ends: { type: 'never' } }), '2026-01-01', '2028-12-31', ['2026-11-02', '2027-11-02', '2028-11-02']],
    ['yearly on Feb 29 only in leap years', repeat('2024-02-29', { freq: 'yearly', ends: { type: 'never' } }), '2026-01-01', '2028-12-31', ['2028-02-29']],
    ['ends on a date (inclusive)', repeat('2026-10-31', { freq: 'weekly', ends: { type: 'on', date: '2026-11-14' } }), '2026-10-01', '2026-12-31', ['2026-10-31', '2026-11-07', '2026-11-14']],
    ['ends after N times', repeat('2026-10-31', { freq: 'weekly', ends: { type: 'after', count: 2 } }), '2026-10-01', '2026-12-31', ['2026-10-31', '2026-11-07']],
    ['after N counts from the first time, not the range', repeat('2026-10-01', { freq: 'daily', ends: { type: 'after', count: 5 } }), '2026-10-04', '2026-10-31', ['2026-10-04', '2026-10-05']],
  ])('%s', (_, e, from, to, expected) => {
    expect(days(expand(e, from, to))).toEqual(expected);
  });

  it('keeps a multi-day event’s length and returns it while any day is in range', () => {
    const trip = event({ starts_on: '2026-10-30', ends_on: '2026-11-01', time_type: 'all_day', slots: [], recurrence: { freq: 'monthly', ends: { type: 'never' } } });
    const result = expand(trip, '2026-11-01', '2026-11-30');
    expect(result.map((o) => [o.starts_on, o.ends_on])).toEqual([
      ['2026-10-30', '2026-11-01'],
      ['2026-11-30', '2026-12-02'],
    ]);
  });

  it('marks each occurrence with its series date', () => {
    const [first] = expand(repeat('2026-10-31', { freq: 'weekly', ends: { type: 'never' } }), '2026-11-07', '2026-11-07');
    expect(first).toMatchObject({ id: 'e1', occurrence_date: '2026-11-07', is_exception: false, title: 'Football' });
  });

  describe('exceptions ("this event only")', () => {
    const weekly = repeat('2026-10-31', { freq: 'weekly', ends: { type: 'never' } });

    it('drops a cancelled occurrence', () => {
      expect(days(expand(weekly, '2026-10-31', '2026-11-14', [{ occurrence_date: '2026-11-07', cancelled: true }]))).toEqual(['2026-10-31', '2026-11-14']);
    });

    it('still counts a cancelled occurrence towards "after N times"', () => {
      const three = repeat('2026-10-31', { freq: 'weekly', ends: { type: 'after', count: 3 } });
      expect(days(expand(three, '2026-10-01', '2026-12-31', [{ occurrence_date: '2026-11-07', cancelled: true }]))).toEqual(['2026-10-31', '2026-11-14']);
    });

    it('replaces fields of one occurrence', () => {
      const result = expand(weekly, '2026-10-31', '2026-11-14', [{ occurrence_date: '2026-11-07', override: { title: 'Football final', slots: ['afternoon'] } }]);
      expect(result[1]).toMatchObject({ starts_on: '2026-11-07', title: 'Football final', slots: ['afternoon'], is_exception: true });
      expect(result[2]).toMatchObject({ title: 'Football', slots: ['morning'], is_exception: false });
    });

    it('moves an occurrence to another day, even into the range from outside it', () => {
      const result = expand(weekly, '2026-11-01', '2026-11-08', [{ occurrence_date: '2026-11-14', override: { starts_on: '2026-11-08' } }]);
      expect(result.map((o) => [o.starts_on, o.ends_on, o.occurrence_date])).toEqual([
        ['2026-11-07', '2026-11-07', '2026-11-07'],
        ['2026-11-08', '2026-11-08', '2026-11-14'],
      ]);
    });

    it('moves an occurrence out of the range', () => {
      expect(days(expand(weekly, '2026-11-01', '2026-11-08', [{ occurrence_date: '2026-11-07', override: { starts_on: '2026-11-10' } }]))).toEqual([]);
    });

    it('ignores exceptions on days the event doesn’t happen', () => {
      expect(days(expand(weekly, '2026-11-01', '2026-11-08', [{ occurrence_date: '2026-11-05', cancelled: true }]))).toEqual(['2026-11-07']);
    });
  });

  describe('typed errors', () => {
    it.each([
      ['ends before it starts', event({ ends_on: '2026-10-30' }), 'EndBeforeStart'],
      ['custom end not after start', event({ time_type: 'custom', slots: [], start_time: '16:00', end_time: '14:30' }), 'EndBeforeStart'],
      ['custom end equal to start', event({ time_type: 'custom', slots: [], start_time: '16:00', end_time: '16:00' }), 'EndBeforeStart'],
      ['non-adjacent slots', event({ slots: ['morning', 'evening'] }), 'NonAdjacentSlots'],
      ['weekdays on a daily repeat', event({ recurrence: { freq: 'daily', weekdays: [1], ends: { type: 'never' } } }), 'InvalidRecurrence'],
      ['a repeat that ends before the start', event({ recurrence: { freq: 'daily', ends: { type: 'on', date: '2026-10-01' } } }), 'InvalidRecurrence'],
    ])('%s → %s', (_, e, code) => {
      expect(() => expand(e, '2026-10-01', '2026-12-31')).toThrow(expect.objectContaining({ code }));
    });

    it('accepts a custom time that ends the next day on a multi-day event', () => {
      const night = event({ ends_on: '2026-11-01', time_type: 'custom', slots: [], start_time: '22:30', end_time: '01:00' });
      expect(days(expand(night, '2026-10-31', '2026-10-31'))).toEqual(['2026-10-31']);
    });
  });

  describe('bad input stays cheap and typed (security review)', () => {
    const daily = repeat('2026-10-01', { freq: 'daily', ends: { type: 'never' } });

    it('ignores an override’s visibility, creator, surprise and id', () => {
      const override = { title: 'Final', visibility: 'family', creator_member_id: 'someone', surprise: null, id: 'other' } as unknown as EventOverride;
      const [occurrence] = expand(event({ visibility: 'private' }), '2026-10-31', '2026-10-31', [{ occurrence_date: '2026-10-31', override }]);
      expect(occurrence).toMatchObject({ id: 'e1', title: 'Final', visibility: 'private', creator_member_id: event().creator_member_id });
    });

    it('ignores a moved day that isn’t a date', () => {
      const override = { starts_on: 'soon' } as unknown as EventOverride;
      expect(days(expand(daily, '2026-10-02', '2026-10-02', [{ occurrence_date: '2026-10-02', override }]))).toEqual(['2026-10-02']);
    });

    it.each(['9999-12-31', 'z', '2026-13-99', '2026-09-30'])('skips an exception on %s without walking to it', (occurrence_date) => {
      expect(days(expand(daily, '2026-10-01', '2026-10-02', [{ occurrence_date, cancelled: true }]))).toEqual(['2026-10-01', '2026-10-02']);
    });

    it.each([
      ['a bad start', () => expand(event({ starts_on: '2026-01-32', ends_on: '2026-01-32' }), '2026-01-01', '2026-12-31'), 'InvalidDate'],
      ['a bad end', () => expand(event({ ends_on: 'z' }), '2026-01-01', '2026-12-31'), 'InvalidDate'],
      ['a bad range start', () => expand(daily, 'z', '2026-12-31'), 'InvalidDate'],
      ['a bad range end', () => expand(daily, '2026-01-01', '+010000-01-01'), 'InvalidDate'],
      ['a range over three years', () => expand(daily, '2026-01-01', '2030-01-01'), 'InvalidDate'],
      ['a daily repeat from 270 years ago', () => expand(repeat('1750-01-01', { freq: 'daily', ends: { type: 'never' } }), '2026-01-01', '2026-01-31'), 'InvalidRecurrence'],
    ])('%s throws %s', (_, run, code) => {
      expect(run).toThrow(expect.objectContaining({ code }));
    });
  });
});

describe('occurrenceOn (spec 042 event page)', () => {
  const weekly = repeat('2026-10-03', { freq: 'weekly', weekdays: [6], ends: { type: 'never' } });

  it('finds a series date and keeps its length', () => {
    expect(occurrenceOn(weekly, '2026-10-31')).toMatchObject({ starts_on: '2026-10-31', ends_on: '2026-10-31', occurrence_date: '2026-10-31' });
  });

  it('finds a one-off event only on its day', () => {
    expect(occurrenceOn(event(), '2026-10-31')?.starts_on).toBe('2026-10-31');
    expect(occurrenceOn(event(), '2026-11-01')).toBeNull();
  });

  it('is null for a day that is not in the series, or cancelled', () => {
    expect(occurrenceOn(weekly, '2026-11-01')).toBeNull();
    expect(occurrenceOn(weekly, '2026-10-31', [{ occurrence_date: '2026-10-31', cancelled: true }])).toBeNull();
  });

  it('follows a date moved to another day, earlier or later', () => {
    const later = [{ occurrence_date: '2026-10-31', override: { starts_on: '2026-11-02', ends_on: '2026-11-02', title: 'Moved' } }];
    expect(occurrenceOn(weekly, '2026-10-31', later)).toMatchObject({ starts_on: '2026-11-02', title: 'Moved', occurrence_date: '2026-10-31' });
    const earlier = [{ occurrence_date: '2026-10-31', override: { starts_on: '2026-10-29', ends_on: '2026-10-29' } }];
    expect(occurrenceOn(weekly, '2026-10-31', earlier)?.starts_on).toBe('2026-10-29');
  });
});

describe('splitSeries (spec 041 "All future events")', () => {
  const weekly = (ends: Recurrence['ends']) => repeat('2026-10-03', { freq: 'weekly', weekdays: [6], ends });

  it('ends the old series the day before and keeps the end date', () => {
    expect(splitSeries(weekly({ type: 'on', date: '2026-12-26' }), '2026-10-31')).toEqual({
      before: { freq: 'weekly', weekdays: [6], ends: { type: 'on', date: '2026-10-30' } },
      ends: { type: 'on', date: '2026-12-26' },
    });
  });

  it('keeps a series that never ends going', () => {
    expect(splitSeries(weekly({ type: 'never' }), '2026-10-17')?.ends).toEqual({ type: 'never' });
  });

  it('counts the times already gone', () => {
    // Oct 3, 10, 17, 24 are gone; 31 is the fifth of ten.
    expect(splitSeries(weekly({ type: 'after', count: 10 }), '2026-10-31')?.ends).toEqual({ type: 'after', count: 6 });
  });

  it('is null on the first date: the whole series changes', () => {
    expect(splitSeries(weekly({ type: 'never' }), '2026-10-03')).toBeNull();
  });

  it('refuses a date the series doesn’t have, and a one-off event', () => {
    expect(() => splitSeries(weekly({ type: 'never' }), '2026-10-30')).toThrow('not one of');
    expect(() => splitSeries(weekly({ type: 'after', count: 2 }), '2026-10-17')).toThrow('not one of');
    expect(() => splitSeries(event(), '2026-10-31')).toThrow('Only a repeating event');
  });
});
