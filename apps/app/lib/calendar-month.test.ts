// Spec 037: what each day of the month grid shows (User Story 1) and which month fills the grid
// as it scrolls (User Story 2).
import { describe, expect, it } from 'vitest';
import { DEFAULT_SLOT_TIMES } from '@cocon/calendar';
import type { StoredEvent } from '@cocon/data';
import type { MonthCellItem } from '@cocon/ui';
import { gabriel, james, mia } from '../test/fakes';
import {
  chipLook,
  eventWindow,
  firstWeekOfMonth,
  layoutWeek,
  memberLook,
  monthOccurrences,
  monthRange,
  monthShownAt,
  weekIndexOf,
  weekStartAt,
  weekdayLetters,
  type WeekContext,
} from './calendar-month';

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
    starts_on: '2026-10-25',
    ends_on: '2026-10-25',
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

const range = monthRange(TODAY, 0);
const ctx: WeekContext = { range, today: TODAY, look: memberLook(members), slotTimes: DEFAULT_SLOT_TIMES };

function week(date: string, events: StoredEvent[], hidden: ReadonlySet<string> = new Set(), me = gabriel.id) {
  const window = eventWindow(date);
  return layoutWeek(weekIndexOf(range, date), monthOccurrences(events, window.from, window.to, me, hidden), ctx);
}
function cell(w: ReturnType<typeof week>, date: string) {
  const found = w.cells.find((c) => c.date === date);
  if (!found) throw new Error(`no cell for ${date}`);
  return found;
}
const texts = (items: MonthCellItem[]) => items.map((i) => (i.kind === 'chip' ? i.text : '·'));

describe('US1: read the month at a glance', () => {
  it('shows two chips in order with initials, then "+N"', () => {
    const w = week('2026-10-31', [
      ev({ title: 'Halloween', starts_on: '2026-10-31', ends_on: '2026-10-31', members: ['everyone'], slots: ['afternoon'] }),
      ev({ title: 'Surprise', starts_on: '2026-10-31', ends_on: '2026-10-31', members: [gabriel.id, james.id], slots: ['evening'] }),
      ev({ title: 'Run', starts_on: '2026-10-31', ends_on: '2026-10-31', slots: ['early_morning'] }),
    ]);
    const day = cell(w, '2026-10-31');
    expect(texts(day.items)).toEqual(['G Run', 'All Halloween']);
    expect(day.more).toBe('+1');
    expect(day.label).toBe('October 31: Run, Halloween, Surprise');
  });

  it('puts all-day events first and names two members "G·J" with a split fill', () => {
    const w = week('2026-10-01', [
      ev({ title: 'School night', starts_on: '2026-10-01', ends_on: '2026-10-01', members: [gabriel.id, eva.id], slots: ['evening'] }),
      ev({ title: 'Apple picking', starts_on: '2026-10-01', ends_on: '2026-10-01', members: ['everyone'], time_type: 'all_day', slots: [] }),
    ]);
    const items = cell(w, '2026-10-01').items;
    expect(texts(items)).toEqual(['All Apple picking', 'G·E School night']);
    expect(items[1]).toMatchObject({ colors: ['honey', 'rose'] });
  });

  it('gives Others no initials, and someone else’s private event reads Busy in their color', () => {
    expect(chipLook(['others'], 'Dinner at Sam’s', ctx.look)).toEqual({ text: 'Dinner at Sam’s', colors: ['others'] });
    const w = week('2026-10-22', [ev({ title: 'Therapist', starts_on: '2026-10-22', ends_on: '2026-10-22', members: [eva.id], visibility: 'private', creator_member_id: eva.id })]);
    expect(cell(w, '2026-10-22').items).toEqual([{ kind: 'chip', key: expect.any(String), text: 'E Busy', colors: ['rose'] }]);
  });

  it('shows a surprise’s cover to the person it’s hidden from, and Busy when the viewer is unknown', () => {
    const party = ev({
      title: 'Eva’s party',
      starts_on: '2026-10-31',
      ends_on: '2026-10-31',
      members: [gabriel.id, james.id],
      visibility: 'surprise',
      creator_member_id: gabriel.id,
      surprise: { hidden_from: [eva.id], cover_title: 'Dinner out', cover_note: null },
    });
    expect(texts(cell(week('2026-10-31', [party], new Set(), eva.id), '2026-10-31').items)).toEqual(['G·J Dinner out']);
    expect(cell(week('2026-10-31', [party], new Set(), eva.id), '2026-10-31').label).toBe('October 31: Dinner out');
    expect(texts(cell(week('2026-10-31', [party], new Set(), ''), '2026-10-31').items)).toEqual(['G·J Busy']);
  });

  it('places every time a repeating event happens', () => {
    const swim = ev({ title: 'Baby swim', members: [james.id], starts_on: '2026-10-04', ends_on: '2026-10-04', recurrence: { freq: 'weekly', ends: { type: 'never' } } });
    expect(texts(cell(week('2026-10-11', [swim]), '2026-10-11').items)).toEqual(['J Baby swim']);
    expect(texts(cell(week('2026-11-01', [swim]), '2026-11-01').items)).toEqual(['J Baby swim']);
  });

  it('leaves hidden people out, and "+N" counts only what’s shown', () => {
    const day = (hidden: Set<string>) =>
      cell(
        week(
          '2026-10-29',
          [
            ev({ title: 'Dentist', starts_on: '2026-10-29', ends_on: '2026-10-29' }),
            ev({ title: 'Yoga', starts_on: '2026-10-29', ends_on: '2026-10-29', members: [eva.id], slots: ['evening'] }),
            ev({ title: 'Book club', starts_on: '2026-10-29', ends_on: '2026-10-29', members: [eva.id], slots: ['evening'] }),
          ],
          hidden,
        ),
        '2026-10-29',
      );
    expect(day(new Set()).more).toBe('+1');
    expect(texts(day(new Set([eva.id])).items)).toEqual(['G Dentist']);
    expect(day(new Set([eva.id])).more).toBeNull();
  });

  it('draws a multi-day event as one bar per week row, "(cont.)" with square ends in the next', () => {
    const visit = ev({ title: 'Grandma visits', starts_on: '2026-10-16', ends_on: '2026-10-19', members: ['everyone'], time_type: 'all_day', slots: [] });
    const brunch = ev({ title: 'Brunch', starts_on: '2026-10-18', ends_on: '2026-10-18', members: ['everyone'], slots: ['lunch'] });
    const first = week('2026-10-16', [visit, brunch]);
    expect(first.bars).toEqual([expect.objectContaining({ text: 'All Grandma visits', column: 5, days: 2, lane: 0, startsHere: true, endsHere: false, label: 'Grandma visits, October 16 to October 19' })]);
    expect(texts(cell(first, '2026-10-16').items)).toEqual(['·']);

    const next = week('2026-10-18', [visit, brunch]);
    expect(next.bars).toEqual([expect.objectContaining({ text: 'All Grandma visits (cont.)', column: 0, days: 2, startsHere: false, endsHere: true })]);
    // The day under the bar keeps its first row empty; Brunch sits below it.
    expect(texts(cell(next, '2026-10-18').items)).toEqual(['·', 'All Brunch']);
  });

  it('marks today, past days and the 1st of a month', () => {
    const w = week('2026-11-01', []);
    expect(cell(w, '2026-11-01')).toMatchObject({ dateText: 'Nov 1', first: true, past: false, label: 'November 1: nothing planned' });
    const october = week(TODAY, []);
    expect(cell(october, TODAY)).toMatchObject({ today: true, past: false, dateText: '25' });
    expect(cell(october, '2026-10-26')).toMatchObject({ past: false });
    expect(cell(week('2026-10-24', []), '2026-10-24')).toMatchObject({ past: true });
  });
});

describe('US2: scroll through months', () => {
  it('opens on the first week of the month', () => {
    expect(weekStartAt(range, firstWeekOfMonth(range, TODAY))).toBe('2026-09-27');
  });

  it('titles the grid by the Wednesday of the second visible row', () => {
    const october = firstWeekOfMonth(range, TODAY);
    expect(monthShownAt(range, october)).toBe('2026-10-01');
    // Top row Oct 25–31: the second row is Nov 1–7, so November fills the grid.
    expect(monthShownAt(range, weekIndexOf(range, '2026-10-25'))).toBe('2026-11-01');
    expect(monthShownAt(range, weekIndexOf(range, '2026-10-18'))).toBe('2026-10-01');
  });

  it('follows the week start for the weekday row and the probe', () => {
    expect(weekdayLetters(0).join('')).toBe('SMTWTFS');
    expect(weekdayLetters(1).join('')).toBe('MTWTFSS');
    const monday = monthRange(TODAY, 1);
    expect(weekStartAt(monday, firstWeekOfMonth(monday, TODAY))).toBe('2026-09-28');
  });

  it('loads 6 months either side of the visible quarter', () => {
    expect(eventWindow('2026-11-01')).toEqual({ from: '2026-04-01', to: '2027-06-30' });
    expect(eventWindow('2026-12-01')).toEqual(eventWindow('2026-10-01'));
  });
});
