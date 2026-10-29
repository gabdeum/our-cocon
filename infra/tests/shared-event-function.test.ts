import { describe, expect, it, vi } from 'vitest';
import { handle, type Deps } from '../../supabase/functions/shared-event/handler';

// Spec 042 FR-005: the event share endpoint (supabase/functions/shared-event), with a fake database.
const token = 'a'.repeat(43);
const shared = { occurrence_date: '2026-10-31', event: { title: 'Baby music class', starts_on: '2026-10-03', ends_on: '2026-10-03', time_type: 'slot', slots: ['morning'] }, exception: null, who: ['James'], slot_times: null };
const deps = (found: Record<string, unknown> | null = shared): Deps => ({ sharedEvent: vi.fn(async () => found) });
const get = (query: string, method = 'GET') => new Request(`http://kong:8000/functions/v1/shared-event${query}`, { method });

describe('shared-event endpoint', () => {
  it("returns what shared_event gives, never cached or indexed", async () => {
    const res = await handle(get(`?token=${token}`), deps());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(shared);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(res.headers.get('X-Robots-Tag')).toBe('noindex');
  });

  it('says "not shared" for a stopped, ended or unknown link, and never asks for a malformed one', async () => {
    expect((await handle(get(`?token=${token}`), deps(null))).status).toBe(404);
    const d = deps();
    const res = await handle(get('?token=short'), d);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ status: 'not_shared' });
    expect(d.sharedEvent).not.toHaveBeenCalled();
  });

  it('only reads', async () => {
    expect((await handle(get(`?token=${token}`, 'POST'), deps())).status).toBe(405);
    expect((await handle(get('', 'OPTIONS'), deps())).status).toBe(204);
  });

  it('hides what went wrong', async () => {
    const res = await handle(get(`?token=${token}`), { sharedEvent: vi.fn(async () => Promise.reject(new Error('db down'))) });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ status: 'error' });
  });
});
