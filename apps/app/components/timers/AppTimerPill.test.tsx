// Spec 011 US1: the pill shows the most urgent timer's name and clock, live, "+N" for other running ones,
// truncates long names, hides with no timers, and opens Timers (`timer_pill_tapped`).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createTimerStore, TimersContext, type TimerStore } from '../../lib/timer-store';
import type { ChoiceStorage } from '../../lib/recipe-choices';
import { fakeTracker } from '../../test/fakes';
import { AppTimerPill } from './AppTimerPill';

const T0 = 1_760_000_000_000;
const noStorage: ChoiceStorage = { getItem: async () => null, setItem: async () => undefined };
let store: TimerStore;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
  store = createTimerStore({ storage: noStorage, userId: '', tracker: fakeTracker() });
});
afterEach(() => {
  cleanup();
  store.destroy();
  vi.useRealTimers();
});

function setup() {
  const tracker = fakeTracker();
  const onOpen = vi.fn();
  render(
    <TimersContext.Provider value={store}>
      <AppTimerPill onOpen={onOpen} tracker={tracker} />
    </TimersContext.Provider>,
  );
  return { tracker, onOpen };
}

const pill = () => screen.getByRole('link', { name: /Open timers/ });

describe('TimerPill (spec 011 US1)', () => {
  it('is hidden while there are no timers', () => {
    setup();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('shows the running timer and updates every second', () => {
    setup();
    act(() => void store.start('Blind bake', 12 * 60, 'step'));
    expect(pill().textContent).toBe('Blind bake12:00');
    act(() => vi.advanceTimersByTime(1000));
    expect(pill().textContent).toBe('Blind bake11:59');
  });

  it('FR-001: the most urgent one, with "+N" for the other running ones', () => {
    setup();
    act(() => void store.start('Blind bake', 12 * 60, 'step'));
    act(() => void store.start('Soften leeks', 8 * 60, 'step'));
    act(() => void store.quick());
    expect(pill().textContent).toBe('Kitchen timer05:00+2');
    expect(pill().getAttribute('aria-label')).toBe('3 timers running. Open timers');
  });

  it('"+N" and the label count only running timers, not paused or done ones', () => {
    setup();
    const leeks = store.start('Soften leeks', 8 * 60, 'step');
    act(() => store.pause(leeks));
    store.start('Simmer', 60, 'step');
    act(() => vi.advanceTimersByTime(60 * 1000));
    // Only a paused and a done timer: the pill shows the paused one, with no count.
    expect(pill().textContent).toBe('Soften leeks08:00');
    expect(pill().getAttribute('aria-label')).toBe('Open timers');
    act(() => void store.start('Blind bake', 12 * 60, 'step'));
    expect(pill().textContent).toBe('Blind bake12:00');
    expect(pill().getAttribute('aria-label')).toBe('1 timer running. Open timers');
    act(() => void store.quick());
    expect(pill().textContent).toBe('Kitchen timer05:00+1');
    expect(pill().getAttribute('aria-label')).toBe('2 timers running. Open timers');
  });

  it('cuts a long name at 14 characters; never the clock', () => {
    setup();
    act(() => void store.start('Caramelise the onions slowly', 45 * 60, 'step'));
    expect(pill().textContent).toBe('Caramelise the…45:00');
  });

  it('stays while only a done timer is left, until it is dismissed', () => {
    setup();
    const id = store.start('Simmer', 60, 'step');
    act(() => vi.advanceTimersByTime(60 * 1000));
    expect(pill().textContent).toBe('Simmer00:00');
    act(() => store.dismiss(id));
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('opens Timers and sends timer_pill_tapped with the count only', () => {
    const { tracker, onOpen } = setup();
    act(() => void store.start('Blind bake', 12 * 60, 'step'));
    fireEvent.click(pill());
    expect(onOpen).toHaveBeenCalledOnce();
    expect(tracker.track).toHaveBeenCalledExactlyOnceWith('timer_pill_tapped', { timer_count: 1 });
  });
});
