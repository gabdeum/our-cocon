// Spec 072: the shared list's page talks only to the share endpoint, signed out.
import { describe, expect, it, vi } from 'vitest';
import { loadSharedGroceries, sharedAdd, sharedItems, writeSharedGroceries } from './shared-groceries';

const token = 'a'.repeat(43);
const id = '00000000-0000-4000-8000-0000000000a1';
const list = {
  family_name: 'The Demanges',
  can_edit: true,
  expires_at: null,
  settings: { store_profile: 'eu', round_to_packs: true, units: 'metric' },
  items: [{ id: '00000000-0000-4000-8000-0000000000a1', name: 'Onions', catalog_key: 'onion', quantity: 2, unit: null, aisle: 'produce', checked: false, recipe_detail: null }],
  packs: {},
};
const answer = (status: number, body: unknown = {}) => vi.fn(async () => new Response(JSON.stringify(body), { status }));
const endpoint = (fetch: ReturnType<typeof answer>) => ({ supabaseUrl: 'http://127.0.0.1:54321/', anonKey: 'anon', fetch: fetch as unknown as typeof globalThis.fetch });

describe('loadSharedGroceries (FR-003)', () => {
  it('reads the list with the anon key only', async () => {
    const fetch = answer(200, list);
    expect(await loadSharedGroceries(token, endpoint(fetch))).toEqual({ kind: 'shared', list });
    expect(fetch).toHaveBeenCalledWith(`http://127.0.0.1:54321/functions/v1/shared-groceries?token=${token}`, { headers: { apikey: 'anon', Authorization: 'Bearer anon' } });
  });

  it('is "not shared" for a stopped link or a malformed token, without asking', async () => {
    expect(await loadSharedGroceries(token, endpoint(answer(404, { status: 'not_shared' })))).toEqual({ kind: 'not_shared' });
    const fetch = answer(200, list);
    expect(await loadSharedGroceries('nope', endpoint(fetch))).toEqual({ kind: 'not_shared' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('throws when the endpoint fails or answers something else, so the page offers to try again', async () => {
    // A gateway that doesn't know the function: "couldn't open", never "no longer shared".
    const missing = vi.fn(async () => new Response('Function not found', { status: 404 }));
    await expect(loadSharedGroceries(token, endpoint(missing as never))).rejects.toThrow();
    await expect(loadSharedGroceries(token, endpoint(answer(500)))).rejects.toThrow();
    await expect(loadSharedGroceries(token, endpoint(answer(200, { items: 'all of them' })))).rejects.toThrow();
  });
});

describe('writeSharedGroceries (FR-004, FR-005)', () => {
  it('posts the change with the token', async () => {
    const fetch = answer(200, { status: 'ok' });
    expect(await writeSharedGroceries(token, { op: 'clear', ids: [id] }, endpoint(fetch))).toBe('ok');
    expect(JSON.parse((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)).toEqual({ token, op: 'clear', ids: [id] });
  });

  it('sends nothing the endpoint would refuse', async () => {
    const fetch = answer(200, { status: 'ok' });
    expect(await writeSharedGroceries(token, { op: 'clear', ids: ['1; drop table'] }, endpoint(fetch))).toBe('failed');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('says why it was refused', async () => {
    expect(await writeSharedGroceries(token, { op: 'clear', ids: [id] }, endpoint(answer(404, { status: 'not_shared' })))).toBe('not_shared');
    expect(await writeSharedGroceries(token, { op: 'clear', ids: [id] }, endpoint(answer(404, 'Function not found')))).toBe('failed');
    expect(await writeSharedGroceries(token, { op: 'clear', ids: [id] }, endpoint(answer(403)))).toBe('read_only');
    expect(await writeSharedGroceries(token, { op: 'clear', ids: [id] }, endpoint(answer(429)))).toBe('too_many');
    expect(await writeSharedGroceries(token, { op: 'clear', ids: [id] }, endpoint(answer(500)))).toBe('failed');
    const offline = vi.fn(async () => Promise.reject(new Error('offline')));
    expect(await writeSharedGroceries(token, { op: 'clear', ids: [id] }, endpoint(offline as never))).toBe('failed');
  });
});

describe('sharedAdd', () => {
  it('reads the line as the app does, with the matcher\'s query', () => {
    expect(sharedAdd('2 onions')).toMatchObject({ op: 'add', name: 'Onions', quantity: 2, unit: 'piece', full: 'onion' });
    expect(sharedAdd('500 g carrots')).toMatchObject({ name: 'Carrots', quantity: 500, unit: 'g' });
    expect(sharedAdd('   ')).toBeNull();
  });
});

describe('sharedItems', () => {
  it('reads as the list\'s own rows, with nobody as the author', () => {
    expect(sharedItems(list as never)[0]).toMatchObject({ name: 'Onions', created_by: null, recipes: null, recipe_id: null });
  });
});
