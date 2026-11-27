// Spec 058: where reminders show in Agenda and Day (FR-001–FR-003), and what a box press does.
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SLOT_TIMES } from '@cocon/calendar';
import type { StoredEvent } from '@cocon/data';
import { alex, gabriel, placedReminder } from '../test/fakes';
import { layoutAgenda } from './calendar-agenda';
import { isDayEvent, layoutDaySheet, layoutDayView } from './calendar-day';
import { memberLook, monthOccurrences } from './calendar-month';
import { marksBelow } from './calendar-week';
import { placeReminders, pressReminderBox, readAgendaReminders, reminderCounts, reminderDay, writeAgendaReminders, type PlaceContext } from './calendar-reminders';

// Wednesday, Nov 11, 2026 in Paris (UTC+1), as on OC-CalAgendaReminders.
const tz = 'Europe/Paris';
const today = '2026-11-11';
const members = [gabriel, alex];
const ctx: PlaceContext = { from: today, to: '2026-11-24', today, tz, members, use24h: true, hidden: new Set() };
/** Midnight Paris on `date`: an "any time" reminder's due_at. */
const anyTime = (date: string) => new Date(`${date}T00:00:00+01:00`).toISOString();
const late = (date: string, fields: Parameters<typeof placedReminder>[0] = {}) =>
  placedReminder({ due_on: date, due_at: anyTime(date), has_time: false, rollover: 'day', section: 'overdue', late_days: 1, late_hours: 24, ...fields });
const view = (x: ReturnType<typeof placeReminders>[number]) => [x.date, x.item.title, x.item.sub, x.item.late, x.item.future];

describe('reminderDay (FR-002)', () => {
  it('brings late ones to today, keeps "Leave it" on its day, and "Next week" on its weekday', () => {
    expect(reminderDay(late('2026-11-09'), today, tz)).toBe(today);
    expect(reminderDay(late('2026-11-09', { rollover: 'none' }), today, tz)).toBe('2026-11-09');
    expect(reminderDay(late('2026-11-09', { rollover: 'week' }), today, tz)).toBe('2026-11-16');
    expect(reminderDay(late('2026-11-04', { rollover: 'week' }), today, tz)).toBe(today);
    expect(reminderDay(placedReminder({ section: 'later', snoozed: true, snoozed_until: '2026-11-13T08:00:00Z' }), today, tz)).toBe('2026-11-13');
  });
});

describe('placeReminders (FR-001–FR-003)', () => {
  it('words each row as the screen does: late ones by who and when they were due, the rest by time and who', () => {
    const rows = [
      late('2026-11-09', { title: 'Water the plants', late_days: 2 }),
      late('2026-11-10', { title: 'Call the car insurance', assignee_id: alex.id }),
      placedReminder({ title: 'Take the bins out', due_at: '2026-11-11T19:00:00Z' }),
      placedReminder({ title: 'Pay the daycare', assignee_id: null, due_on: '2026-11-12', due_at: anyTime('2026-11-12'), has_time: false, section: 'tomorrow' }),
    ];
    expect(placeReminders(rows, ctx).map(view)).toEqual([
      [today, 'Water the plants', 'Gabriel · was due Mon', '2d late', false],
      [today, 'Call the car insurance', 'Alex · was due yesterday', '1d late', false],
      [today, 'Take the bins out', '20:00 · Gabriel', null, false],
      ['2026-11-12', 'Pay the daycare', 'Any time · Everyone', null, false],
    ]);
  });

  it('draws later repeats, which can’t be ticked yet', () => {
    const weekly = placedReminder({ title: 'Change the water filter', repeat_rule: { freq: 'weekly', ends: { type: 'never' } }, repeat_from: '2026-11-04' });
    expect(placeReminders([weekly], ctx).map(view)).toEqual([
      [today, 'Change the water filter', '15:00 · Gabriel', null, false],
      ['2026-11-18', 'Change the water filter', '15:00 · Gabriel', null, true],
    ]);
  });

  it('puts a snoozed one on the day and at the time it comes back, not as late', () => {
    const snoozed = placedReminder({ title: 'Book James’s check-up', due_on: '2026-11-10', due_at: '2026-11-10T14:00:00Z', section: 'later', snoozed: true, snoozed_until: '2026-11-13T09:00:00Z' });
    const [x] = placeReminders([snoozed], ctx);
    expect(x && [x.date, x.time, x.overdue, x.item.sub, x.item.late]).toEqual(['2026-11-13', '10:00', false, '10:00 · Gabriel', null]);
  });

  it('leaves out reminders for people the header hides, and those snoozed or deleted here', () => {
    const mine = placedReminder({ title: 'Mine' });
    const everyones = placedReminder({ title: 'Everyone’s', assignee_id: null });
    expect(placeReminders([mine, everyones], { ...ctx, hidden: new Set([gabriel.id]) }).map((x) => x.item.title)).toEqual(['Everyone’s']);
    expect(placeReminders([mine, everyones], { ...ctx, hidden: new Set(['everyone']) }).map((x) => x.item.title)).toEqual(['Mine']);
    expect(placeReminders([mine, everyones], { ...ctx, gone: new Set([mine.id]) }).map((x) => x.item.title)).toEqual(['Everyone’s']);
  });

  it('keeps a ticked one where it was, done, and drops the list’s copy from before the tick', () => {
    const row = late('2026-11-09', { title: 'Water the plants' });
    const placed = placeReminders([row], { ...ctx, ticked: new Map([[row.id, { row }]]) });
    expect(placed.map((x) => [x.date, x.item.sub, x.item.done, x.item.late, x.item.toggleLabel])).toEqual([[today, 'Done just now', true, null, 'Mark not done: Water the plants']]);
  });
});

describe('done today (spec 058)', () => {
  it('goes to the bottom of today, ticked here last, until midnight; never marks Month or Week', () => {
    const tomorrow = placedReminder({ title: 'Pay the daycare', due_on: '2026-11-12', due_at: '2026-11-12T10:00:00Z', section: 'tomorrow' });
    const open = placedReminder({ title: 'Take the bins out', due_at: '2026-11-11T19:00:00Z' });
    const earlier = placedReminder({ title: 'Water the plants', due_at: '2026-11-11T08:00:00Z' });
    const undo = { id: earlier.id, from_due_at: earlier.due_at, reopen: [], due_at: earlier.due_at, next_due_at: null, snoozed_until: null };
    const placed = placeReminders([open], {
      ...ctx,
      ticked: new Map([[tomorrow.id, { row: tomorrow }]]),
      done: [
        { row: earlier, closedAt: '2026-11-11T09:20:00Z', undo },
        { row: { ...earlier, id: '00000000-0000-4000-9000-999999999999', title: 'Old date' }, closedAt: '2026-11-11T09:00:00Z', undo: null },
      ],
    });
    const dayCtx = { today, now: '09:00', look: memberLook(members), slotTimes: DEFAULT_SLOT_TIMES, members };
    const [group] = layoutAgenda(today, today, [], dayCtx, placed);
    expect(group?.events.map((e) => [e.title, e.sub])).toEqual([
      ['Take the bins out', '20:00 · Gabriel'],
      ['Old date', 'Done at 10:00'],
      ['Water the plants', 'Done at 10:20'],
      ['Pay the daycare', 'Done just now'],
    ]);
    expect(placed.find((x) => x.item.title === 'Old date')?.item.locked).toBe(true);
    expect([...reminderCounts(placed)]).toEqual([[today, 1]]);
    expect(layoutDayView(today, [], dayCtx, placed).done.map((x) => x.title)).toEqual(['Old date', 'Water the plants', 'Pay the daycare']);
    expect(layoutDaySheet(today, [], dayCtx, placed).count).toBe('1 reminder');
  });
});

describe('pressReminderBox', () => {
  it('ticks, unticks, or says "Not yet" for a later repeat', () => {
    const weekly = placedReminder({ repeat_rule: { freq: 'weekly', ends: { type: 'never' } }, repeat_from: '2026-11-04' });
    const [open, later] = placeReminders([weekly], ctx);
    const on = { onTick: vi.fn(), onUntick: vi.fn(), onNotYet: vi.fn() };
    if (!open || !later) throw new Error('two rows expected');
    pressReminderBox(open, on);
    pressReminderBox(later, on);
    pressReminderBox({ ...open, item: { ...open.item, done: true } }, on);
    expect(on.onTick).toHaveBeenCalledWith(weekly);
    expect(on.onNotYet).toHaveBeenCalledWith('2026-11-18');
    expect(on.onUntick).toHaveBeenCalledWith(weekly.id, weekly.due_at);
  });
});

describe('the pill (FR-004)', () => {
  it('is on at first and remembers off per person', async () => {
    const kept = new Map<string, string>();
    const storage = { getItem: async (k: string) => kept.get(k) ?? null, setItem: async (k: string, v: string) => void kept.set(k, v) };
    expect(await readAgendaReminders(storage, 'u-gabriel')).toBe(true);
    await writeAgendaReminders(storage, 'u-gabriel', false);
    expect(await readAgendaReminders(storage, 'u-gabriel')).toBe(false);
    expect(await readAgendaReminders(storage, 'u-alex')).toBe(true);
  });
});

// Mixed with events (FR-001): late first, then all-day events, any-time reminders, then by time.
function ev(id: string, title: string, fields: Partial<StoredEvent>): StoredEvent {
  return {
    id,
    title,
    category: null,
    location: null,
    notes: null,
    reminder: null,
    starts_on: today,
    ends_on: today,
    time_type: 'exact',
    slots: [],
    start_time: null,
    end_time: null,
    recurrence: null,
    members: [gabriel.id],
    responsible_member_id: null,
    visibility: 'family',
    creator_member_id: gabriel.id,
    surprise: null,
    removed_members: [],
    exceptions: [],
    created_by: null,
    updated_by: null,
    source: 'app',
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
    deleted_at: null,
    ...fields,
  } as StoredEvent;
}

describe('Agenda and Day with reminders (FR-001)', () => {
  const events = [
    ev('00000000-0000-4000-8000-000000000001', 'Dinner at the Macias’', { start_time: '19:30', end_time: '22:00' }),
    ev('00000000-0000-4000-8000-000000000002', 'Market day', { time_type: 'all_day' }),
    ev('00000000-0000-4000-8000-000000000003', 'Bins night', { start_time: '20:00', end_time: '20:30' }),
  ];
  const reminders = placeReminders(
    [
      placedReminder({ title: 'Take the bins out', due_at: '2026-11-11T19:00:00Z' }),
      placedReminder({ title: 'Book James’s check-up', due_at: '2026-11-11T14:00:00Z' }),
      placedReminder({ title: 'Pay the daycare', due_at: anyTime(today), has_time: false }),
      late('2026-11-10', { title: 'Call the car insurance' }),
      late('2026-11-09', { title: 'Water the plants' }),
    ],
    { ...ctx, to: today },
  );
  const occurrences = monthOccurrences(events, today, today, gabriel.id, new Set());
  const dayCtx = { today, now: '09:00', look: memberLook(members), slotTimes: DEFAULT_SLOT_TIMES, members };

  it('Agenda: one list, late ones oldest first, any time before the timed ones, events first at the same time', () => {
    const [group] = layoutAgenda(today, today, occurrences, dayCtx, reminders);
    expect(group?.events.map((e) => [e.kind ?? 'event', e.title])).toEqual([
      ['reminder', 'Water the plants'],
      ['reminder', 'Call the car insurance'],
      ['event', 'Market day'],
      ['reminder', 'Pay the daycare'],
      ['reminder', 'Book James’s check-up'],
      ['event', 'Dinner at the Macias’'],
      ['event', 'Bins night'],
      ['reminder', 'Take the bins out'],
    ]);
  });

  it('Agenda: a day with only reminders still gets its heading', () => {
    const only = placeReminders([placedReminder({ title: 'Pay the daycare', due_on: '2026-11-12', due_at: '2026-11-12T10:00:00Z', section: 'tomorrow' })], ctx);
    expect(layoutAgenda(today, '2026-11-12', [], dayCtx, only).map((g) => g.heading)).toEqual(['Tomorrow · Thu, Nov 12']);
  });

  it('Day: late and any-time ones under All day, timed ones in their band among the events', () => {
    const day = layoutDayView(today, occurrences, dayCtx, reminders);
    expect(day.allDay.map((a) => a.title)).toEqual(['Water the plants', 'Call the car insurance', 'Market day', 'Pay the daycare']);
    expect(day.bands.map((b) => [b.slot, b.events.map((e) => e.title)])).toEqual([
      ['early_morning', []],
      ['morning', []],
      ['lunch', []],
      ['afternoon', ['Book James’s check-up']],
      ['evening', ['Dinner at the Macias’', 'Bins night', 'Take the bins out']],
    ]);
    // A band with only a reminder in it has no add row: `events` isn't empty.
    expect(day.bands[3]?.events.filter(isDayEvent)).toEqual([]);
  });
});

describe('Month, Week and the day sheet (spec 058)', () => {
  it('counts reminders per day, and the day sheet says how many there are with its events', () => {
    const weekly = placedReminder({ title: 'Take the bins out', repeat_rule: { freq: 'weekly', ends: { type: 'never' } }, repeat_from: '2026-11-04' });
    const placed = placeReminders([weekly, late('2026-11-09')], ctx);
    expect([...reminderCounts(placed)]).toEqual([
      [today, 2],
      ['2026-11-18', 1],
    ]);
    const dayCtx = { today, now: '09:00', look: memberLook(members), slotTimes: DEFAULT_SLOT_TIMES, members };
    expect(layoutDaySheet(today, [], dayCtx, placed).count).toBe('2 reminders');
    const dinner = ev('00000000-0000-4000-8000-000000000009', 'Dinner', { start_time: '19:30', end_time: '21:00' });
    const sheet = layoutDaySheet(today, monthOccurrences([dinner], today, today, gabriel.id, new Set()), dayCtx, placed);
    expect(sheet.count).toBe('1 event · 2 reminders');
    expect(sheet.rows.map((r) => r.title)).toEqual(['Reminder', 'Take the bins out', 'Dinner']);
  });
});

describe('Week’s alarm clocks (spec 058)', () => {
  const week = ['2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14'];
  it('stay beside the numbers when they all fit, and all go under when one doesn’t', () => {
    // 430 px: columns about 51 wide; 390 px: about 46, too narrow for today's 28 px circle and the clock.
    expect(marksBelow(week, { today, reminders: new Map([['2026-11-11', 1]]), width: 430 })).toBe(false);
    expect(marksBelow(week, { today, reminders: new Map([['2026-11-11', 1]]), width: 390 })).toBe(true);
    expect(marksBelow(week, { today, reminders: new Map([['2026-11-12', 1]]), width: 390 })).toBe(false);
    expect(marksBelow(week, { today, reminders: new Map([['2026-11-12', 1]]), width: 390, textScale: 2 })).toBe(true);
    expect(marksBelow(week, { today, reminders: new Map([['2026-11-11', 1]]) })).toBe(false);
  });
});
