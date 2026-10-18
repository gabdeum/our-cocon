// Spec 004: a failed write reverts.
import { describe, expect, it } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { optimisticWrite } from './write';

const key = ['grocery_items'];
const tick = (items: { id: string; checked: boolean }[] | undefined) => items?.map((i) => ({ ...i, checked: true }));

function client() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  qc.setQueryData(key, [{ id: 'a', checked: false }]);
  return qc;
}

describe('optimisticWrite', () => {
  it('shows the change at once and keeps it when the save works', async () => {
    const qc = client();
    let seen: unknown;
    const result = await optimisticWrite(qc, key, tick, () => {
      seen = qc.getQueryData(key);
      return Promise.resolve({ error: null });
    });
    expect(seen).toEqual([{ id: 'a', checked: true }]);
    expect(result).toBe('saved');
    expect(qc.getQueryData(key)).toEqual([{ id: 'a', checked: true }]);
  });

  it('reverts and reports a failed save', async () => {
    const qc = client();
    expect(await optimisticWrite(qc, key, tick, () => Promise.resolve({ error: { message: 'boom' } }))).toBe('failed');
    expect(qc.getQueryData(key)).toEqual([{ id: 'a', checked: false }]);
  });

  it('reverts when the network throws', async () => {
    const qc = client();
    expect(await optimisticWrite(qc, key, tick, () => Promise.reject(new Error('offline')))).toBe('failed');
    expect(qc.getQueryData(key)).toEqual([{ id: 'a', checked: false }]);
  });
});
