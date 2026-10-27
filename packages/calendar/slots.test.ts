import type { SlotKey } from '@cocon/schemas/calendar';
import { describe, expect, it } from 'vitest';
import { timeLabel } from './labels';
import { DEFAULT_SLOT_TIMES, fromMinutes, slotStartingAt, slotsToRange, sortSlots, timeRange, toMinutes } from './slots';

describe('slotsToRange (US2, FR-002)', () => {
  it.each([
    [['early_morning'], '06:00', '09:00'],
    [['morning'], '09:00', '12:00'],
    [['lunch'], '12:00', '14:00'],
    [['afternoon'], '14:00', '18:00'],
    [['evening'], '18:00', '22:00'],
    [['afternoon', 'evening'], '14:00', '22:00'],
    [['evening', 'afternoon'], '14:00', '22:00'],
    [['morning', 'lunch', 'afternoon'], '09:00', '18:00'],
    [['lunch', 'lunch'], '12:00', '14:00'],
  ] as [SlotKey[], string, string][])('%j → %s–%s', (slots, start, end) => {
    expect(slotsToRange(slots)).toEqual({ start, end });
  });

  it.each([[['morning', 'afternoon']], [['early_morning', 'evening']], [[]]] as [SlotKey[]][])('%j → NonAdjacentSlots', (slots) => {
    expect(() => slotsToRange(slots)).toThrow(expect.objectContaining({ code: 'NonAdjacentSlots' }));
  });

  it('follows the family’s own slot times', () => {
    const slotTimes = { ...DEFAULT_SLOT_TIMES, afternoon: { start: '13:30', end: '17:00' }, evening: { start: '17:00', end: '21:30' } };
    expect(slotsToRange(['afternoon', 'evening'], slotTimes)).toEqual({ start: '13:30', end: '21:30' });
  });

  it('Evening is labelled "Evening"', () => {
    expect(timeLabel({ time_type: 'slot', slots: ['evening'] }, { use24h: true })).toBe('Evening');
  });
});

describe('slot helpers', () => {
  it('converts times and minutes', () => {
    expect(toMinutes('14:30')).toBe(870);
    expect(toMinutes('24:00')).toBe(1440);
    expect(fromMinutes(870)).toBe('14:30');
    expect(fromMinutes(65)).toBe('01:05');
  });

  it('sorts slots in day order', () => {
    expect(sortSlots(['evening', 'morning', 'evening'])).toEqual(['morning', 'evening']);
  });

  it('finds the slot that starts at a time', () => {
    expect(slotStartingAt('12:00')).toBe('lunch');
    expect(slotStartingAt('12:30')).toBeNull();
  });

  it('gives each kind of event its hours', () => {
    expect(timeRange({ time_type: 'all_day', slots: [] })).toBeNull();
    expect(timeRange({ time_type: 'slot', slots: ['lunch'] })).toEqual({ start: '12:00', end: '14:00' });
    expect(timeRange({ time_type: 'custom', slots: [], start_time: '14:30', end_time: '16:00' })).toEqual({ start: '14:30', end: '16:00' });
    expect(() => timeRange({ time_type: 'custom', slots: [], start_time: '14:30' })).toThrow(expect.objectContaining({ code: 'EndBeforeStart' }));
  });
});
