// Spec 046: when to ask (FR-002), the switches kept on the phone (FR-003), this install's id (FR-004)
// and where a tap may go (FR-006).
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_NOTIFICATION_PREFS } from '@cocon/schemas';
vi.mock('expo-crypto', () => ({ randomUUID: () => '00000000-0000-4000-8000-00000000ffff' }));

import { ASK_AGAIN_MS, deviceId, registerDevice, NO_ASK, openedRoute, readAsk, readPrefs, recordAsk, shouldAsk, unregisterDevice, writeAsk, writePrefs } from './notifications';

function memoryStorage(initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial));
  return {
    items,
    getItem: vi.fn(async (k: string) => items.get(k) ?? null),
    setItem: vi.fn(async (k: string, v: string) => void items.set(k, v)),
    removeItem: vi.fn(async (k: string) => void items.delete(k)),
  };
}

const DAY = 24 * 60 * 60 * 1000;

describe('shouldAsk (FR-002)', () => {
  it('asks the first time, while the iPhone has no answer', () => {
    expect(shouldAsk(NO_ASK, 'undetermined', 0)).toBe(true);
  });

  it('never once notifications are allowed or denied', () => {
    expect(shouldAsk(NO_ASK, 'granted', 0)).toBe(false);
    expect(shouldAsk(NO_ASK, 'denied', 0)).toBe(false);
  });

  it('"Not now": once more, no sooner than 14 days later, then never', () => {
    const once = recordAsk(NO_ASK, 'not_now', 1000);
    expect(once).toEqual({ askedAt: 1000, askedCount: 1, lastResult: 'not_now' });
    expect(shouldAsk(once, 'undetermined', 1000 + 13 * DAY)).toBe(false);
    expect(shouldAsk(once, 'undetermined', 1000 + ASK_AGAIN_MS)).toBe(true);
    const twice = recordAsk(once, 'not_now', 1000 + 20 * DAY);
    expect(shouldAsk(twice, 'undetermined', 1000 + 365 * DAY)).toBe(false);
  });

  it('keeps the ask on the phone, and reads anything odd as never asked', async () => {
    const storage = memoryStorage();
    await writeAsk(storage, recordAsk(NO_ASK, 'not_now', 5));
    expect(await readAsk(storage)).toEqual({ askedAt: 5, askedCount: 1, lastResult: 'not_now' });
    expect(await readAsk(memoryStorage({ 'cocon.notifications.ask': 'not json' }))).toEqual(NO_ASK);
  });
});

describe('the switches (FR-003)', () => {
  it('start on, "Events I’m on"', async () => {
    expect(await readPrefs(memoryStorage(), 'u1')).toEqual({ timers_live: true, timers_alert: true, reminders_on: true, reminders_scope: 'mine' });
  });

  it('are kept per person on the phone; unknown values fall back to the defaults', async () => {
    const storage = memoryStorage();
    await writePrefs(storage, 'u1', { ...DEFAULT_NOTIFICATION_PREFS, reminders_on: false });
    expect((await readPrefs(storage, 'u1')).reminders_on).toBe(false);
    expect((await readPrefs(storage, 'u2')).reminders_on).toBe(true);
    storage.items.set('cocon.notifications.prefs.u3', JSON.stringify({ reminders_scope: 'everyone' }));
    expect(await readPrefs(storage, 'u3')).toEqual(DEFAULT_NOTIFICATION_PREFS);
  });
});

describe('this install (FR-004)', () => {
  it('makes its id once and keeps it', async () => {
    const storage = memoryStorage();
    const make = vi.fn(() => 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    expect(await deviceId(storage, make)).toBe('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    expect(await deviceId(storage, () => 'other')).toBe('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    expect(make).toHaveBeenCalledOnce();
  });

  it('signing out removes its registration, and never waits more than 3 s', async () => {
    vi.useFakeTimers();
    const rpc = vi.fn(() => new Promise(() => undefined));
    const done = unregisterDevice({ rpc } as never, memoryStorage({ 'cocon.device.id': 'device-1' }));
    await vi.advanceTimersByTimeAsync(3000);
    await done;
    expect(rpc).toHaveBeenCalledWith('unregister_push_device', { p_device_id: 'device-1' });
    vi.useRealTimers();
  });

  it('an id the server says is someone else’s is replaced by a new one (security review)', async () => {
    const storage = memoryStorage({ 'cocon.device.id': 'taken-id' });
    const rpc = vi.fn(async (_: string, args: { p_device_id: string }) => ({ error: args.p_device_id === 'taken-id' ? { code: '42501' } : null }));
    const native = { pushToken: async () => 'ExponentPushToken[abcdefgh1234]', appVersion: '1.0.0' };
    expect(await registerDevice({ rpc } as never, native as never, storage, DEFAULT_NOTIFICATION_PREFS, () => 'fresh-id')).toBe(true);
    expect(rpc.mock.calls.map(([, a]) => a.p_device_id)).toEqual(['taken-id', 'fresh-id']);
    expect(storage.items.get('cocon.device.id')).toBe('fresh-id');
  });

  it('nothing to remove on a phone that never registered', async () => {
    const rpc = vi.fn();
    await unregisterDevice({ rpc } as never, memoryStorage());
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe('openedRoute (FR-006)', () => {
  it('opens Timers, or one event on one day', () => {
    expect(openedRoute({ kind: 'timer_done', route: '/timers' })).toEqual({ kind: 'timer_done', route: '/timers' });
    const event = '/calendar/0f8fad5b-d9cb-469f-a165-70867728950e?date=2026-11-03';
    expect(openedRoute({ kind: 'reminder', route: event })).toEqual({ kind: 'reminder', route: event });
  });

  it.each([
    [{ kind: 'reminder', route: '/settings/family' }],
    [{ kind: 'reminder', route: 'https://example.com' }],
    [{ kind: 'reminder', route: '/timers/../oauth/consent' }],
    [{ kind: 'reminder', route: '/calendar/x?date=2026-11-03' }],
    [{ kind: 'other', route: '/timers' }],
    [null],
    ['/timers'],
  ])('ignores anything else: %j', (data) => {
    expect(openedRoute(data)).toBeNull();
  });
});
