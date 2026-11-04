// Spec 010: the timer store. US1 (two timers keep counting across screens and reloads),
// SC-002 (10 timers), the "ended while closed" edge case and the events.
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { Text } from 'react-native';
import { clearTimers, createTimerStore, TimersProvider, timersOnScreen, useTimerOwner, useTimers, useTimerStore, type TimerStore } from './timer-store';
import { clock, remaining, type Timer } from './timers';
import type { ChoiceStorage } from './recipe-choices';
import { fakeTracker } from '../test/fakes';
import type { LiveActionRecord } from './live-activity';
import { handleTimerAction } from './timer-alert-actions';

const T0 = 1_760_000_000_000;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function memoryStorage(): ChoiceStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: vi.fn(async (k: string) => data.get(k) ?? null),
    setItem: vi.fn(async (k: string, v: string) => void data.set(k, v)),
  };
}

const flush = () =>
  act(async () => {
    for (let i = 0; i < 5; i++) await Promise.resolve();
  });

/** What a screen shows: "Blind bake 09:00 running". */
function Clocks() {
  const { timers, now } = useTimers();
  return (
    <>
      {timers.map((t) => (
        <Text key={t.id}>{`${t.label} ${clock(remaining(t, now))} ${t.state}`}</Text>
      ))}
    </>
  );
}

function storeFor(storage: ChoiceStorage, tracker = fakeTracker()) {
  return createTimerStore({ storage, userId: 'u1', tracker });
}

const shown = (store: TimerStore) => {
  const { timers, now } = store.getSnapshot();
  return timers.map((t) => `${t.label} ${clock(remaining(t, now))} ${t.state}`);
};

describe('timer store (spec 010)', () => {
  it('US1: "Blind bake" and "Soften leeks" keep counting while I am on another screen', async () => {
    const storage = memoryStorage();
    const tracker = fakeTracker();
    const got: { store?: TimerStore } = {};
    function Grab() {
      const s = useTimerStore();
      useEffect(() => void (got.store = s), [s]);
      return null;
    }
    const tree = (onRecipe: boolean) => (
      <TimersProvider userId="u1" storage={storage} tracker={tracker}>
        <Grab />
        {onRecipe ? <Clocks /> : null}
      </TimersProvider>
    );
    const view = render(tree(true));
    await flush();
    act(() => {
      got.store?.start('Blind bake', 12 * 60, 'step');
      got.store?.start('Soften leeks', 8 * 60, 'step');
    });
    expect(screen.getByText('Blind bake 12:00 running')).toBeTruthy();
    // Go to Groceries (the clocks unmount) for 3 minutes, then come back.
    view.rerender(tree(false));
    act(() => vi.advanceTimersByTime(3 * 60 * 1000));
    expect(screen.queryByText(/Blind bake/)).toBeNull();
    view.rerender(tree(true));
    expect(screen.getByText('Blind bake 09:00 running')).toBeTruthy();
    expect(screen.getByText('Soften leeks 05:00 running')).toBeTruthy();
  });

  it('edge: after a reload timers resume from their end times; one that ended while closed is done, silently', async () => {
    const storage = memoryStorage();
    const first = storeFor(storage);
    first.start('Blind bake', 12 * 60, 'step');
    first.start('Soften leeks', 60, 'step');
    first.destroy();
    await flush();

    vi.setSystemTime(T0 + 2 * 60 * 1000);
    const tracker = fakeTracker();
    const again = storeFor(storage, tracker);
    const finished = vi.fn();
    again.onFinished(finished);
    await again.load();
    expect(shown(again)).toEqual(['Blind bake 10:00 running', 'Soften leeks 00:00 done']);
    expect(finished).not.toHaveBeenCalled();
    expect(tracker.track).not.toHaveBeenCalled();
    again.destroy();
  });

  it('spec 011: a paused or done timer untouched for 3 hours is cleared, while the app is open', () => {
    const store = storeFor(memoryStorage());
    const leeks = store.start('Soften leeks', 8 * 60, 'step');
    store.pause(leeks);
    store.start('Simmer', 60, 'step');
    store.start('Braise', 4 * 3600, 'step');
    act(() => vi.advanceTimersByTime(60 * 1000));
    expect(shown(store)).toEqual(['Soften leeks 08:00 paused', 'Simmer 00:00 done', `Braise ${clock(4 * 3600 - 60)} running`]);

    // Touching a paused timer starts its 3 hours over.
    act(() => vi.advanceTimersByTime(30 * 60 * 1000));
    store.add(leeks, 60);
    act(() => vi.advanceTimersByTime(2.5 * 3600 * 1000));
    expect(shown(store).map((t) => t.split(' ')[0])).toEqual(['Soften', 'Braise']);
    act(() => vi.advanceTimersByTime(30 * 60 * 1000));
    // The running one is never cleared, however long it runs.
    expect(shown(store).map((t) => t.split(' ')[0])).toEqual(['Braise']);
    store.destroy();
  });

  it('spec 011: a timer saved before 011 (no stop time) still goes 3 hours later, across reloads', async () => {
    const storage = memoryStorage();
    storage.data.set('cocon.timers.u1', JSON.stringify([{ id: 'p', label: 'Soften leeks', totalSeconds: 480, state: 'paused', remainingSeconds: 300 }]));
    const first = storeFor(storage);
    await first.load();
    first.destroy();
    await flush();

    vi.setSystemTime(T0 + 2 * 3600 * 1000);
    const second = storeFor(storage);
    await second.load();
    expect(shown(second)).toEqual(['Soften leeks 05:00 paused']);
    second.destroy();
    await flush();

    vi.setSystemTime(T0 + 3 * 3600 * 1000);
    const third = storeFor(storage);
    await third.load();
    expect(shown(third)).toEqual([]);
    third.destroy();
  });

  it('spec 011: after a reload, timers stopped more than 3 hours ago are gone', async () => {
    const storage = memoryStorage();
    const first = storeFor(storage);
    first.start('Simmer', 60, 'step');
    first.pause(first.start('Soften leeks', 8 * 60, 'step'));
    first.destroy();
    await flush();

    // Simmer ended at T0 + 1 min; 3 h after that it goes, but the leeks (paused at T0) went first.
    vi.setSystemTime(T0 + 3 * 3600 * 1000 + 30 * 1000);
    const again = storeFor(storage);
    await again.load();
    expect(shown(again)).toEqual(['Simmer 00:00 done']);
    again.destroy();
  });

  it('reaching zero while open marks it done, tells listeners once and sends timer_finished', async () => {
    const tracker = fakeTracker();
    const store = storeFor(memoryStorage(), tracker);
    const finished = vi.fn();
    store.onFinished(finished);
    store.start('Blind bake', 2, 'step');
    act(() => vi.advanceTimersByTime(2000));
    expect(shown(store)).toEqual(['Blind bake 00:00 done']);
    act(() => vi.advanceTimersByTime(5000));
    expect(finished).toHaveBeenCalledTimes(1);
    expect(finished.mock.calls[0]?.[0]).toMatchObject({ label: 'Blind bake', state: 'done' });
    expect(tracker.track).toHaveBeenCalledWith('timer_finished', {});
    expect(tracker.track.mock.calls.filter(([e]) => e === 'timer_finished')).toHaveLength(1);
    store.destroy();
  });

  it('sends timer_started, and timer_adjusted with whole minutes; never a name', () => {
    const tracker = fakeTracker();
    const store = storeFor(memoryStorage(), tracker);
    const id = store.start('Blind bake', 310, 'step');
    store.add(id, 60);
    store.add(id, -60);
    store.set(id, 900);
    store.quick();
    expect(tracker.track.mock.calls).toEqual([
      ['timer_started', { from: 'step' }],
      ['timer_adjusted', { delta_min: 1 }],
      ['timer_adjusted', { delta_min: -1 }],
      ['timer_adjusted', { delta_min: 10 }],
      ['timer_started', { from: 'quick' }],
    ]);
    expect(shown(store)).toEqual(['Blind bake 15:00 running', 'Kitchen timer 05:00 running']);
    store.destroy();
  });

  it('SC-002: 10 timers at once stay right, and screens re-render only when a shown second changes', () => {
    const store = storeFor(memoryStorage());
    for (let i = 1; i <= 10; i++) store.start(`Timer ${i}`, i * 60, 'quick');
    const listener = vi.fn();
    store.subscribe(listener);
    act(() => vi.advanceTimersByTime(10_000));
    // 40 ticks, 10 visible seconds.
    expect(listener).toHaveBeenCalledTimes(10);
    expect(shown(store)).toEqual(Array.from({ length: 10 }, (_, i) => `Timer ${i + 1} ${clock((i + 1) * 60 - 10)} running`));
    store.destroy();
  });

  it('keeps each person’s timers apart on a shared device', async () => {
    const storage = memoryStorage();
    const mine = storeFor(storage);
    mine.start('Blind bake', 600, 'step');
    await flush();
    const theirs = createTimerStore({ storage, userId: 'u2', tracker: fakeTracker() });
    await theirs.load();
    expect(theirs.getSnapshot().timers).toEqual([]);
    mine.destroy();
    theirs.destroy();
  });

  it('a store destroyed while still reading storage never starts ticking', async () => {
    let release: (v: string | null) => void = () => undefined;
    const stored = JSON.stringify([{ id: 'a', label: 'Blind bake', totalSeconds: 600, state: 'running', endsAt: T0 + 600_000 }]);
    const storage: ChoiceStorage = { getItem: () => new Promise((r) => (release = r)), setItem: vi.fn(async () => undefined) };
    const tracker = fakeTracker();
    const store = createTimerStore({ storage, userId: 'u1', tracker });
    const loading = store.load();
    store.destroy();
    release(stored);
    await loading;
    act(() => vi.advanceTimersByTime(700_000));
    expect(tracker.track).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('clearTimers removes this person’s saved timers', async () => {
    const removeItem = vi.fn(async () => undefined);
    await clearTimers({ removeItem }, 'u1');
    expect(removeItem).toHaveBeenCalledWith('cocon.timers.u1');
  });
});

// Spec 047 SC-002: every store action schedules or cancels its Lock Screen alert.
describe('timer alerts (spec 047)', () => {
  function fakeAlerts() {
    return {
      schedule: vi.fn(async (_t: Timer) => undefined),
      cancel: vi.fn(async (_ids: readonly string[]) => undefined),
      reconcile: vi.fn(async (_ts: readonly Timer[]) => undefined),
      cancelAll: vi.fn(async () => undefined),
    };
  }
  const setup = () => {
    const alerts = fakeAlerts();
    const store = createTimerStore({ storage: memoryStorage(), userId: 'u1', tracker: fakeTracker(), alerts });
    return { alerts, store };
  };
  const scheduled = (alerts: ReturnType<typeof fakeAlerts>) => alerts.schedule.mock.calls.map(([t]) => `${t.id} ${((t.endsAt ?? 0) - T0) / 1000}`);

  it('start, resume, ±1 min and set schedule at endsAt; pause, stop and dismiss cancel at once', () => {
    const { alerts, store } = setup();
    const id = store.start('Blind bake', 600, 'step', { recipeId: 'r1', stepId: 's3', recipeName: 'Leek & bacon quiche', stepNumber: 3 });
    expect(scheduled(alerts)).toEqual([`${id} 600`]);
    expect(alerts.schedule.mock.calls[0]?.[0]).toMatchObject({ label: 'Blind bake', stepNumber: 3 });
    store.add(id, 60);
    store.add(id, -60);
    store.set(id, 300);
    expect(scheduled(alerts)).toEqual([`${id} 600`, `${id} 660`, `${id} 600`, `${id} 300`]);
    store.pause(id);
    expect(alerts.cancel).toHaveBeenLastCalledWith([id]);
    alerts.schedule.mockClear();
    store.resume(id);
    expect(scheduled(alerts)).toEqual([`${id} 300`]);
    store.stop(id);
    expect(alerts.cancel).toHaveBeenLastCalledWith([id]);

    const quick = store.quick();
    store.pause(quick);
    alerts.cancel.mockClear();
    store.stop(quick);
    // Paused: its alert went with the pause; nothing waits.
    expect(alerts.cancel).not.toHaveBeenCalled();
  });

  it('never leaves an alert for a paused or stopped timer, whatever the order (SC-002)', () => {
    const { alerts, store } = setup();
    const waiting = new Set<string>();
    alerts.schedule.mockImplementation(async (t) => void waiting.add(t.id));
    alerts.cancel.mockImplementation(async (ids) => void ids.forEach((i) => waiting.delete(i)));
    const a = store.start('Blind bake', 600, 'step');
    const b = store.quick();
    store.pause(a);
    store.add(a, 60);
    store.set(a, 120);
    store.stop(b);
    expect([...waiting]).toEqual([]);
    store.resume(a);
    expect([...waiting]).toEqual([a]);
  });

  it('a timer that ends with the app open: the in-app alert plays, so its follow-up goes', () => {
    const { alerts, store } = setup();
    const id = store.start('Blind bake', 60, 'step');
    act(() => vi.advanceTimersByTime(61_000));
    expect(alerts.cancel).toHaveBeenLastCalledWith([id]);
    alerts.cancel.mockClear();
    store.dismiss(id);
    expect(alerts.cancel).toHaveBeenLastCalledWith([id]);
  });

  it('a done timer cleared after 3 hours loses its alerts', () => {
    const { alerts, store } = setup();
    const id = store.start('Blind bake', 60, 'step');
    act(() => vi.advanceTimersByTime(61_000));
    alerts.cancel.mockClear();
    act(() => vi.advanceTimersByTime(3 * 3600 * 1000));
    expect(alerts.cancel).toHaveBeenCalledWith([id]);
  });

  it('loading matches the phone’s alerts to the saved timers; one that ended while closed stays silent', async () => {
    const storage = memoryStorage();
    storage.data.set('cocon.timers.u1', JSON.stringify([{ id: 'a', label: 'Blind bake', totalSeconds: 60, state: 'running', endsAt: T0 - 1000 }]));
    const alerts = fakeAlerts();
    const store = createTimerStore({ storage, userId: 'u1', tracker: fakeTracker(), alerts });
    store.reconcileAlerts();
    expect(alerts.reconcile).not.toHaveBeenCalled();
    await store.load();
    expect(alerts.reconcile).toHaveBeenCalledWith([expect.objectContaining({ id: 'a', state: 'done' })]);
    expect(alerts.cancel).not.toHaveBeenCalled();
    store.seenDone();
    expect(alerts.cancel).toHaveBeenCalledWith(['a']);
    store.destroy();
  });

  it('a new alerts value (a switch, the permission) keeps the timers and reconciles', async () => {
    const storage = memoryStorage();
    const first = fakeAlerts();
    const second = fakeAlerts();
    const got: { store?: TimerStore } = {};
    function Grab() {
      const s = useTimerStore();
      useEffect(() => void (got.store = s), [s]);
      return null;
    }
    const tracker = fakeTracker();
    const tree = (alerts: ReturnType<typeof fakeAlerts>) => (
      <TimersProvider userId="u1" storage={storage} tracker={tracker} alerts={alerts}>
        <Grab />
      </TimersProvider>
    );
    const { rerender } = render(tree(first));
    await flush();
    const store = got.store;
    if (!store) throw new Error('no store');
    act(() => void store.start('Blind bake', 600, 'step'));
    expect(first.schedule).toHaveBeenCalledOnce();
    rerender(tree(second));
    await flush();
    expect(got.store).toBe(store);
    expect(second.reconcile).toHaveBeenCalledWith([expect.objectContaining({ label: 'Blind bake' })]);
    act(() => store.pause(store.getSnapshot().timers[0]?.id ?? ''));
    expect(second.cancel).toHaveBeenCalledOnce();
    expect(first.cancel).not.toHaveBeenCalled();
  });
});

// Spec 047, from Gabriel's iPhone: the app can keep running in the background (audio), unseen. A timer
// that ends then must not count as seen in the app, or its Lock Screen alert would be taken away.
describe('ended unseen (spec 047)', () => {
  function fakeAlerts() {
    return {
      schedule: vi.fn(async (_t: Timer) => undefined),
      cancel: vi.fn(async (_ids: readonly string[]) => undefined),
      reconcile: vi.fn(async (_ts: readonly Timer[]) => undefined),
      cancelAll: vi.fn(async () => undefined),
    };
  }
  function setup() {
    const alerts = fakeAlerts();
    const tracker = fakeTracker();
    const front = { on: true };
    const store = createTimerStore({ storage: memoryStorage(), userId: 'u1', tracker, alerts, isForeground: () => front.on });
    const finished = vi.fn();
    store.onFinished(finished);
    return { alerts, tracker, front, store, finished };
  }

  it('locked while the app keeps running in the background: no in-app alert, the phone’s alert and follow-up stay', () => {
    const { alerts, tracker, front, store, finished } = setup();
    const id = store.start('Blind bake', 60, 'step');
    front.on = false;
    act(() => vi.advanceTimersByTime(61_000));
    expect(store.getSnapshot().timers[0]).toMatchObject({ id, state: 'done' });
    expect(finished).not.toHaveBeenCalled();
    expect(alerts.cancel).not.toHaveBeenCalled();
    expect(tracker.track).not.toHaveBeenCalledWith('timer_finished', {});
  });

  it('asleep through zero, then back on screen: still unseen (the gap gives it away)', () => {
    const { alerts, front, store, finished } = setup();
    store.start('Blind bake', 60, 'step');
    // Asleep: no ticks at all, then it wakes on screen.
    front.on = false;
    act(() => vi.advanceTimersByTime(10_000));
    front.on = true;
    vi.setSystemTime(Date.now() + 60_000);
    act(() => vi.advanceTimersByTime(250));
    expect(store.getSnapshot().timers[0]?.state).toBe('done');
    expect(finished).not.toHaveBeenCalled();
    expect(alerts.cancel).not.toHaveBeenCalled();
  });

  it('on screen right through zero: the in-app alert, and the follow-up goes', () => {
    const { alerts, store, finished } = setup();
    const id = store.start('Blind bake', 60, 'step');
    act(() => vi.advanceTimersByTime(61_000));
    expect(finished).toHaveBeenCalledOnce();
    expect(alerts.cancel).toHaveBeenCalledWith([id]);
  });

  it('the phone’s own alert shows while the app is open only when the app won’t play its own', () => {
    const { front, store } = setup();
    store.start('Blind bake', 60, 'step');
    act(() => vi.advanceTimersByTime(1000));
    expect(timersOnScreen()).toBe(true);
    front.on = false;
    act(() => vi.advanceTimersByTime(1000));
    expect(timersOnScreen()).toBe(false);
    // Woken on screen after a sleep: not until it has been ticking there.
    front.on = true;
    expect(timersOnScreen(Date.now() + 10_000)).toBe(false);
  });

  it('the Timers screen behind the Lock Screen clears nothing; on screen it does', () => {
    const { alerts, front, store } = setup();
    const id = store.start('Blind bake', 60, 'step');
    front.on = false;
    act(() => vi.advanceTimersByTime(61_000));
    store.seenDone();
    expect(alerts.cancel).not.toHaveBeenCalled();
    front.on = true;
    store.seenDone();
    expect(alerts.cancel).toHaveBeenCalledWith([id]);
  });
});

// Spec 047, from Gabriel's iPhone: every launch starts with the session loading. That must never
// remove the alerts waiting; only a real sign-out does.
describe('useTimerOwner', () => {
  it('launching (loading → ready) keeps every alert; signing out removes them and the owner', async () => {
    const { renderHook } = await import('@testing-library/react');
    const storage = memoryStorage();
    const removeAlerts = vi.fn(async () => undefined);
    type Status = 'loading' | 'signedOut' | 'noFamily' | 'ready';
    const { rerender } = renderHook(({ status, userId }: { status: Status; userId: string }) => useTimerOwner(storage, status, userId, removeAlerts), {
      initialProps: { status: 'loading' as Status, userId: '' },
    });
    rerender({ status: 'noFamily', userId: '' });
    rerender({ status: 'ready', userId: 'u1' });
    await flush();
    expect(removeAlerts).not.toHaveBeenCalled();
    expect(storage.data.get('cocon.timers.owner')).toBe('u1');
    rerender({ status: 'signedOut', userId: '' });
    await flush();
    expect(removeAlerts).toHaveBeenCalledOnce();
    expect(storage.data.get('cocon.timers.owner')).toBe('');
  });

  it('straight from one person to another: the last one’s alerts go', async () => {
    const { renderHook } = await import('@testing-library/react');
    const storage = memoryStorage();
    const removeAlerts = vi.fn(async () => undefined);
    const { rerender } = renderHook(({ userId }: { userId: string }) => useTimerOwner(storage, 'ready', userId, removeAlerts), { initialProps: { userId: 'a1' } });
    await flush();
    expect(removeAlerts).not.toHaveBeenCalled();
    rerender({ userId: 'b2' });
    await flush();
    expect(removeAlerts).toHaveBeenCalledOnce();
    expect(storage.data.get('cocon.timers.owner')).toBe('b2');
  });
});

// Spec 048 FR-001 and FR-004: the Lock Screen card follows every store change, and its taps come back
// to the timers (and their alerts) as at the moment they were tapped.
describe('Lock Screen card (spec 048)', () => {
  const USER = '0b6c3c3e-8d1a-4c55-9f0e-6a1d2b3c4d5e';
  function fakeLive() {
    const taps: LiveActionRecord[] = [];
    return {
      taps,
      sync: vi.fn((_ts: readonly Timer[]) => undefined),
      takeActions: vi.fn(async () => taps.splice(0)),
      onAction: vi.fn(() => () => undefined),
      dispose: vi.fn(),
    };
  }
  const synced = (live: ReturnType<typeof fakeLive>) => live.sync.mock.calls.map(([ts]) => ts.map((t) => `${t.label} ${t.state}`).join(', '));

  it('shows the saved timers once read, never an empty list before, then every change', async () => {
    const storage = memoryStorage();
    storage.data.set(`cocon.timers.${USER}`, JSON.stringify([{ id: 'a-1', label: 'Blind bake', totalSeconds: 600, state: 'running', endsAt: T0 + 600_000 }]));
    const live = fakeLive();
    const store = createTimerStore({ storage, userId: USER, tracker: fakeTracker(), live });
    store.syncLive();
    expect(live.sync).not.toHaveBeenCalled();
    await store.load();
    expect(synced(live)).toEqual(['Blind bake running']);
    store.start('Pasta water', 700, 'quick');
    expect(synced(live).at(-1)).toBe('Blind bake running, Pasta water running');
    const id = 'a-1';
    store.pause(id);
    store.stop(id);
    expect(synced(live).slice(2)).toEqual(['Blind bake paused, Pasta water running', 'Pasta water running']);
    // Reaching zero changes the card too (done, US3).
    await act(async () => void vi.advanceTimersByTime(700_000));
    expect(synced(live).at(-1)).toBe('Pasta water done');
    store.destroy();
  });

  it('applies "+1 min", "Pause" and "Resume" from the card at their own time, with their alerts and events', async () => {
    const live = fakeLive();
    const tracker = fakeTracker();
    const schedule = vi.fn(async (_t: Timer) => undefined);
    const alerts = { schedule, cancel: vi.fn(async () => undefined), reconcile: vi.fn(async () => undefined), cancelAll: vi.fn(async () => undefined) };
    const store = createTimerStore({ storage: memoryStorage(), userId: USER, tracker, live, alerts });
    await store.load();
    const id = store.start('Blind bake', 300, 'step');
    // Tapped while the app slept; it runs again 30 s later.
    live.taps.push({ owner: USER, timerId: id, action: 'add_minute', at: T0 + 10_000 });
    vi.setSystemTime(T0 + 40_000);
    await store.applyLiveActions();
    expect(store.getSnapshot().timers[0]).toMatchObject({ state: 'running', endsAt: T0 + 360_000 });
    expect(schedule).toHaveBeenLastCalledWith(expect.objectContaining({ endsAt: T0 + 360_000 }));
    expect(tracker.track).toHaveBeenCalledWith('timer_live_activity_action', { action: 'add_minute' });

    live.taps.push({ owner: USER, timerId: id, action: 'pause', at: T0 + 60_000 }, { owner: USER, timerId: id, action: 'resume', at: T0 + 100_000 });
    vi.setSystemTime(T0 + 120_000);
    await store.applyLiveActions();
    // Paused with 5:00 left at 1:00, resumed at 1:40: ends at 6:40.
    expect(store.getSnapshot().timers[0]).toMatchObject({ state: 'running', endsAt: T0 + 400_000 });
    expect(synced(live).at(-1)).toBe('Blind bake running');
    store.destroy();
  });

  it('reads taps left while the app was closed as soon as it has read the timers', async () => {
    const storage = memoryStorage();
    storage.data.set(`cocon.timers.${USER}`, JSON.stringify([{ id: 'a-1', label: 'Blind bake', totalSeconds: 600, state: 'running', endsAt: T0 + 600_000 }]));
    const live = fakeLive();
    live.taps.push({ owner: USER, timerId: 'a-1', action: 'pause', at: T0 });
    const store = createTimerStore({ storage, userId: USER, tracker: fakeTracker(), live });
    await store.load();
    expect(store.getSnapshot().timers[0]).toMatchObject({ state: 'paused', remainingSeconds: 600 });
    store.destroy();
  });

  it('L119: a "+1 min" from the alert with no store yet shows on the card once the store reads it', async () => {
    const storage = memoryStorage();
    storage.data.set(`cocon.timers.${USER}`, JSON.stringify([{ id: 'a-1', label: 'Blind bake', totalSeconds: 600, state: 'done', stoppedAt: T0 }]));
    storage.data.set('cocon.timers.owner', USER);
    const alerts = { schedule: vi.fn(async () => undefined), cancel: vi.fn(async () => undefined), reconcile: vi.fn(async () => undefined), cancelAll: vi.fn(async () => undefined) };
    await handleTimerAction(
      { actionIdentifier: 'add_minute', categoryIdentifier: 'timer_done', fromPush: false, data: { kind: 'timer_done', route: '/timers', timerId: 'a-1', userId: USER } },
      { storage, tracker: fakeTracker(), alertsFor: async () => alerts },
    );
    const live = fakeLive();
    const store = createTimerStore({ storage, userId: USER, tracker: fakeTracker(), live });
    await store.load();
    expect(live.sync.mock.calls[0]?.[0][0]).toMatchObject({ label: 'Blind bake', state: 'running', endsAt: T0 + 60_000 });
    store.destroy();
  });
});
