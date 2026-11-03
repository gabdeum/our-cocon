// Spec 046 FR-005: the Expo Push API client, against a fake `fetch`.
import { describe, expect, it, vi } from 'vitest';
import { getReceipts, sendPushes, type PushMessage } from './expo';

const message = (i: number): PushMessage => ({ to: `ExponentPushToken[token${i}xxxx]`, title: 'Test', body: 'Body', data: { kind: 'reminder', route: '/timers' } });

function fakeFetch(answer: (body: unknown, url: string) => unknown, status = 200) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    return new Response(JSON.stringify(answer(body, url)), { status });
  }) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
}

describe('sendPushes', () => {
  it('sends 250 messages in batches of 100, 100 and 50, one ticket each in order', async () => {
    const fetch = fakeFetch((batch) => ({ data: (batch as PushMessage[]).map((m) => ({ status: 'ok', id: `id-${m.to}` })) }));
    const tickets = await sendPushes(Array.from({ length: 250 }, (_, i) => message(i)), { fetch });
    expect(fetch.mock.calls.map(([, init]) => JSON.parse(String(init?.body)).length)).toEqual([100, 100, 50]);
    expect(tickets).toHaveLength(250);
    expect(tickets[249]).toEqual({ ok: true, id: 'id-ExponentPushToken[token249xxxx]' });
  });

  it('passes the access token when there is one', async () => {
    const fetch = fakeFetch(() => ({ data: [{ status: 'ok', id: 'a' }] }));
    await sendPushes([message(1)], { fetch, accessToken: 'secret' });
    expect((fetch.mock.calls[0]?.[1] as RequestInit).headers).toMatchObject({ authorization: 'Bearer secret' });
    await sendPushes([message(1)], { fetch });
    expect((fetch.mock.calls[1]?.[1] as RequestInit).headers).not.toHaveProperty('authorization');
  });

  it('reads an error ticket, keeping Expo’s error code', async () => {
    const fetch = fakeFetch(() => ({ data: [{ status: 'error', message: 'gone', details: { error: 'DeviceNotRegistered' } }] }));
    expect(await sendPushes([message(1)], { fetch })).toEqual([{ ok: false, message: 'gone', error: 'DeviceNotRegistered' }]);
  });

  it('turns a failed request into error tickets for that batch only', async () => {
    let call = 0;
    const failing = vi.fn(async (_url: string, init?: RequestInit) => {
      call++;
      if (call === 1) return new Response('{}', { status: 500 });
      return new Response(JSON.stringify({ data: JSON.parse(String(init?.body)).map(() => ({ status: 'ok', id: 'x' })) }));
    }) as unknown as typeof globalThis.fetch;
    const tickets = await sendPushes(Array.from({ length: 101 }, (_, i) => message(i)), { fetch: failing });
    expect(tickets.slice(0, 100).every((t) => !t.ok)).toBe(true);
    expect(tickets[100]).toEqual({ ok: true, id: 'x' });
  });
});

describe('getReceipts', () => {
  it('asks in batches of 1000 and maps each receipt by ticket id', async () => {
    const fetch = fakeFetch((body) => ({
      data: Object.fromEntries((body as { ids: string[] }).ids.map((id) => [id, id === 'bad' ? { status: 'error', message: 'no', details: { error: 'DeviceNotRegistered' } } : { status: 'ok' }])),
    }));
    const ids = [...Array.from({ length: 1000 }, (_, i) => `t${i}`), 'bad'];
    const receipts = await getReceipts(ids, { fetch });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(receipts.get('t0')).toEqual({ ok: true });
    expect(receipts.get('bad')).toEqual({ ok: false, message: 'no', error: 'DeviceNotRegistered' });
  });
});
