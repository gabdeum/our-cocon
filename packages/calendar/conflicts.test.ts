import { describe, expect, it } from 'vitest';
import { conflictWho, findConflict } from './conflicts';
import { EVA, GABRIEL, JAMES, event } from './event.fixture';
import { viewFor } from './visibility';

const draft = (fields: Parameters<typeof event>[0]) => {
  const { id: _, ...rest } = event(fields);
  return rest;
};

describe('findConflict (FR-006)', () => {
  const swim = event({ id: 'swim', title: 'Swim', slots: ['morning'], members: [JAMES] });

  it.each([
    ['same slot, same member', draft({ members: [JAMES] }), [swim], 'swim'],
    ['overlapping custom time', draft({ time_type: 'custom', slots: [], start_time: '11:30', end_time: '12:30', members: [JAMES] }), [swim], 'swim'],
    ['touching times don’t clash', draft({ time_type: 'custom', slots: [], start_time: '12:00', end_time: '13:00', members: [JAMES] }), [swim], null],
    ['different member', draft({ members: [EVA] }), [swim], null],
    ['Everyone in the draft counts as every member', draft({ members: ['everyone'] }), [swim], 'swim'],
    ['Everyone in the event counts as every member', draft({ members: [EVA] }), [event({ id: 'all', members: ['everyone'] })], 'all'],
    ['Others never clash', draft({ members: ['others'] }), [event({ id: 'o', members: ['others'] })], null],
    ['Others with Everyone don’t clash', draft({ members: ['others'] }), [event({ id: 'all', members: ['everyone'] })], null],
    ['another day', draft({ starts_on: '2026-11-01', ends_on: '2026-11-01', members: [JAMES] }), [swim], null],
    ['an all-day draft never clashes', draft({ time_type: 'all_day', slots: [], members: [JAMES] }), [swim], null],
    ['an all-day event never clashes', draft({ members: [JAMES] }), [event({ id: 'bday', time_type: 'all_day', slots: [] })], null],
    ['a multi-day draft clashes on a later day', draft({ starts_on: '2026-10-30', ends_on: '2026-10-31', members: [JAMES] }), [swim], 'swim'],
    ['a multi-day timed event clashes on each of its days', draft({ members: [JAMES] }), [event({ id: 'camp', starts_on: '2026-10-30', ends_on: '2026-11-01' })], 'camp'],
  ])('%s', (_, d, events, expected) => {
    expect(findConflict(d, events)?.id ?? null).toBe(expected);
  });

  it('returns the earliest clash', () => {
    const lunch = event({ id: 'lunch', slots: ['lunch'] });
    const early = event({ id: 'early', time_type: 'custom', slots: [], start_time: '08:30', end_time: '09:30' });
    expect(findConflict(draft({ slots: ['morning', 'lunch'] }), [lunch, swim, early])?.id).toBe('early');
  });

  it('doesn’t clash with itself when editing', () => {
    expect(findConflict({ ...draft({}), id: 'swim' }, [swim])).toBeNull();
  });

  it('names a private event "Busy" when the events went through viewFor (spec 043 FR-004)', () => {
    const yoga = event({ id: 'yoga', title: 'Therapy', members: [EVA], visibility: 'private', creator_member_id: EVA });
    expect(findConflict(draft({ members: [EVA] }), [viewFor(yoga, GABRIEL)])?.title).toBe('Busy');
  });

  it('names a surprise by its cover for the person it’s hidden from (spec 043 FR-004)', () => {
    const cover = event({ id: 'dinner', title: 'Dinner out', members: [EVA], view: 'cover' });
    expect(findConflict(draft({ members: [EVA] }), [viewFor(cover, EVA)])?.title).toBe('Dinner out');
  });
});

describe('conflictWho (spec 041 FR-006)', () => {
  const movie = event({ id: 'movie', title: 'Movie night', slots: ['evening'], members: ['everyone'] });
  const swim = event({ id: 'swim', slots: ['morning'], members: [JAMES] });

  it.each([
    ['you, on an Everyone event', draft({ slots: ['evening'], members: [GABRIEL] }), movie, 'me', 'evening'],
    ['the member on an Everyone event', draft({ slots: ['evening'], members: [EVA, 'others'] }), movie, EVA, 'evening'],
    ['Everyone on both', draft({ slots: ['evening'], members: ['everyone'] }), movie, 'everyone', 'evening'],
    ['you, when you add for Everyone', draft({ slots: ['evening'], members: ['everyone'] }), event({ slots: ['evening'], members: [JAMES, GABRIEL] }), 'me', 'evening'],
    ['the member, when you add for Everyone', draft({ members: ['everyone'] }), swim, JAMES, 'morning'],
    ['the shared member', draft({ members: [GABRIEL, JAMES] }), swim, JAMES, 'morning'],
    ['you among shared members', draft({ members: [JAMES, GABRIEL] }), event({ members: [JAMES, GABRIEL] }), 'me', 'morning'],
  ])('%s', (_, d, other, who, slot) => {
    expect(conflictWho(d, other, GABRIEL)).toEqual({ who, slot });
  });

  it('names the draft’s slot where the clash starts', () => {
    const d = draft({ slots: ['afternoon', 'evening'], members: [GABRIEL] });
    expect(conflictWho(d, movie, GABRIEL).slot).toBe('evening');
    const late = draft({ time_type: 'custom', slots: [], start_time: '19:30', end_time: '21:00', members: [GABRIEL] });
    expect(conflictWho(late, movie, GABRIEL).slot).toBe('evening');
  });

  it('falls back to Everyone and the first slot when there’s no time', () => {
    expect(conflictWho(draft({ time_type: 'all_day', slots: [], members: [] }), event({ time_type: 'all_day', slots: [], members: [] }), GABRIEL)).toEqual({ who: 'everyone', slot: 'early_morning' });
  });
});
