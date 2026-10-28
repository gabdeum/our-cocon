import { describe, expect, it, vi } from 'vitest';
import { expand, viewFor } from '@cocon/calendar';
import { DEFAULT_SLOT_TIMES } from '@cocon/calendar';
import { deleteEvent, loadCalendarSettings, loadEvents, removeException, restoreEvent, saveEvent, saveException, splitEvent, storedEvent, undoCreateEvent } from './events';

const EVA = '3f0c1d6e-2b1a-4c8e-9a52-0d7e1f4b6a10';
const GABRIEL = '3f0c1d6e-2b1a-4c8e-9a52-0d7e1f4b6a11';
const EVENT = '3f0c1d6e-2b1a-4c8e-9a52-0d7e1f4b6a12';

/** Eva's private yoga as `events_visible` gives it to Gabriel. */
const busyRow = {
  id: EVENT,
  family_id: 'f',
  title: 'Busy',
  category: null,
  location: null,
  notes: null,
  starts_on: '2026-11-03',
  ends_on: '2026-11-03',
  time_type: 'slot',
  slots: ['evening'],
  start_time: null,
  end_time: null,
  recurrence: { freq: 'weekly', ends: { type: 'never' } },
  reminder: null,
  responsible_member_id: null,
  visibility: 'private',
  creator_member_id: EVA,
  members: [EVA],
  removed_members: [],
  exceptions: [{ occurrence_date: '2026-11-10', cancelled: false, override: { starts_on: '2026-11-11', ends_on: '2026-11-11' } }],
  checklist: null,
  surprise: null,
  created_by: EVA,
  updated_by: EVA,
  source: 'app',
  created_at: '2026-10-27T10:00:00Z',
  updated_at: '2026-10-27T10:00:00Z',
  deleted_at: null,
  deleted_by: null,
};

const yoga = { title: 'Yoga', starts_on: '2026-11-03', ends_on: '2026-11-03', time_type: 'slot', slots: ['evening'], members: [EVA] };

describe('events data (spec 035)', () => {
  it('hands the engine what it needs: members, creator and exceptions (L80)', () => {
    const event = storedEvent(busyRow);
    const occurrences = expand(event, '2026-11-01', '2026-11-14', event.exceptions);
    expect(occurrences.map((o) => o.starts_on)).toEqual(['2026-11-03', '2026-11-11']);
    const forGabriel = occurrences.map((o) => viewFor(o, GABRIEL));
    expect(forGabriel[1]).toMatchObject({ view: 'busy', title: 'Busy', members: [EVA], location: null, notes: null });
    expect(occurrences.map((o) => viewFor(o, EVA).view)).toEqual(['full', 'full']);
  });

  it('shows a hidden event as Busy when its creator has left the family', () => {
    const event = storedEvent({ ...busyRow, creator_member_id: null });
    expect(event.creator_member_id).toBe('');
    expect(viewFor(event, EVA).view).toBe('busy');
  });

  it('asks for one-off events in range and every repeat that started by the end', async () => {
    const calls: [string, ...unknown[]][] = [];
    const query = new Proxy({} as Record<string, unknown>, {
      get: (_target, name: string) =>
        name === 'then'
          ? (resolve: (value: unknown) => void) => resolve({ data: [busyRow], error: null })
          : (...args: unknown[]) => {
              calls.push([name, ...args]);
              return query;
            },
    });
    const events = await loadEvents({ from: () => query } as never, '2026-11-01', '2026-11-30');
    expect(events).toHaveLength(1);
    expect(calls).toContainEqual(['lte', 'starts_on', '2026-11-30']);
    expect(calls).toContainEqual(['or', 'ends_on.gte.2026-11-01,recurrence.not.is.null']);
    await expect(loadEvents({ from: () => query } as never, '2026-11-01),id.eq.(x', '2026-11-30')).rejects.toThrow();
  });

  it('saves a whole event in one call', async () => {
    const rpc = vi.fn(async () => ({ data: EVENT, error: null }));
    await expect(saveEvent({ rpc } as never, { ...yoga, checklist: [{ label: 'Towel' }] })).resolves.toBe(EVENT);
    expect(rpc).toHaveBeenCalledWith('save_event', {
      p_event: { title: 'Yoga', starts_on: '2026-11-03', ends_on: '2026-11-03', time_type: 'slot', slots: ['evening'], visibility: 'family' },
      p_members: [EVA],
      p_checklist: [{ label: 'Towel' }],
    });
    await saveEvent({ rpc } as never, yoga, EVENT);
    expect(rpc).toHaveBeenLastCalledWith('save_event', expect.objectContaining({ p_id: EVENT }));
  });

  it('checks with the schema and the engine before sending anything', async () => {
    const rpc = vi.fn();
    await expect(saveEvent({ rpc } as never, { ...yoga, title: '' })).rejects.toThrow();
    await expect(saveEvent({ rpc } as never, { ...yoga, slots: ['morning', 'evening'] })).rejects.toThrow('Slots must be next to each other');
    await expect(saveEvent({ rpc } as never, { ...yoga, recurrence: { freq: 'weekly', ends: { type: 'on', date: '2026-10-01' } } })).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('splits a series in one call, checked first (spec 041)', async () => {
    const rpc = vi.fn(async () => ({ data: EVENT, error: null }));
    const weekly = { freq: 'weekly', ends: { type: 'never' } };
    const before = { freq: 'weekly', ends: { type: 'on', date: '2026-11-09' } };
    await expect(splitEvent({ rpc } as never, EVENT, '2026-11-10', before, { ...yoga, recurrence: weekly, checklist: [{ label: 'Towel' }] })).resolves.toBe(EVENT);
    expect(rpc).toHaveBeenCalledWith('split_event', {
      p_id: EVENT,
      p_from: '2026-11-10',
      p_before: before,
      p_event: { title: 'Yoga', starts_on: '2026-11-03', ends_on: '2026-11-03', time_type: 'slot', slots: ['evening'], recurrence: weekly, visibility: 'family' },
      p_members: [EVA],
      p_checklist: [{ label: 'Towel' }],
    });
    rpc.mockClear();
    await expect(splitEvent({ rpc } as never, EVENT, '2026-11-10', { freq: 'hourly' }, yoga)).rejects.toThrow();
    await expect(splitEvent({ rpc } as never, 'x', '2026-11-10', before, yoga)).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
    const failing = vi.fn(async () => ({ data: null, error: new Error('event_not_found') }));
    await expect(splitEvent({ rpc: failing } as never, EVENT, '2026-11-10', before, yoga)).rejects.toThrow('event_not_found');
  });

  it('undoes an add: deleted, then removed for good (spec 041 FR-009)', async () => {
    const calls: string[] = [];
    const client = {
      from: () => ({
        update: () => (calls.push('update'), { eq: () => ({ select: async () => ({ data: [{ id: EVENT }], error: null }) }) }),
        delete: () => (calls.push('delete'), { eq: () => ({ not: async (...args: unknown[]) => (calls.push(JSON.stringify(args)), { error: null }) }) }),
      }),
    };
    await undoCreateEvent(client as never, EVENT);
    expect(calls).toEqual(['update', 'delete', '["deleted_at","is",null]']);
    const failing = { from: () => ({ ...client.from(), delete: () => ({ eq: () => ({ not: async () => ({ error: new Error('nope') }) }) }) }) };
    await expect(undoCreateEvent(failing as never, EVENT)).rejects.toThrow('nope');
  });

  it('refuses an exception that changes who can see the event (L80)', async () => {
    const from = vi.fn();
    await expect(saveException({ from } as never, 'f', EVENT, { occurrence_date: '2026-11-10', override: { visibility: 'family' } })).rejects.toThrow();
    await expect(saveException({ from } as never, 'f', EVENT, { occurrence_date: '2026-11-10' })).rejects.toThrow();
    expect(from).not.toHaveBeenCalled();
  });

  it('moves an event to Recently deleted and back, and says when there was nothing to move', async () => {
    const update = vi.fn();
    const chain = (rows: unknown[]) => ({ update: (values: unknown) => (update(values), { eq: () => ({ select: async () => ({ data: rows, error: null }) }) }) });
    await deleteEvent({ from: () => chain([{ id: EVENT }]) } as never, EVENT);
    expect(update.mock.calls[0]?.[0]).toEqual({ deleted_at: expect.any(String) });
    await restoreEvent({ from: () => chain([{ id: EVENT }]) } as never, EVENT);
    expect(update).toHaveBeenLastCalledWith({ deleted_at: null });
    await expect(deleteEvent({ from: () => chain([]) } as never, EVENT)).rejects.toThrow('event_not_found');
  });

  it('undoes a "this event only" change by its date', async () => {
    const calls: unknown[] = [];
    const query: { eq: (...args: unknown[]) => unknown } = {
      eq: (...args) => (calls.push(args), calls.length === 2 ? Promise.resolve({ error: null }) : query),
    };
    await removeException({ from: () => ({ delete: () => query }) } as never, EVENT, '2026-11-10');
    expect(calls).toEqual([['event_id', EVENT], ['occurrence_date', '2026-11-10']]);
    await expect(removeException({ from: vi.fn() } as never, EVENT, 'soon')).rejects.toThrow();
  });

  it('uses the default slot times until the owner changes them', async () => {
    const settings = (data: unknown) => ({ from: () => ({ select: () => ({ maybeSingle: async () => ({ data, error: null }) }) }) }) as never;
    expect(await loadCalendarSettings(settings(null))).toEqual({ slotTimes: DEFAULT_SLOT_TIMES, homeTimeZone: null });
    expect(await loadCalendarSettings(settings({ slot_times: null, home_time_zone: 'Europe/Paris' }))).toEqual({ slotTimes: DEFAULT_SLOT_TIMES, homeTimeZone: 'Europe/Paris' });
    const evening = { ...DEFAULT_SLOT_TIMES, evening: { start: '18:30', end: '22:00' } };
    expect((await loadCalendarSettings(settings({ slot_times: evening, home_time_zone: null }))).slotTimes.evening.start).toBe('18:30');
  });
});
