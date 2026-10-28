// Spec 040: what the agenda shows. User Story 1 (days from today, headed Today / Tomorrow / the
// date, empty days skipped), FR-002's rows and tags, and the edges the canvas doesn't draw.
import { describe, expect, it } from 'vitest';
import { DEFAULT_SLOT_TIMES } from '@cocon/calendar';
import type { StoredEvent } from '@cocon/data';
import { gabriel, james, mia } from '../test/fakes';
import { memberLook, monthOccurrences } from './calendar-month';
import { agendaHeading, agendaWindow, layoutAgenda, type AgendaContext } from './calendar-agenda';

const eva = { ...mia, id: 'm-eva', display_name: 'Eva', color: 'rose' as const };
const members = [gabriel, eva, james];
const TODAY = '2026-10-25';
const ctx: AgendaContext = { today: TODAY, now: '13:20', look: memberLook(members), slotTimes: DEFAULT_SLOT_TIMES, members };

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

const { from, to } = agendaWindow(TODAY, 1);
const layout = (events: StoredEvent[], viewer = gabriel.id, hidden: ReadonlySet<string> = new Set()) =>
  layoutAgenda(from, to, monthOccurrences(events, from, to, viewer, hidden), ctx);
const rows = (events: StoredEvent[], viewer?: string) => layout(events, viewer).flatMap((g) => g.events.map((e) => [e.title, e.sub, e.tag?.label ?? null, e.tag?.tone ?? null]));

describe('agendaWindow', () => {
  it('loads 4 weeks at a time from the day the list starts on', () => {
    expect(agendaWindow(TODAY, 1)).toEqual({ from: TODAY, to: '2026-11-21' });
    expect(agendaWindow(TODAY, 2)).toEqual({ from: TODAY, to: '2026-12-19' });
  });
});

describe('layoutAgenda', () => {
  it('US1: days from today with events, headed Today, Tomorrow, then the date; empty days skipped', () => {
    const groups = layout([
      ev({ title: 'Movie night', slots: ['evening'], members: ['everyone'] }),
      ev({ title: 'Morning run', starts_on: '2026-10-26', ends_on: '2026-10-26' }),
      ev({ title: 'Yoga', starts_on: '2026-10-27', ends_on: '2026-10-27', slots: ['evening'], members: [eva.id] }),
      ev({ title: 'Dentist', starts_on: '2026-10-29', ends_on: '2026-10-29' }),
      ev({ title: 'Last year', starts_on: '2026-10-20', ends_on: '2026-10-20' }),
    ]);
    expect(groups.map((g) => [g.heading, g.events.map((e) => e.title)])).toEqual([
      ['Today · Sun, Oct 25', ['Movie night']],
      ['Tomorrow · Mon, Oct 26', ['Morning run']],
      ['Tue, Oct 27', ['Yoga']],
      ['Thu, Oct 29', ['Dentist']],
    ]);
  });

  it('headings are relative to today, not to the day the list starts on', () => {
    expect(agendaHeading('2026-11-01', TODAY)).toBe('Sun, Nov 1');
    expect(agendaHeading('2026-10-26', TODAY)).toBe('Tomorrow · Mon, Oct 26');
  });

  it('FR-002: "{time} · {place or driver}", all day first, then by start', () => {
    expect(
      rows([
        ev({ title: 'Poker night', slots: ['evening'], location: 'at Sam’s' }),
        ev({ title: 'Baby swim class', time_type: 'custom', slots: [], start_time: '14:30', end_time: '16:30', members: [james.id], responsible_member_id: gabriel.id }),
        ev({ title: 'Brunch', slots: ['lunch'], location: 'Grandma’s house', members: ['everyone'] }),
        ev({ title: 'Day off', time_type: 'all_day', slots: [] }),
        ev({ title: 'Movie night', slots: ['evening'], members: ['everyone'] }),
      ]),
    ).toEqual([
      ['Day off', 'All day', null, null],
      ['Brunch', 'Lunch · Grandma’s house', 'Now', 'honey'],
      ['Baby swim class', '14:30 · Gabriel takes James', null, null],
      ['Movie night', 'Evening', null, null],
      ['Poker night', 'Evening · at Sam’s', null, null],
    ]);
  });

  it('a place wins over the driver; "Now" only today', () => {
    const swim = { title: 'Swim', time_type: 'custom' as const, slots: [], start_time: '13:00', end_time: '14:00', location: 'Aquatic Center', members: [james.id], responsible_member_id: gabriel.id };
    expect(rows([ev(swim), ev({ ...swim, starts_on: '2026-10-26', ends_on: '2026-10-26' })])).toEqual([
      ['Swim', '13:00 · Aquatic Center', 'Now', 'honey'],
      ['Swim', '13:00 · Aquatic Center', null, null],
    ]);
  });

  it('a multi-day event shows on each of its days as All day with "Day N of M"; birthdays get "Birthday"', () => {
    expect(
      rows([
        ev({ title: 'Lyon trip', time_type: 'all_day', slots: [], starts_on: '2026-10-28', ends_on: '2026-10-30', members: [eva.id] }),
        ev({ title: 'Eva’s birthday', category: 'birthday', time_type: 'all_day', slots: [], starts_on: '2026-10-27', ends_on: '2026-10-27', members: [eva.id] }),
      ]),
    ).toEqual([
      ['Eva’s birthday', 'All day', 'Birthday', 'soft'],
      ['Lyon trip', 'All day', 'Day 1 of 3', 'soft'],
      ['Lyon trip', 'All day', 'Day 2 of 3', 'soft'],
      ['Lyon trip', 'All day', 'Day 3 of 3', 'soft'],
    ]);
  });

  it('"Surprise" for those in on it; the hidden person sees the cover, with no tag', () => {
    const surprise = ev({
      title: 'Eva’s surprise dinner',
      slots: ['evening'],
      starts_on: '2026-10-31',
      ends_on: '2026-10-31',
      visibility: 'surprise',
      surprise: { hidden_from: [eva.id], cover_title: 'Dinner out', cover_note: null },
    });
    expect(rows([surprise], gabriel.id)).toEqual([['Eva’s surprise dinner', 'Evening', 'Surprise', 'sage']]);
    expect(rows([surprise], eva.id)).toEqual([['Dinner out', 'Evening', null, null]]);
  });

  it('Eva’s private event reads Busy for Gabriel, with no place or driver', () => {
    const therapist = ev({ title: 'Therapist', slots: ['morning'], location: 'Dr. Kay', members: [eva.id, james.id], visibility: 'private', creator_member_id: eva.id, responsible_member_id: eva.id, starts_on: '2026-10-26', ends_on: '2026-10-26' });
    expect(rows([therapist])).toEqual([['Busy', 'Morning', null, null]]);
  });

  it('follows the people filter, and nothing ahead gives no groups', () => {
    const yoga = ev({ title: 'Yoga', members: [eva.id] });
    expect(layout([yoga], gabriel.id, new Set([eva.id]))).toEqual([]);
    expect(layout([])).toEqual([]);
  });
});
