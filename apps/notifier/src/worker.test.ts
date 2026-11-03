// Spec 046 FR-005: the notifier's minute loop and its health check.
import { describe, expect, it, vi } from 'vitest';
import { createWorker } from './worker';

describe('createWorker', () => {
  it('runs every job each tick and logs what they report', async () => {
    const log = vi.fn();
    const worker = createWorker([{ name: 'a', run: async () => '2 sent' }, { name: 'b', run: async () => null }], 60_000, log);
    await worker.tick();
    expect(log.mock.calls).toEqual([['a: 2 sent']]);
  });

  it('skips a tick while the previous one is still running', async () => {
    let release: () => void = () => {};
    const run = vi.fn(() => (run.mock.calls.length > 1 ? Promise.resolve(null) : new Promise<null>((resolve) => { release = () => resolve(null); })));
    const worker = createWorker([{ name: 'slow', run }], 60_000, () => {});
    const first = worker.tick();
    await worker.tick();
    expect(run).toHaveBeenCalledTimes(1);
    release();
    await first;
    await worker.tick();
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('keeps going when a job fails, and logs it', async () => {
    const log = vi.fn();
    const after = vi.fn(async () => null);
    const worker = createWorker([{ name: 'broken', run: async () => { throw new Error('boom'); } }, { name: 'after', run: after }], 60_000, log);
    await worker.tick();
    expect(log).toHaveBeenCalledWith('broken failed: boom');
    expect(after).toHaveBeenCalled();
    await createWorker([{ name: 'db', run: () => Promise.reject({ message: 'Invalid API key' }) }], 60_000, log).tick();
    expect(log).toHaveBeenCalledWith('db failed: Invalid API key');
  });

  it('is healthy only after a recent tick', async () => {
    let now = 0;
    const worker = createWorker([], 60_000, () => {}, () => now);
    expect(worker.healthy()).toBe(false);
    await worker.tick();
    expect(worker.healthy()).toBe(true);
    now = 180_000;
    expect(worker.healthy()).toBe(false);
  });
});
