// Spec 010: the timer store. US1 (two timers keep counting across screens and reloads),
// SC-002 (10 timers), the "ended while closed" edge case and the events.
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { Text } from 'react-native';
import { clearTimers, createTimerStore, TimersProvider, useTimers, useTimerStore, type TimerStore } from './timer-store';
import { clock, remaining } from './timers';
import type { ChoiceStorage } from './recipe-choices';
import { fakeTracker } from '../test/fakes';

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
