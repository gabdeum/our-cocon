// Spec 038: what the week grid shows. User Story 1 (overlaps side by side at their exact times),
// the All day row, today's now line, and the edges the screen doesn't draw.
import { describe, expect, it } from 'vitest';
import { DEFAULT_SLOT_TIMES } from '@cocon/calendar';
import type { StoredEvent } from '@cocon/data';
import type { WeekBlock } from '@cocon/ui';
import { gabriel, james, mia } from '../test/fakes';
import { memberLook, monthOccurrences } from './calendar-month';
import { hourLabels, layoutWeekGrid, type WeekGridContext } from './calendar-week';

const eva = { ...mia, id: 'm-eva', display_name: 'Eva', color: 'rose' as const };
const members = [gabriel, eva, james];
const TODAY = '2026-10-25';

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

const custom = (title: string, start: string, end: string, who: string[], day = TODAY) =>
  ev({ title, time_type: 'custom', slots: [], start_time: start, end_time: end, members: who, starts_on: day, ends_on: day });

const ctx: WeekGridContext = { weekStartsOn: 0, today: TODAY, look: memberLook(members), slotTimes: DEFAULT_SLOT_TIMES, now: '13:20' };

function grid(events: StoredEvent[], anchor = TODAY, over: Partial<WeekGridContext> = {}, hidden: ReadonlySet<string> = new Set()) {
  return layoutWeekGrid(anchor, monthOccurrences(events, '2026-10-01', '2026-11-30', gabriel.id, hidden), { ...ctx, ...over });
}

const pick = (b: WeekBlock | undefined) => b && { top: b.top, y: b.y, height: b.height, lane: b.lane, lanes: b.lanes, kind: b.kind };
const block = (g: ReturnType<typeof grid>, day: number, title: string) => g.columns[day]?.blocks.find((b) => b.title === title);

describe('week grid (spec 038)', () => {
  it('US1: Baby swim 14:30–16:30 and Coffee 16:00–17:00 at their exact times, side by side', () => {
    const g = grid([custom('Baby swim', '14:30', '16:30', [james.id]), custom('Coffee', '16:00', '17:00', [gabriel.id])]);
    expect(pick(block(g, 0, 'Baby swim'))).toEqual({ top: 'J', y: 307, height: 70, lane: 0, lanes: 2, kind: 'custom' });
    expect(pick(block(g, 0, 'Coffee'))).toEqual({ top: 'G', y: 361, height: 34, lane: 1, lanes: 2, kind: 'custom' });
    expect(block(g, 0, 'Baby swim')?.label).toBe('Baby swim, Sunday, 14:30 to 16:30');
  });

  it('FR-002: slot events cover their slot and show its name; custom ones show their start', () => {
    const g = grid([
      ev({ title: 'Brunch', slots: ['lunch'], members: ['everyone'] }),
      ev({ title: 'Movie night', slots: ['afternoon', 'evening'], members: [gabriel.id, eva.id], starts_on: '2026-10-27', ends_on: '2026-10-27' }),
      custom('Run', '06:30', '07:30', [gabriel.id], '2026-10-26'),
      custom('Lunch w/ Ana', '12:00', '13:00', [eva.id], '2026-10-28'),
      custom('Dinner out', '19:00', '21:00', ['others'], '2026-10-28'),
    ]);
    expect(pick(block(g, 0, 'Brunch'))).toEqual({ top: 'All Lunch', y: 217, height: 70, lane: 0, lanes: 1, kind: 'slot' });
    expect(block(g, 0, 'Brunch')?.label).toBe('Brunch, Sunday, Lunch');
    expect(pick(block(g, 2, 'Movie night'))).toEqual({ top: 'G·E Afternoon', y: 289, height: 286, lane: 0, lanes: 1, kind: 'slot' });
    expect(block(g, 2, 'Movie night')?.colors).toEqual(['honey', 'rose']);
    expect(block(g, 2, 'Movie night')?.label).toBe('Movie night, Tuesday, Afternoon, Evening');
    expect(pick(block(g, 1, 'Run'))).toEqual({ top: 'G 06:30', y: 19, height: 34, lane: 0, lanes: 1, kind: 'custom' });
    // FR-002: a custom time keeps its start, even at a slot's start.
    expect(block(g, 3, 'Lunch w/ Ana')?.top).toBe('E 12:00');
    // Others has no initials.
    expect(block(g, 3, 'Dinner out')?.top).toBe('19:00');
  });

  it('FR-002: short events that would touch once drawn 22 px tall share the column', () => {
    const g = grid([custom('Call', '10:00', '10:15', [gabriel.id]), custom('Pickup', '10:20', '10:40', [eva.id]), custom('Later', '11:00', '11:30', [eva.id])]);
    expect(pick(block(g, 0, 'Call'))).toMatchObject({ height: 22, lane: 0, lanes: 2 });
    expect(pick(block(g, 0, 'Pickup'))).toMatchObject({ lane: 1, lanes: 2 });
    expect(pick(block(g, 0, 'Later'))).toMatchObject({ top: 'E 11:00', lane: 0, lanes: 1 });
  });

  it('draws events before 06:00 from the 06:00 line', () => {
    const g = grid([custom('Flight', '05:00', '07:00', [gabriel.id]), custom('Early', '04:00', '05:00', [eva.id], '2026-10-26')]);
    expect(pick(block(g, 0, 'Flight'))).toMatchObject({ y: 1, height: 34 });
    expect(pick(block(g, 1, 'Early'))).toMatchObject({ y: 1, height: 22 });
  });

  it('FR-001: days from the first day of the week, and the All day row with its bars', () => {
    const events = [
      ev({ title: 'Birthday', time_type: 'all_day', slots: [], members: [eva.id], starts_on: '2026-10-28', ends_on: '2026-10-28' }),
      ev({ title: 'Lyon trip', time_type: 'all_day', slots: [], members: [eva.id], starts_on: '2026-10-29', ends_on: '2026-11-02' }),
      ev({ title: 'Conference', slots: ['morning'], members: [gabriel.id], starts_on: '2026-10-28', ends_on: '2026-10-30' }),
    ];
    const g = grid(events);
    expect(g.days.map((d) => `${d.letter}${d.num}`)).toEqual(['S25', 'M26', 'T27', 'W28', 'T29', 'F30', 'S31']);
    expect(g.days[0]).toMatchObject({ label: 'Sunday October 25', today: true });
    expect(g.bars.map((b) => [b.text, b.column, b.days, b.lane, b.startsHere, b.endsHere])).toEqual([
      // layoutSpans: earliest, then longest first; Lyon fits beside Birthday.
      ['E Birthday', 3, 1, 1, true, true],
      ['E Lyon trip', 4, 3, 1, true, false],
      ['G Conference', 3, 3, 0, true, true],
    ]);
    expect(g.bars[0]?.label).toBe('Birthday, Wednesday October 28, All day');
    expect(g.bars[1]?.label).toBe('Lyon trip, October 29 to November 2');
    // A multi-day event never also sits in the hour grid.
    expect(g.columns.flatMap((c) => c.blocks)).toEqual([]);

    const next = grid(events, '2026-11-01');
    expect(next.days.map((d) => d.num)).toEqual(['1', '2', '3', '4', '5', '6', '7']);
    expect(next.bars.map((b) => [b.text, b.column, b.days, b.startsHere])).toEqual([['E Lyon trip (cont.)', 0, 2, false]]);
    expect(next.columns[0]?.addLabel).toBe('Add event, Sunday November 1');
  });

  it('C8: a week that starts on Monday', () => {
    const g = grid([], TODAY, { weekStartsOn: 1 });
    expect(g.days.map((d) => `${d.letter}${d.num}`)).toEqual(['M19', 'T20', 'W21', 'T22', 'F23', 'S24', 'S25']);
  });

  it('FR-003: the now line is in this week only, between 06:00 and 24:00', () => {
    expect(grid([]).nowY).toBe(264);
    expect(grid([]).columns.map((c) => c.today)).toEqual([true, false, false, false, false, false, false]);
    expect(grid([], '2026-11-01').nowY).toBeNull();
    expect(grid([], TODAY, { now: '05:59' }).nowY).toBeNull();
    expect(grid([], TODAY, { now: '23:59' }).nowY).toBeCloseTo(647.4);
    expect(hourLabels).toEqual(['06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00', '23:00']);
  });

  it('privacy and the filter: Eva’s private event reads Busy; hiding Eva removes her events', () => {
    const events = [ev({ ...custom('Therapy', '10:00', '11:00', [eva.id]), visibility: 'private', creator_member_id: eva.id })];
    expect(block(grid(events), 0, 'Busy')?.label).toBe('Busy, Sunday, 10:00 to 11:00');
    expect(grid(events, TODAY, {}, new Set([eva.id])).columns[0]?.blocks).toEqual([]);
  });
});
