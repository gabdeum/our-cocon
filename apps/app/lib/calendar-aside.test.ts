// Spec 070 FR-007: the mini month and "Coming up" beside Day view from 960.
import { describe, expect, it } from 'vitest';
import { DEFAULT_SLOT_TIMES } from '@cocon/calendar';
import type { StoredEvent } from '@cocon/data';
import { gabriel, mia, storedEvent } from '../test/fakes';
import { comingUp, miniMonth } from './calendar-aside';
import { monthOccurrences, monthRange } from './calendar-month';

const eva = { ...mia, id: 'm-eva' };
const TODAY = '2026-10-25';
const range = monthRange(TODAY, 0);
const ev = (title: string, fields: Partial<StoredEvent> = {}) => storedEvent({ title, starts_on: '2026-10-26', ends_on: '2026-10-26', time_type: 'slot', slots: ['morning'], members: [gabriel.id], ...fields });
const occ = (events: StoredEvent[], hidden: ReadonlySet<string> = new Set()) => monthOccurrences(events, '2026-10-01', '2026-11-30', gabriel.id, hidden);

describe('mini month (spec 070 FR-007)', () => {
  it('shows the month of the day shown, that day selected, today, and dots on days with events', () => {
    const events = [ev('Run', { starts_on: '2026-10-26', ends_on: '2026-10-26' }), ev('Lyon trip', { time_type: 'all_day', slots: [], starts_on: '2026-10-28', ends_on: '2026-10-30' })];
    const mini = miniMonth('2026-10-27', TODAY, occ(events), range);
    expect(mini.title).toBe('October');
    expect(mini.days).toHaveLength(35);
    expect(mini.days[0]).toMatchObject({ date: '2026-09-27', num: '27', outside: true });
    const day = (d: string) => mini.days.find((x) => x.date === d);
    expect(day('2026-10-27')).toMatchObject({ selected: true, today: false, hasEvents: false, label: 'October 27' });
    expect(day(TODAY)).toMatchObject({ selected: false, today: true });
    expect(day('2026-10-26')).toMatchObject({ hasEvents: true, label: 'October 26, has events' });
    // Every day of a multi-day event.
    expect(['2026-10-28', '2026-10-29', '2026-10-30'].map((d) => day(d)?.hasEvents)).toEqual([true, true, true]);
  });

  it('names the year outside this one, and leaves hidden people out of the dots', () => {
    expect(miniMonth('2027-01-12', TODAY, [], range).title).toBe('January 2027');
    const evaOnly = [ev('Yoga', { members: [eva.id] })];
    expect(miniMonth('2026-10-26', TODAY, occ(evaOnly, new Set([eva.id])), range).days.find((d) => d.date === '2026-10-26')?.hasEvents).toBe(false);
  });
});

describe('Coming up (spec 070 FR-007)', () => {
  it('lists the next three days, titles in day order joined by " · ", or "Nothing planned"', () => {
    const events = [
      ev('Baby yoga', { time_type: 'custom', slots: [], start_time: '08:00', end_time: '09:30' }),
      ev('Run', { time_type: 'custom', slots: [], start_time: '06:30', end_time: '07:30' }),
      ev('Lyon trip', { time_type: 'all_day', slots: [], starts_on: '2026-10-26', ends_on: '2026-10-28' }),
    ];
    const days = comingUp(TODAY, occ(events), DEFAULT_SLOT_TIMES);
    expect(days.map((d) => [d.weekday, d.num, d.text])).toEqual([
      ['Mon', '26', 'Lyon trip · Run · Baby yoga'],
      ['Tue', '27', 'Lyon trip'],
      ['Wed', '28', 'Lyon trip'],
    ]);
    expect(comingUp('2026-11-10', occ(events), DEFAULT_SLOT_TIMES)[0]).toMatchObject({ date: '2026-11-11', text: 'Nothing planned', label: 'Wednesday November 11: Nothing planned' });
  });

  it("shows someone else's private event as Busy", () => {
    const events = [ev('Therapy', { members: [eva.id], visibility: 'private', creator_member_id: eva.id })];
    expect(comingUp(TODAY, occ(events), DEFAULT_SLOT_TIMES)[0]?.text).toBe('Busy');
  });
});
