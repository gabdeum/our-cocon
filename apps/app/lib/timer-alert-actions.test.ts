// Spec 047 US2: "+1 min" and "Stop" on the Lock Screen, with the app running or closed.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleTimerAction, type TimerActionResponse } from './timer-alert-actions';
import { createTimerStore, queueTimerWrite } from './timer-store';
import { remaining, type Timer } from './timers';
import { fakeTracker } from '../test/fakes';

const T0 = 1_760_000_000_000;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
});
afterEach(() => vi.useRealTimers());

/** Signed in as CLOSED, whose app is closed. */
function memoryStorage() {
  const data = new Map<string, string>([['cocon.timers.owner', CLOSED]]);
  return { data, getItem: vi.fn(async (k: string) => data.get(k) ?? null), setItem: vi.fn(async (k: string, v: string) => void data.set(k, v)) };
}
function fakeAlerts() {
  return {
    schedule: vi.fn(async (_t: Timer) => undefined),
    cancel: vi.fn(async (_ids: readonly string[]) => undefined),
    reconcile: vi.fn(async () => undefined),
    cancelAll: vi.fn(async () => undefined),
  };
}

const CLOSED = '00000000-0000-4000-8000-0000000000c1';
const LIVE = '00000000-0000-4000-8000-0000000000c2';
const A = 'mh1-0';
const ended = { id: A, label: 'Blind bake', totalSeconds: 720, state: 'running', endsAt: T0 - 5000 };
const tap = (action: string, over: Partial<TimerActionResponse> = {}): TimerActionResponse => ({
  actionIdentifier: action,
  categoryIdentifier: 'timer_done',
  fromPush: false,
  data: { kind: 'timer_done', route: '/timers', timerId: A, userId: CLOSED },
  ...over,
});

describe('app closed: straight to the saved timers', () => {
  it('"+1 min" runs it again for a minute and schedules a new alert', async () => {
    const storage = memoryStorage();
    storage.data.set(`cocon.timers.${CLOSED}`, JSON.stringify([ended]));
    const alerts = fakeAlerts();
    const tracker = fakeTracker();
    expect(await handleTimerAction(tap('add_minute'), { storage, tracker, alertsFor: async () => alerts })).toBe(true);
    const [saved] = JSON.parse(storage.data.get(`cocon.timers.${CLOSED}`) ?? '[]') as Timer[];
    expect(saved).toMatchObject({ id: A, state: 'running', endsAt: T0 + 60_000 });
    expect(alerts.schedule).toHaveBeenCalledWith(expect.objectContaining({ id: A, endsAt: T0 + 60_000 }));
    expect(tracker.track).toHaveBeenCalledWith('timer_alert_action', { action: 'add_minute' });
  });

  it('"Stop" ends it and cancels both alerts', async () => {
    const storage = memoryStorage();
    storage.data.set(`cocon.timers.${CLOSED}`, JSON.stringify([ended]));
    const alerts = fakeAlerts();
    const tracker = fakeTracker();
    await handleTimerAction(tap('stop'), { storage, tracker, alertsFor: async () => alerts });
    expect(JSON.parse(storage.data.get(`cocon.timers.${CLOSED}`) ?? 'null')).toEqual([]);
    expect(alerts.cancel).toHaveBeenCalledWith([A]);
    expect(tracker.track).toHaveBeenCalledWith('timer_alert_action', { action: 'stop' });
  });

  it('a timer that is gone: its alerts are cleared, nothing is saved', async () => {
    const storage = memoryStorage();
    const alerts = fakeAlerts();
    await handleTimerAction(tap('add_minute'), { storage, tracker: fakeTracker(), alertsFor: async () => alerts });
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(alerts.cancel).toHaveBeenCalledWith([A]);
  });

  it('a store loading meanwhile reads the change, never the old list', async () => {
    const storage = memoryStorage();
    storage.data.set(`cocon.timers.${CLOSED}`, JSON.stringify([ended]));
    let release: () => void = () => undefined;
    const gate = new Promise<void>((r) => (release = r));
    void queueTimerWrite(() => gate);
    const handled = handleTimerAction(tap('add_minute'), { storage, tracker: fakeTracker(), alertsFor: async () => fakeAlerts() });
    const store = createTimerStore({ storage, userId: CLOSED, tracker: fakeTracker() });
    const loading = store.load();
    release();
    await handled;
    await loading;
    const [t] = store.getSnapshot().timers;
    expect(t).toMatchObject({ id: A, state: 'running' });
    expect(t && remaining(t, Date.now())).toBe(60);
    store.destroy();
  });

  it('left over from someone no longer signed in here: the alert goes, their timers stay untouched', async () => {
    const storage = memoryStorage();
    storage.data.set('cocon.timers.owner', '');
    storage.data.set(`cocon.timers.${CLOSED}`, JSON.stringify([ended]));
    const alerts = fakeAlerts();
    await handleTimerAction(tap('add_minute'), { storage, tracker: fakeTracker(), alertsFor: async () => alerts });
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(alerts.cancel).toHaveBeenCalledWith([A]);
    expect(alerts.schedule).not.toHaveBeenCalled();
  });
});

describe('app running: through the store', () => {
  it('"+1 min" and "Stop" act on the live timer, which reschedules and cancels its own alerts', async () => {
    const alerts = fakeAlerts();
    const store = createTimerStore({ storage: memoryStorage(), userId: LIVE, tracker: fakeTracker(), alerts });
    await store.load();
    const id = store.start('Blind bake', 60, 'step');
    vi.advanceTimersByTime(61_000);
    const data = { kind: 'timer_done', route: '/timers', timerId: id, userId: LIVE };
    const alertsFor = vi.fn();
    await handleTimerAction(tap('add_minute', { data }), { storage: memoryStorage(), tracker: fakeTracker(), alertsFor });
    expect(store.getSnapshot().timers[0]).toMatchObject({ state: 'running' });
    expect(alerts.schedule).toHaveBeenLastCalledWith(expect.objectContaining({ id, endsAt: Date.now() + 60_000 }));
    await handleTimerAction(tap('stop', { data }), { storage: memoryStorage(), tracker: fakeTracker(), alertsFor });
    expect(store.getSnapshot().timers).toEqual([]);
    expect(alerts.cancel).toHaveBeenLastCalledWith([id]);
    expect(alertsFor).not.toHaveBeenCalled();
    store.destroy();
  });
});

describe('ignored', () => {
  it.each([
    ['a push from a server', tap('add_minute', { fromPush: true })],
    ['another category', tap('add_minute', { categoryIdentifier: 'reminder' })],
    ['an unknown action', tap('snooze')],
    ['a payload that isn’t a timer’s', tap('stop', { data: { kind: 'reminder', route: '/timers' } })],
  ])('%s', async (_name, response) => {
    const storage = memoryStorage();
    const tracker = fakeTracker();
    expect(await handleTimerAction(response, { storage, tracker, alertsFor: async () => fakeAlerts() })).toBe(false);
    expect(tracker.track).not.toHaveBeenCalled();
    expect(storage.getItem).not.toHaveBeenCalled();
  });
});
