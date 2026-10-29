// Spec 042 FR-005: the shared event page's data. The day with that date's change, as the family's
// calendar shows it, first names, and every way a link can stop working.
import { describe, expect, it, vi } from 'vitest';
import type { SharedEventResponse } from '@cocon/schemas';
import { loadSharedEvent, sharedEventView } from './shared-event';

const token = 'c'.repeat(43);
const music: SharedEventResponse = {
  occurrence_date: '2026-10-31',
  event: { title: 'Baby music class', location: 'Little Notes studio', starts_on: '2026-10-03', ends_on: '2026-10-03', time_type: 'slot', slots: ['morning'], recurrence: { freq: 'weekly', ends: { type: 'never' } } },
  exception: null,
  who: ['James', 'Eva', 'others'],
  slot_times: null,
};
const endpoint = (status: number, body: unknown) => ({ supabaseUrl: 'http://api/', anonKey: 'anon', fetch: vi.fn(async () => new Response(JSON.stringify(body), { status })) });

describe('sharedEventView', () => {
  it('says the shared date like the event page', () => {
    expect(sharedEventView(music)).toEqual({
      title: 'Baby music class',
      when: { title: 'Saturday, Oct 31', sub: 'Morning · about 09:00–12:00' },
      place: 'Little Notes studio',
      with: 'With James, Eva and others',
    });
  });

  it('shows that date’s change, and the whole family for Everyone', () => {
    const moved = sharedEventView({
      ...music,
      exception: { occurrence_date: '2026-10-31', override: { starts_on: '2026-11-01', ends_on: '2026-11-01', time_type: 'custom', slots: [], start_time: '10:00', end_time: '11:00', location: 'Town hall' } },
      who: ['everyone'],
    });
    expect(moved).toMatchObject({ when: { title: 'Sunday, Nov 1', sub: '10:00–11:00' }, place: 'Town hall', with: 'With the whole family' });
  });

  it('is null for a date the event doesn’t have', () => {
    expect(sharedEventView({ ...music, occurrence_date: '2026-11-01' })).toBeNull();
  });
});

describe('loadSharedEvent', () => {
  it('asks the share endpoint with the anon key', async () => {
    const e = endpoint(200, music);
    expect(await loadSharedEvent(token, e)).toMatchObject({ kind: 'shared', event: { title: 'Baby music class' } });
    expect(e.fetch).toHaveBeenCalledWith(`http://api/functions/v1/shared-event?token=${token}`, { headers: { apikey: 'anon', Authorization: 'Bearer anon' } });
  });

  it('"not shared" for a stopped, ended or malformed link, without asking for a malformed one', async () => {
    expect(await loadSharedEvent(token, endpoint(404, { status: 'not_shared' }))).toEqual({ kind: 'not_shared' });
    const e = endpoint(200, music);
    expect(await loadSharedEvent('short', e)).toEqual({ kind: 'not_shared' });
    expect(e.fetch).not.toHaveBeenCalled();
  });

  it('"not shared" for a date the event no longer has', async () => {
    expect(await loadSharedEvent(token, endpoint(200, { ...music, occurrence_date: '2026-11-01' }))).toEqual({ kind: 'not_shared' });
  });

  it('throws when the endpoint fails or answers something unexpected, so the page offers Try again', async () => {
    await expect(loadSharedEvent(token, endpoint(500, {}))).rejects.toThrow();
    await expect(loadSharedEvent(token, endpoint(200, { event: {} }))).rejects.toThrow();
  });
});
