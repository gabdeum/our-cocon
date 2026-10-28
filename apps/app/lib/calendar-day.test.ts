// Spec 039: what the day view shows. User Story 1 (who's busy, All day, the five bands with their
// events or an add row), and the edges the canvas doesn't draw.
import { describe, expect, it } from 'vitest';
import { DEFAULT_SLOT_TIMES } from '@cocon/calendar';
import type { StoredEvent } from '@cocon/data';
import { gabriel, james, mia } from '../test/fakes';
import { memberLook, monthOccurrences } from './calendar-month';
import { layoutDayView, type DayViewContext } from './calendar-day';

const eva = { ...mia, id: 'm-eva', display_name: 'Eva', color: 'rose' as const };
const members = [gabriel, eva, james];
const TODAY = '2026-10-25';
const ctx: DayViewContext = { today: TODAY, now: '13:20', look: memberLook(members), slotTimes: DEFAULT_SLOT_TIMES, members };

let n = 0;
function ev(fields: Partial<StoredEvent>): StoredEvent {
  n += 1;
  return {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    title: 'Event',
    category: null,
    location: null,
    notes: null,
    reminder: null,
    starts_on: TODAY,
    ends_on: TODAY,
    time_type: 'slot',
    slots: ['morning'],
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
    checklist: [],
    created_by: null,
    updated_by: null,
    source: 'app',
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
    deleted_at: null,
    ...fields,
  };
}

const layout = (events: StoredEvent[], date = TODAY, viewer = gabriel.id, hidden: ReadonlySet<string> = new Set()) =>
  layoutDayView(date, monthOccurrences(events, '2026-10-01', '2026-11-30', viewer, hidden), ctx);

// OC-CalDay's Sunday.
const sunday = () => [
  ev({ title: 'Brunch at Grandma’s', slots: ['lunch'], location: 'Grandma’s house', members: ['everyone'] }),
  ev({ title: 'Baby swim class', time_type: 'custom', slots: [], start_time: '14:30', end_time: '16:30', location: 'Aquatic Center', members: [james.id], responsible_member_id: gabriel.id }),
  ev({ title: 'Coffee with Sam', time_type: 'custom', slots: [], start_time: '16:00', end_time: '17:00', location: 'Café Lalo' }),
  ev({ title: 'Movie night', slots: ['evening'], location: 'Living room', members: ['everyone'] }),
  ev({ title: 'Poker night', slots: ['evening'], location: 'at Sam’s' }),
];

describe('layoutDayView', () => {
  it('US1: who’s busy with counts, in member order, then Everyone', () => {
    expect(layout(sunday()).busy.map((c) => [c.text, c.initial, c.color])).toEqual([
      ['Gabriel 2', 'G', gabriel.color],
      ['James 1', 'J', 'mint'],
      ['Everyone 2', 'All', 'everyone'],
    ]);
  });

  it('US1: the five bands, each with its events or an add row', () => {
    const { bands, allDay } = layout(sunday());
    expect(allDay).toEqual([]);
    expect(bands.map((b) => [b.title, b.hours, b.events.map((e) => e.title), b.events.length ? null : b.addText])).toEqual([
      ['Early morning', '06:00–09:00', [], '+ Add in the early morning'],
      ['Morning', '09:00–12:00', [], '+ Add in the morning'],
      ['Lunch', '12:00–14:00', ['Brunch at Grandma’s'], null],
      ['Afternoon', '14:00–18:00', ['Baby swim class', 'Coffee with Sam'], null],
      ['Evening', '18:00–22:00', ['Movie night', 'Poker night'], null],
    ]);
    expect(bands[1]?.addLabel).toBe('Add event in the morning, Sunday October 25');
  });

  it('FR-003: the time line, who takes James, and Now while it’s happening', () => {
    const rows = layout(sunday()).bands.flatMap((b) => b.events);
    expect(rows.map((r) => [r.title, r.time, r.driver, r.nowText, r.initials])).toEqual([
      ['Brunch at Grandma’s', 'Lunch · Grandma’s house', null, 'Now', 'All'],
      ['Baby swim class', '14:30 · Aquatic Center', 'Gabriel takes James', null, 'J'],
      ['Coffee with Sam', '16:00 · Café Lalo', null, null, 'G'],
      ['Movie night', 'Evening · Living room', null, null, 'All'],
      ['Poker night', 'Evening · at Sam’s', null, null, 'G'],
    ]);
    expect(rows[1]?.label).toBe('Baby swim class, 14:30 · Aquatic Center, Gabriel takes James');
    expect(rows[0]?.label).toBe('Brunch at Grandma’s, Lunch · Grandma’s house, happening now');
  });

  it('FR-003: Now only on today', () => {
    const rows = layout(sunday().map((e) => ({ ...e, starts_on: '2026-10-26', ends_on: '2026-10-26' })), '2026-10-26').bands.flatMap((b) => b.events);
    expect(rows.every((r) => r.nowText === null)).toBe(true);
  });

  it('FR-002: All day rows with "Birthday" and "Day 2 of 3"; they count as busy', () => {
    const day = '2026-10-28';
    const { allDay, busy } = layout(
      [
        ev({ title: 'Eva’s birthday', category: 'birthday', time_type: 'all_day', slots: [], starts_on: day, ends_on: day, members: [eva.id], recurrence: { freq: 'yearly', ends: { type: 'never' } } }),
        ev({ title: 'Lyon trip', time_type: 'all_day', slots: [], starts_on: '2026-10-27', ends_on: '2026-10-29', members: [eva.id] }),
      ],
      day,
    );
    expect(allDay.map((a) => [a.title, a.tag, a.colors])).toEqual([
      ['Eva’s birthday', 'Birthday', ['rose']],
      ['Lyon trip', 'Day 2 of 3', ['rose']],
    ]);
    expect(allDay[1]?.label).toBe('Lyon trip, all day, Day 2 of 3');
    expect(busy.map((c) => c.text)).toEqual(['Eva 2']);
  });

  it('places custom times in the slot they start in: before 06:00 in Early morning, after 22:00 in Evening', () => {
    const { bands } = layout([
      ev({ title: 'Run', time_type: 'custom', slots: [], start_time: '05:30', end_time: '06:15' }),
      ev({ title: 'Late call', time_type: 'custom', slots: [], start_time: '22:30', end_time: '23:00' }),
      ev({ title: 'Dentist', time_type: 'custom', slots: [], start_time: '10:30', end_time: '11:00' }),
    ]);
    expect(bands.map((b) => b.events.map((e) => e.title))).toEqual([['Run'], ['Dentist'], [], [], ['Late call']]);
  });

  it('an event over several slots sits in its first', () => {
    const { bands } = layout([ev({ title: 'Fair', slots: ['evening', 'afternoon'] })]);
    expect(bands.map((b) => b.events.map((e) => e.time))).toEqual([[], [], [], ['Afternoon'], []]);
  });

  it('Eva’s private event reads Busy for Gabriel, still counts, and shows no driver', () => {
    const { bands, busy } = layout([ev({ title: 'Therapist', time_type: 'custom', slots: [], start_time: '10:00', end_time: '11:00', location: 'Dr. Kay', members: [eva.id, james.id], visibility: 'private', creator_member_id: eva.id, responsible_member_id: eva.id })]);
    expect(bands[1]?.events.map((e) => [e.title, e.time, e.driver])).toEqual([['Busy', '10:00', null]]);
    expect(busy.map((c) => c.text)).toEqual(['Eva 1', 'James 1']);
  });

  it('a person hidden in the header’s filter drops out', () => {
    const { busy, bands } = layout(sunday(), TODAY, gabriel.id, new Set([gabriel.id]));
    expect(busy.map((c) => c.text)).toEqual(['James 1', 'Everyone 2']);
    expect(bands[3]?.events.map((e) => e.title)).toEqual(['Baby swim class']);
  });

  it('an empty day: every band shows its add row and nobody is busy', () => {
    const { busy, allDay, bands } = layout([]);
    expect(busy).toEqual([]);
    expect(allDay).toEqual([]);
    expect(bands.map((b) => b.addText)).toEqual(['+ Add in the early morning', '+ Add in the morning', '+ Add in the lunch slot', '+ Add in the afternoon', '+ Add in the evening']);
  });
});
