// Spec 010 US3: a timer reaching zero chimes twice, vibrates, and shows "Blind bake is done" on any
// screen. One that ended while the app was closed only shows "Done!" (no alert).
import { useEffect, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TimersProvider, useTimerStore, type TimerStore } from '../../lib/timer-store';
import type { ChoiceStorage } from '../../lib/recipe-choices';
import { fakeTracker } from '../../test/fakes';
import { BANNER_MS, CHIME_GAP_MS, TimerAlerts } from './TimerAlerts';

const T0 = 1_760_000_000_000;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function memoryStorage(initial: Record<string, string> = {}): ChoiceStorage {
  const data = new Map(Object.entries(initial));
  return { getItem: async (k) => data.get(k) ?? null, setItem: async (k, v) => void data.set(k, v) };
}

const flush = () =>
  act(async () => {
    for (let i = 0; i < 5; i++) await Promise.resolve();
  });

async function setup(storage: ChoiceStorage = memoryStorage()) {
  const chime = vi.fn();
  const vibrate = vi.fn();
  const onOpenTimers = vi.fn();
  const got: { store?: TimerStore } = {};
  function Grab() {
    const s = useTimerStore();
    useEffect(() => void (got.store = s), [s]);
    return null;
  }
  const Wrap = ({ children }: { children: ReactNode }) => (
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 0 } }}>
      <TimersProvider userId="u1" storage={storage} tracker={fakeTracker()}>
        {children}
      </TimersProvider>
    </SafeAreaProvider>
  );
  render(
    <Wrap>
      <Grab />
      <TimerAlerts chime={chime} vibrate={vibrate} onOpenTimers={onOpenTimers} />
    </Wrap>,
  );
  await flush();
  if (!got.store) throw new Error('no store');
  return { store: got.store, chime, vibrate, onOpenTimers };
}

describe('TimerAlerts (spec 010 US3)', () => {
  it('at zero: chime twice, vibrate, and "Blind bake is done" for 8 s', async () => {
    const { store, chime, vibrate } = await setup();
    act(() => void store.start('Blind bake', 12 * 60, 'step'));
    act(() => vi.advanceTimersByTime(12 * 60 * 1000 - 1000));
    expect(chime).not.toHaveBeenCalled();
    expect(screen.queryByText('Blind bake is done')).toBeNull();

    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByRole('status').textContent).toBe('Blind bake is doneOpen timers');
    expect(chime).toHaveBeenCalledTimes(1);
    expect(vibrate).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(CHIME_GAP_MS));
    expect(chime).toHaveBeenCalledTimes(2);

    act(() => vi.advanceTimersByTime(BANNER_MS));
    expect(screen.queryByText('Blind bake is done')).toBeNull();
    expect(chime).toHaveBeenCalledTimes(2);
  });

  it('a newer banner replaces the old one', async () => {
    const { store } = await setup();
    act(() => {
      store.start('Blind bake', 2, 'step');
      store.start('Soften leeks', 4, 'step');
    });
    act(() => vi.advanceTimersByTime(2000));
    expect(screen.getByText('Blind bake is done')).toBeTruthy();
    act(() => vi.advanceTimersByTime(2000));
    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(screen.getByText('Soften leeks is done')).toBeTruthy();
    // The first banner's 8 s don't cut the second one short.
    act(() => vi.advanceTimersByTime(BANNER_MS - 3000));
    expect(screen.getByText('Soften leeks is done')).toBeTruthy();
  });

  it('a timer that ended while the app was closed gives no alert', async () => {
    const stored = [{ id: 'a', label: 'Blind bake', totalSeconds: 60, state: 'running', endsAt: T0 - 5000 }];
    const { store, chime, vibrate } = await setup(memoryStorage({ 'cocon.timers.u1': JSON.stringify(stored) }));
    act(() => vi.advanceTimersByTime(2000));
    expect(store.getSnapshot().timers[0]?.state).toBe('done');
    expect(chime).not.toHaveBeenCalled();
    expect(vibrate).not.toHaveBeenCalled();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('spec 011 (L17): "Open timers" on the banner opens the Timers screen and closes the banner', async () => {
    const { store, onOpenTimers } = await setup();
    act(() => void store.start('Blind bake', 60, 'step'));
    act(() => vi.advanceTimersByTime(60 * 1000));
    fireEvent.click(screen.getByRole('button', { name: 'Open timers' }));
    expect(onOpenTimers).toHaveBeenCalledOnce();
    expect(screen.queryByText('Blind bake is done')).toBeNull();
  });
});
