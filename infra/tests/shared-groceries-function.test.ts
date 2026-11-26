import { describe, expect, it, vi } from 'vitest';
import { handle, type Deps } from '../../supabase/functions/shared-groceries/handler';

// Spec 072: the grocery share endpoint (supabase/functions/shared-groceries), with a fake database.
const token = 'a'.repeat(43);
const id = '11111111-1111-4111-8111-111111111111';
const list = { family_name: 'The Demanges', can_edit: true, expires_at: null, settings: {}, items: [], packs: {} };

function deps(answer: Awaited<ReturnType<Deps['rpc']>> = { data: list }): Deps & { rpc: ReturnType<typeof vi.fn> } {
  return { rpc: vi.fn(async () => answer) };
}

const get = (query: string) => new Request(`http://kong:8000/functions/v1/shared-groceries${query}`);
const post = (body: unknown) =>
  new Request('http://kong:8000/functions/v1/shared-groceries', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) });
const add = { op: 'add', token, name: 'Onions', quantity: 2, unit: null, full: 'onions', core: 'onions' };

describe('shared-groceries endpoint', () => {
  it('reads the list through the database (FR-003)', async () => {
    const d = deps();
    const res = await handle(get(`?token=${token}`), d);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(list);
    expect(d.rpc).toHaveBeenCalledWith('shared_groceries', { p_token: token });
  });

  it('is never cached or indexed (FR-008)', async () => {
    const res = await handle(get(`?token=${token}`), deps());
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('x-robots-tag')).toBe('noindex');
  });

  it('answers "not shared" for a stopped or ended link, or a guess (US4)', async () => {
    for (const query of [`?token=${token}`, '?token=short', '']) {
      const res = await handle(get(query), deps({ data: null }));
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ status: 'not_shared' });
    }
  });

  it('does not ask the database about a malformed token', async () => {
    const d = deps();
    await handle(get('?token=../../etc'), d);
    await handle(post({ ...add, token: '../../etc' }), d);
    expect(d.rpc).not.toHaveBeenCalled();
  });

  it('sends each write to its own function (FR-004, FR-005)', async () => {
    const d = deps({ data: 1 });
    await handle(post(add), d);
    expect(d.rpc).toHaveBeenLastCalledWith('shared_grocery_add', { p_token: token, p_name: 'Onions', p_quantity: 2, p_unit: null, p_full: 'onions', p_core: 'onions' });
    await handle(post({ op: 'check', token, ids: [id], checked: true }), d);
    expect(d.rpc).toHaveBeenLastCalledWith('shared_grocery_check', { p_token: token, p_ids: [id], p_checked: true });
    await handle(post({ op: 'clear', token, ids: [id] }), d);
    expect(d.rpc).toHaveBeenLastCalledWith('shared_grocery_clear', { p_token: token, p_ids: [id] });
    const res = await handle(post({ op: 'restore', token, ids: [id] }), d);
    expect(d.rpc).toHaveBeenLastCalledWith('shared_grocery_restore', { p_token: token, p_ids: [id] });
    expect(await res.json()).toEqual({ status: 'ok', result: 1 });
  });

  it('refuses anything else before the database sees it', async () => {
    const d = deps();
    for (const body of [
      'not json',
      { op: 'clear_all', token },
      { ...add, name: '' },
      { ...add, name: 'x'.repeat(81) },
      { ...add, quantity: '2' },
      { ...add, full: undefined },
      { op: 'check', token, ids: ['1; drop table'], checked: true },
      { op: 'check', token, ids: [id], checked: 'yes' },
      { op: 'clear', token, ids: [] },
      { op: 'clear', token, ids: Array.from({ length: 501 }, () => id) },
    ]) {
      const res = await handle(post(body), d);
      expect(res.status).toBe(400);
    }
    expect(d.rpc).not.toHaveBeenCalled();
    expect((await handle(new Request('http://kong:8000/functions/v1/shared-groceries', { method: 'DELETE' }), d)).status).toBe(405);
  });

  it('says why the database refused a write', async () => {
    for (const [refused, status] of [
      ['not_shared', 404],
      ['read_only', 403],
      ['too_many', 429],
      ['invalid', 400],
    ] as const) {
      const res = await handle(post(add), deps({ refused }));
      expect(res.status).toBe(status);
      expect(await res.json()).toEqual({ status: refused });
    }
  });

  it('answers 500 when the database fails', async () => {
    const res = await handle(post(add), { rpc: async () => Promise.reject(new Error('down')) });
    expect(res.status).toBe(500);
  });
});
