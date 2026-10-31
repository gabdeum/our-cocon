// Spec 041: the add sheet's rules: the route's prefill, slots and Who, what Save sends, what an edit
// changed, the conflict line, the toast and the scope question. Spec 043: who can see it.
import { describe, expect, it } from 'vitest';
import { DEFAULT_SLOT_TIMES } from '@cocon/calendar';
import { storedEvent, type StoredEvent } from '@cocon/data';
import {
  changedFields,
  conflictLine,
  dateGridMonth,
  dayTiles,
  draftFromEvent,
  endsProblem,
  futureSplit,
  hasMoreOptions,
  isChipOn,
  managedOn,
  newDraft,
  overrideFor,
  prefillFrom,
  scopeBody,
  shiftMonth,
  slotChips,
  takers,
  timeProblems,
  toInput,
  toastText,
  toggleSlot,
  toggleWho,
  typeTime,
  shownTimes,
  secretFrom,
  surpriseHiddenFrom,
  surpriseProblems,
  whoChips,
  type DraftTime,
  type EventDraft,
} from './event-form';
import { alex as alexFake, gabriel as gabrielFake, james as jamesFake } from '../test/fakes';

// Events carry member ids as uuids.
const gabriel = { ...gabrielFake, id: '3f0c1d6e-2b1a-4c8e-9a52-0d7e1f4b6a01' };
const alex = { ...alexFake, id: '3f0c1d6e-2b1a-4c8e-9a52-0d7e1f4b6a02' };
const james = { ...jamesFake, id: '3f0c1d6e-2b1a-4c8e-9a52-0d7e1f4b6a03' };
const ME = gabriel.id;
const members = [gabriel, alex, james];
const TODAY = '2026-10-28';
const slots = (...s: Extract<DraftTime, { kind: 'slot' }>['slots']): DraftTime => ({ kind: 'slot', slots: s });
const draft = (over: Partial<EventDraft> = {}): EventDraft => ({ ...newDraft({}, TODAY), who: [ME], title: 'Poker night', ...over });

/** A saved event as events_visible gives it. */
function stored(over: Record<string, unknown> = {}): StoredEvent {
  return storedEvent({
    id: '3f0c1d6e-2b1a-4c8e-9a52-0d7e1f4b6a12',
    title: 'Movie night',
    category: null,
    location: null,
    notes: null,
    starts_on: TODAY,
    ends_on: TODAY,
    time_type: 'slot',
    slots: ['evening'],
    start_time: null,
    end_time: null,
    recurrence: null,
    reminder: 'none',
    responsible_member_id: null,
    visibility: 'family',
    creator_member_id: '3f0c1d6e-2b1a-4c8e-9a52-0d7e1f4b6a11',
    members: ['everyone'],
    removed_members: [],
    exceptions: [],
    checklist: [],
    surprise: null,
    created_by: null,
    updated_by: null,
    source: 'app',
    created_at: '2026-10-27T10:00:00Z',
    updated_at: '2026-10-27T10:00:00Z',
    deleted_at: null,
    view: 'full',
    ...over,
  });
}

describe('the route’s prefill (FR-007, 032-later L91)', () => {
  it('keeps a valid day, slot and hour, and drops anything else', () => {
    expect(prefillFrom({ date: '2026-10-31', slot: 'evening', time: '14:00' })).toEqual({ date: '2026-10-31', slot: 'evening', time: '14:00' });
    expect(prefillFrom({ date: '2026-13-01', slot: 'night', time: '24:00' })).toEqual({});
    expect(prefillFrom({ date: ['2026-10-31'], time: '9:00' })).toEqual({});
  });

  it('starts on that day and slot, or a custom hour, and for everyone', () => {
    expect(newDraft({ date: '2026-10-31', slot: 'evening' }, TODAY)).toMatchObject({ date: '2026-10-31', time: slots('evening'), who: ['everyone'] });
    expect(newDraft({ time: '14:00' }, TODAY).time).toEqual({ kind: 'custom', start: '14:00', end: '15:00' });
    expect(newDraft({ time: '23:30' }, TODAY).time).toEqual({ kind: 'custom', start: '23:30', end: '24:00' });
    expect(newDraft({}, TODAY)).toMatchObject({ date: TODAY, time: { kind: 'all_day' } });
  });
});

describe('slots (FR-002)', () => {
  const tap = (time: DraftTime, ...keys: Parameters<typeof toggleSlot>[1][]) => keys.reduce((t, k) => toggleSlot(t, k), time);

  it.each([
    ['adjacent slots combine', tap(slots('afternoon'), 'evening'), slots('afternoon', 'evening')],
    ['in day order', tap(slots('evening'), 'afternoon'), slots('afternoon', 'evening')],
    ['a slot that isn’t next to them starts over', tap(slots('morning'), 'evening'), slots('evening')],
    ['unpicking an end keeps the rest', tap(slots('morning', 'lunch', 'afternoon'), 'afternoon'), slots('morning', 'lunch')],
    ['unpicking the middle starts over on it', tap(slots('morning', 'lunch', 'afternoon'), 'lunch'), slots('lunch')],
    ['unpicking the last one is All day', tap(slots('evening'), 'evening'), { kind: 'all_day' }],
    ['All day stands alone', tap(slots('evening'), 'all_day'), { kind: 'all_day' }],
    ['a slot after All day', tap({ kind: 'all_day' }, 'lunch'), slots('lunch')],
    ['a slot after typed times', tap({ kind: 'custom', start: '19:30', end: '21:00' }, 'morning'), slots('morning')],
    ['All day after typed times', tap({ kind: 'custom', start: '19:30', end: '21:00' }, 'all_day'), { kind: 'all_day' }],
  ])('%s', (_, got, expected) => {
    expect(got).toEqual(expected);
  });

  it('shows Starts and Ends: the slots’ hours, the typed times, or nothing all day', () => {
    expect(shownTimes(slots('afternoon', 'evening'), DEFAULT_SLOT_TIMES)).toEqual({ start: '14:00', end: '22:00' });
    expect(shownTimes({ kind: 'custom', start: '19:30', end: '' }, DEFAULT_SLOT_TIMES)).toEqual({ start: '19:30', end: '' });
    expect(shownTimes({ kind: 'all_day' }, DEFAULT_SLOT_TIMES)).toEqual({ start: '', end: '' });
  });

  it('typing a time makes it custom from what was shown; emptying both is All day', () => {
    expect(typeTime(slots('evening'), 'end', '23:00', DEFAULT_SLOT_TIMES)).toEqual({ kind: 'custom', start: '18:00', end: '23:00' });
    expect(typeTime({ kind: 'all_day' }, 'start', '10', DEFAULT_SLOT_TIMES)).toEqual({ kind: 'custom', start: '10', end: '' });
    expect(typeTime({ kind: 'custom', start: '10', end: '' }, 'start', '', DEFAULT_SLOT_TIMES)).toEqual({ kind: 'all_day' });
  });

  it('shows the chips with the family’s hours, and which are on', () => {
    const chips = slotChips(DEFAULT_SLOT_TIMES);
    expect(chips.map((c) => `${c.label} ${c.hours}`)).toEqual(['All day Whole day', 'Early morning 06–09', 'Morning 09–12', 'Lunch 12–14', 'Afternoon 14–18', 'Evening 18–22']);
    expect(isChipOn(slots('evening'), 'evening')).toBe(true);
    expect(isChipOn(slots('evening'), 'all_day')).toBe(false);
    expect(isChipOn({ kind: 'all_day' }, 'all_day')).toBe(true);
    expect(isChipOn({ kind: 'all_day' }, 'morning')).toBe(false);
  });

  it('warns about custom times that aren’t times, or end too soon', () => {
    expect(timeProblems(slots('evening'))).toEqual({});
    expect(timeProblems({ kind: 'custom', start: '19:30', end: '21:00' })).toEqual({});
    expect(timeProblems({ kind: 'custom', start: '7pm', end: '24:00' })).toEqual({ start: 'Use a time like 18:30.' });
    expect(timeProblems({ kind: 'custom', start: '24:00', end: '25:00' })).toEqual({ start: 'Use a time like 18:30.', end: 'Use a time like 18:30.' });
    expect(timeProblems({ kind: 'custom', start: '21:00', end: '19:30' })).toEqual({ end: 'Pick an end time after the start.' });
  });
});

describe('Who (FR-003)', () => {
  it.each([
    ['adds a member', [ME], alex.id, [ME, alex.id]],
    ['removes one', [ME, alex.id], alex.id, [ME]],
    ['the last member can be unpicked', [alex.id], alex.id, []],
    ['Everyone replaces members', [ME, alex.id], 'everyone', ['everyone']],
    ['a member replaces Everyone', ['everyone'], alex.id, [alex.id]],
    ['Others goes with anything', ['everyone'], 'others', ['everyone', 'others']],
    ['Everyone keeps Others', [ME, 'others'], 'everyone', ['everyone', 'others']],
    ['a member keeps Others', ['everyone', 'others'], alex.id, ['others', alex.id]],
    ['Others alone is fine', [ME, 'others'], ME, ['others']],
    ['unpicking Others', [ME, 'others'], 'others', [ME]],
    ['unpicking Everyone', ['everyone', 'others'], 'everyone', ['others']],
    ['nobody left is allowed (Save asks for someone)', ['others'], 'others', []],
  ] as const)('%s', (_, who, key, expected) => {
    expect(toggleWho(who, key)).toEqual(expected);
  });

  it('offers Everyone, every member, then Others', () => {
    expect(whoChips(members).map((c) => `${c.name}:${c.initial}:${c.color}`)).toEqual(['Everyone:All:everyone', 'Gabriel:G:honey', 'Alex:A:rose', 'James:J:mint', 'Others::others']);
  });

  it('asks who takes members without the app, from members with it', () => {
    expect(managedOn([ME, james.id], members)).toEqual([james]);
    expect(managedOn(['everyone'], members)).toEqual([]);
    expect(takers(members)).toEqual([gabriel, alex]);
  });
});

describe('When tiles (FR-001)', () => {
  it('dates Today and Tomorrow, and shows the other day once picked', () => {
    expect(dayTiles(TODAY, TODAY)).toEqual({ today: 'Wed 28', tomorrow: 'Thu 29', other: 'Pick a date', picked: 'today' });
    expect(dayTiles(TODAY, '2026-10-29').picked).toBe('tomorrow');
    expect(dayTiles(TODAY, '2026-10-31')).toMatchObject({ other: 'Sat, Oct 31', picked: 'other' });
  });

  it('lays out a month for the date sheet, in the week’s order', () => {
    const oct = dateGridMonth('2026-10-01', TODAY, 0);
    expect(oct.title).toBe('October 2026');
    expect(oct.weeks[0]?.slice(0, 4)).toEqual([null, null, null, null]);
    expect(oct.weeks[0]?.[4]).toMatchObject({ date: '2026-10-01', day: 1, label: 'Thursday, Oct 1' });
    expect(oct.weeks.flat().find((d) => d?.today)?.date).toBe(TODAY);
    expect(oct.weeks.every((w) => w.length === 7)).toBe(true);
    const monday = dateGridMonth('2026-10-01', TODAY, 1, '2026-10-02');
    expect(monday.weeks[0]?.slice(0, 3)).toEqual([null, null, null]);
    expect(monday.weeks[0]?.[3]).toMatchObject({ day: 1, disabled: true });
    expect(monday.weeks[0]?.[4]).not.toHaveProperty('disabled');
    expect(shiftMonth('2026-12-01', 1)).toBe('2027-01-01');
    expect(shiftMonth('2026-01-01', -1)).toBe('2025-12-01');
  });
});

describe('what Save sends (FR-005)', () => {
  it('a quick add: the title, today, the slot, me', () => {
    expect(toInput(draft({ title: '  Poker night ', time: slots('evening') }), members)).toEqual({
      title: 'Poker night',
      category: null,
      location: null,
      notes: null,
      starts_on: TODAY,
      ends_on: TODAY,
      time_type: 'slot',
      slots: ['evening'],
      start_time: null,
      end_time: null,
      recurrence: null,
      reminder: 'none',
      members: [ME],
      responsible_member_id: null,
      visibility: 'family',
      surprise: null,
      checklist: [],
    });
  });

  it('US2: weekly on Saturday from the next Saturday, who takes James, the place', () => {
    const input = toInput(
      draft({ who: [ME, james.id], repeat: 'weekly', weekdays: [6], location: 'Little Notes studio', responsible: ME, time: slots('morning'), checklist: [{ label: ' Shaker ' }, { label: ' ' }] }),
      members,
    );
    expect(input).toMatchObject({
      starts_on: '2026-10-31',
      ends_on: '2026-10-31',
      recurrence: { freq: 'weekly', weekdays: [6], ends: { type: 'never' } },
      members: [ME, james.id],
      responsible_member_id: ME,
      location: 'Little Notes studio',
      checklist: [{ label: 'Shaker' }],
    });
  });

  it('forgets who takes them once no member without the app is on it, or the taker can’t', () => {
    expect(toInput(draft({ who: [ME], responsible: ME }), members).responsible_member_id).toBeNull();
    expect(toInput(draft({ who: [james.id], responsible: james.id }), members).responsible_member_id).toBeNull();
  });

  it('repeats with their end, and weekly on the start day when no day is picked', () => {
    expect(toInput(draft({ repeat: 'weekly' }), members).recurrence).toEqual({ freq: 'weekly', weekdays: [3], ends: { type: 'never' } });
    expect(toInput(draft({ repeat: 'monthly', ends: { type: 'on', date: '2027-01-28' } }), members).recurrence).toEqual({ freq: 'monthly', ends: { type: 'on', date: '2027-01-28' } });
    expect(toInput(draft({ repeat: 'daily', ends: { type: 'after', count: ' 5 ' } }), members).recurrence).toEqual({ freq: 'daily', ends: { type: 'after', count: 5 } });
    expect(endsProblem(draft({ repeat: 'daily', ends: { type: 'after', count: 'five' } }))).toBe(true);
    expect(endsProblem(draft({ repeat: 'daily', ends: { type: 'after', count: '1001' } }))).toBe(true);
    expect(endsProblem(draft({ repeat: 'never', ends: { type: 'after', count: '' } }))).toBe(false);
    expect(toInput(draft({ repeat: 'daily', ends: { type: 'after', count: 'x' } }), members).recurrence?.ends).toEqual({ type: 'after', count: 1 });
  });

  it('custom times, and keeps a multi-day event’s length', () => {
    expect(toInput(draft({ time: { kind: 'custom', start: '19:30', end: '21:00' }, span: 2 }), members)).toMatchObject({
      time_type: 'custom',
      slots: [],
      start_time: '19:30',
      end_time: '21:00',
      ends_on: '2026-10-30',
    });
  });
});

describe('editing (FR-008)', () => {
  const event = stored({
    category: 'social',
    location: 'Sam’s',
    notes: 'Snacks',
    recurrence: { freq: 'weekly', weekdays: [3], ends: { type: 'after', count: 10 } },
    members: [ME],
    reminder: 'hour_before',
    checklist: [{ id: '3f0c1d6e-2b1a-4c8e-9a52-0d7e1f4b6a13', position: 0, label: 'Chips', done: true, done_by: null }],
  });

  it('fills the sheet from the event', () => {
    expect(draftFromEvent(event)).toMatchObject({
      title: 'Movie night',
      date: TODAY,
      time: slots('evening'),
      category: 'social',
      location: 'Sam’s',
      repeat: 'weekly',
      weekdays: [3],
      ends: { type: 'after', count: '10' },
      reminder: 'hour_before',
      checklist: [{ id: '3f0c1d6e-2b1a-4c8e-9a52-0d7e1f4b6a13', label: 'Chips' }],
    });
    expect(draftFromEvent(stored({ time_type: 'custom', slots: [], start_time: '19:00', end_time: '20:00' })).time).toEqual({ kind: 'custom', start: '19:00', end: '20:00' });
    expect(draftFromEvent(stored({ time_type: 'all_day', slots: [], recurrence: { freq: 'yearly', ends: { type: 'on', date: '2030-10-28' } } }))).toMatchObject({
      time: { kind: 'all_day' },
      ends: { type: 'on', date: '2030-10-28' },
    });
    expect(draftFromEvent(stored({ reminder: null, checklist: null })).checklist).toEqual([]);
  });

  it('opens More options when anything in it is set', () => {
    expect(hasMoreOptions(draft())).toBe(false);
    for (const over of [{ category: 'sport' as const }, { location: 'Gym' }, { responsible: ME }, { repeat: 'daily' as const }, { reminder: 'morning_of' as const }, { notes: 'x' }, { checklist: [{ label: 'x' }] }]) {
      expect(hasMoreOptions(draft(over))).toBe(true);
    }
  });

  it('names the fields that changed, never their values', () => {
    const before = toInput(draftFromEvent(event), members);
    expect(changedFields(before, before)).toEqual([]);
    const after = toInput({ ...draftFromEvent(event), title: 'Film night', time: slots('afternoon', 'evening'), who: ['everyone'], repeat: 'never', checklist: [] }, members);
    expect(changedFields(before, after)).toEqual(['title', 'time', 'who', 'repeat', 'checklist']);
  });

  it('"This event only" replaces only what changed, and what an occurrence can carry', () => {
    const d = draftFromEvent(event);
    const before = toInput(d, members, { occurrence: true });
    expect(overrideFor(before, before)).toEqual({});
    const after = toInput({ ...d, title: 'Film night', date: '2026-10-29', time: { kind: 'custom', start: '19:00', end: '21:00' }, location: '', notes: '', category: null, reminder: 'none' }, members, { occurrence: true });
    expect(overrideFor(before, after)).toEqual({
      title: 'Film night',
      category: null,
      location: null,
      notes: null,
      starts_on: '2026-10-29',
      ends_on: '2026-10-29',
      time_type: 'custom',
      slots: [],
      start_time: '19:00',
      end_time: '21:00',
    });
    const moved = toInput({ ...d, who: [ME, james.id], responsible: ME, time: slots('lunch') }, members);
    expect(overrideFor(before, moved)).toEqual({ members: [ME, james.id], responsible_member_id: ME, time_type: 'slot', slots: ['lunch'], start_time: null, end_time: null });
    expect(overrideFor(before, toInput({ ...d, time: { kind: 'all_day' } }, members))).toMatchObject({ time_type: 'all_day' });
  });

  it('"All future events" ends the old series and keeps what’s left of the count', () => {
    const series = stored({ starts_on: '2026-10-07', ends_on: '2026-10-07', recurrence: { freq: 'weekly', weekdays: [3], ends: { type: 'after', count: 10 } } });
    const d = draftFromEvent(series, TODAY);
    const split = futureSplit(series, TODAY, toInput({ ...d, time: slots('afternoon') }, members));
    expect(split?.before.ends).toEqual({ type: 'on', date: '2026-10-27' });
    expect(split?.input).toMatchObject({ starts_on: TODAY, slots: ['afternoon'], recurrence: { ends: { type: 'after', count: 7 } } });
    const changedEnd = futureSplit(series, TODAY, toInput({ ...d, ends: { type: 'never' } }, members));
    expect(changedEnd?.input.recurrence?.ends).toEqual({ type: 'never' });
    expect(futureSplit(series, TODAY, toInput({ ...d, repeat: 'never' }, members))?.input.recurrence).toBeNull();
    expect(futureSplit(series, '2026-10-07', toInput(d, members))).toBeNull();
  });

  it('asks which ones, in the repeat’s words', () => {
    const weekly = stored({ recurrence: { freq: 'weekly', ends: { type: 'never' } } });
    expect(scopeBody(stored({ recurrence: { freq: 'weekly', ends: { type: 'never' } } }), '2026-10-31')).toBe('Change only Saturday, Oct 31, or every Saturday from now on?');
    expect(scopeBody({ ...weekly, recurrence: { freq: 'biweekly', ends: { type: 'never' } } }, '2026-10-31')).toBe('Change only Saturday, Oct 31, or every other Saturday from now on?');
    expect(scopeBody({ ...weekly, recurrence: { freq: 'daily', ends: { type: 'never' } } }, '2026-10-31')).toBe('Change only Saturday, Oct 31, or every day from now on?');
    expect(scopeBody({ ...weekly, recurrence: { freq: 'yearly', ends: { type: 'never' } } }, '2026-10-31')).toBe('Change only Saturday, Oct 31, or every year from now on?');
    expect(scopeBody({ ...weekly, recurrence: null }, '2026-10-31')).toBe('Change only Saturday, Oct 31, or  from now on?');
  });
});

describe('the conflict line (FR-006, US3)', () => {
  const movie = stored();

  it('US3: “You already have Movie night this evening.”', () => {
    expect(conflictLine(draft({ time: slots('evening') }), [movie], members, ME, DEFAULT_SLOT_TIMES)).toBe('You already have Movie night this evening.');
  });

  it('names someone else, or Everyone', () => {
    const swim = stored({ title: 'Baby swim class', slots: ['afternoon'], members: [james.id] });
    expect(conflictLine(draft({ time: slots('afternoon'), who: [james.id] }), [swim], members, ME, DEFAULT_SLOT_TIMES)).toBe('James already has Baby swim class this afternoon.');
    expect(conflictLine(draft({ time: slots('evening'), who: ['everyone'] }), [movie], members, ME, DEFAULT_SLOT_TIMES)).toBe('Everyone already has Movie night this evening.');
    expect(conflictLine(draft({ time: slots('afternoon'), who: ['everyone'] }), [stored({ title: 'X', slots: ['afternoon'], members: ['3f0c1d6e-2b1a-4c8e-9a52-0d7e1f4b6a99'] })], members, ME, DEFAULT_SLOT_TIMES)).toBe(
      'Everyone already has X this afternoon.',
    );
  });

  it('says nothing all day, without a clash, on itself, or with times still being typed', () => {
    expect(conflictLine(draft(), [movie], members, ME, DEFAULT_SLOT_TIMES)).toBeNull();
    expect(conflictLine(draft({ time: slots('morning') }), [movie], members, ME, DEFAULT_SLOT_TIMES)).toBeNull();
    expect(conflictLine(draft({ time: slots('evening') }), [movie], members, ME, DEFAULT_SLOT_TIMES, movie.id)).toBeNull();
    expect(conflictLine(draft({ time: { kind: 'custom', start: '19', end: '' } }), [movie], members, ME, DEFAULT_SLOT_TIMES)).toBeNull();
  });

  it('a private event reads Busy, and a broken one is skipped', () => {
    const hidden = stored({ title: 'Busy', visibility: 'private', members: [ME] });
    expect(conflictLine(draft({ time: slots('evening') }), [hidden], members, ME, DEFAULT_SLOT_TIMES)).toBe('You already have Busy this evening.');
    const broken = { ...movie, slots: ['morning', 'evening'] } as StoredEvent;
    expect(conflictLine(draft({ time: slots('evening') }), [broken], members, ME, DEFAULT_SLOT_TIMES)).toBeNull();
  });
});

describe('the toast (FR-009)', () => {
  const input = (over: Partial<EventDraft>) => toInput(draft(over), members);

  it.each([
    ['tonight', { time: slots('evening') }, 'Poker night added for tonight, 18:00–22:00.'],
    ['today', { time: slots('lunch') }, 'Poker night added for today, 12:00–14:00.'],
    ['tomorrow', { date: '2026-10-29', time: slots('afternoon', 'evening') }, 'Poker night added for tomorrow, 14:00–22:00.'],
    ['another day', { date: '2026-10-31', time: { kind: 'custom', start: '19:30', end: '23:00' } }, 'Poker night added for Sat, Oct 31, 19:30–23:00.'],
    ['all day', { date: '2026-10-31' }, 'Poker night added for Sat, Oct 31.'],
  ] as const)('%s', (_, over, text) => {
    expect(toastText(input(over), TODAY, DEFAULT_SLOT_TIMES)).toBe(text);
  });
});

describe('who can see it (spec 043)', () => {
  const eva = { ...alex, display_name: 'Eva' };
  const family = [gabriel, eva, james];

  it('keeps it secret from the members with the app in Who, except the creator', () => {
    expect(secretFrom([ME, eva.id, james.id], family, ME)).toEqual([eva.id]);
    expect(secretFrom(['everyone'], family, ME)).toEqual([eva.id]);
    expect(secretFrom(['everyone'], family, eva.id)).toEqual([ME]);
    expect(secretFrom([ME, james.id, 'others'], family, ME)).toEqual([]);
  });

  it('US1: a private event saves as private, with no cover', () => {
    expect(toInput(draft({ visibility: 'private', coverTitle: 'left over' }), family)).toMatchObject({ visibility: 'private', surprise: null });
  });

  it('US2: a surprise saves who it is kept from, the cover title and the note', () => {
    const d = draft({ title: 'Eva’s surprise dinner', visibility: 'surprise', hiddenFrom: [eva.id], coverTitle: ' Dinner out ', coverNote: 'Meet at Café Lalo at 19:30. Dress nice!' });
    expect(surpriseProblems(d, family)).toEqual({});
    expect(toInput(d, family)).toMatchObject({
      visibility: 'surprise',
      surprise: { hidden_from: [eva.id], cover_title: 'Dinner out', cover_note: 'Meet at Café Lalo at 19:30. Dress nice!' },
    });
    expect(toInput({ ...d, coverNote: '  ' }, family).surprise?.cover_note).toBeNull();
  });

  describe('who a saved surprise is kept from', () => {
    const lea = { ...alex, id: '3f0c1d6e-2b1a-4c8e-9a52-0d7e1f4b6a77', display_name: 'Léa' };
    const fam = [gabriel, eva, lea, james];
    const saved = draft({ visibility: 'surprise', who: [ME, eva.id], hiddenFrom: [lea.id], coverTitle: 'Dinner out' });
    const whole = { canChange: true, occurrence: false };

    it('follows Who for a new surprise, or when its creator changes Who on the whole event', () => {
      const fresh = draft({ visibility: 'surprise', who: [eva.id] });
      expect(surpriseHiddenFrom(fresh, draft(), fam, ME, whole)).toEqual({ hiddenFrom: [eva.id], revealed: [] });
      expect(surpriseHiddenFrom({ ...saved, who: [lea.id] }, saved, fam, ME, whole)).toEqual({ hiddenFrom: [lea.id], revealed: [] });
    });

    it('keeps the saved list when Who is untouched, even if they differ', () => {
      expect(surpriseHiddenFrom({ ...saved, title: 'Renamed' }, saved, fam, ME, whole)).toEqual({ hiddenFrom: [lea.id], revealed: [] });
    });

    it('keeps it for one date or someone else editing, and names who Who would reveal it to', () => {
      const added = { ...saved, who: [ME, eva.id, lea.id, james.id] };
      expect(surpriseHiddenFrom(added, saved, fam, ME, { canChange: true, occurrence: true })).toEqual({ hiddenFrom: [lea.id], revealed: [] });
      const toEva = draft({ ...saved, who: [ME, james.id] });
      expect(surpriseHiddenFrom({ ...toEva, who: [ME, james.id, eva.id] }, toEva, fam, ME, { canChange: false, occurrence: false })).toEqual({ hiddenFrom: [lea.id], revealed: [eva.id] });
    });
  });

  it('says what a surprise is missing', () => {
    expect(surpriseProblems(draft({ visibility: 'surprise', hiddenFrom: [eva.id] }), family)).toEqual({ coverTitle: 'Add what Eva will see.' });
    expect(surpriseProblems(draft({ visibility: 'surprise', coverTitle: 'Dinner out' }), family)).toEqual({ hiddenFrom: 'Pick who the surprise is for in Who: someone with the app, other than you.' });
    expect(surpriseProblems(draft({ visibility: 'private' }), family)).toEqual({});
  });

  it('an edit starts from the saved surprise, with More options open', () => {
    const d = draftFromEvent(stored({ visibility: 'surprise', surprise: { hidden_from: [eva.id], cover_title: 'Dinner out', cover_note: null } }));
    expect(d).toMatchObject({ visibility: 'surprise', hiddenFrom: [eva.id], coverTitle: 'Dinner out', coverNote: '' });
    expect(hasMoreOptions(d)).toBe(true);
  });
});
