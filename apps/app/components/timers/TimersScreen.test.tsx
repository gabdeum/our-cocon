// Spec 011 US2: the Timers screen lists every timer, newest first, with progress, −1/+1, Edit
// presets, Pause/Resume and Stop; done ones offer "Add 1 more minute" and Dismiss. Also the empty
// state, the quick kitchen timer (FR-004), the footnote (FR-005) and `timers_screen_opened`.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { createTimerStore, TimersContext, type TimerStore } from '../../lib/timer-store';
import type { ChoiceStorage } from '../../lib/recipe-choices';
import { fakeTracker } from '../../test/fakes';
import { TimersScreen } from './TimersScreen';

const T0 = 1_760_000_000_000;
const noStorage: ChoiceStorage = { getItem: async () => null, setItem: async () => undefined };
const quiche = { recipeId: 'r1', recipeName: 'Leek & bacon quiche' };
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
  const onBack = vi.fn();
  render(
    <TimersContext.Provider value={store}>
      <TimersScreen tracker={tracker} onBack={onBack} />
    </TimersContext.Provider>,
  );
  return { tracker, onBack };
}

/** The design's three timers: Blind bake running, Soften leeks paused, Simmer done. */
function designTimers() {
  const simmer = store.start('Simmer', 60, 'step', { recipeId: 'r2', recipeName: 'Pumpkin soup' });
  act(() => vi.advanceTimersByTime(60 * 1000));
  const leeks = store.start('Soften leeks', 8 * 60, 'step', { ...quiche, stepId: 's1' });
  store.pause(leeks);
  const blind = store.start('Blind bake', 12 * 60, 'step', { ...quiche, stepId: 's2' });
  return { simmer, leeks, blind };
}

const card = (name: string) => {
  const title = screen.getByText(name);
  const el = title.closest('[role="timer"]') ? title : title.parentElement?.parentElement?.parentElement;
  if (!el) throw new Error(`no card ${name}`);
  return el as HTMLElement;
};
const clockOf = (name: string) => within(card(name)).getByRole('timer').textContent;

describe('Timers screen (spec 011 US2)', () => {
  it('FR-002: header, then every timer newest first with its recipe and state', () => {
    act(() => void designTimers());
    setup();
    expect(screen.getByRole('heading', { level: 1, name: 'Timers' })).toBeTruthy();
    expect(screen.getByText('1 running · 3 total')).toBeTruthy();
    const timers = screen.getAllByRole('timer').map((t) => t.textContent);
    expect(timers).toEqual(['12:00', '08:00', '00:00']);
    expect(within(card('Blind bake')).getByText('Leek & bacon quiche · Running')).toBeTruthy();
    expect(within(card('Soften leeks')).getByText('Leek & bacon quiche · Paused')).toBeTruthy();
    expect(within(card('Simmer')).getByText('Pumpkin soup · Done!')).toBeTruthy();
    expect(screen.getByText("Timers keep running when you leave the recipe. You'll hear a chime when one ends.")).toBeTruthy();
  });

  it('sends timers_screen_opened once, with the count only', () => {
    act(() => void designTimers());
    const { tracker } = setup();
    act(() => vi.advanceTimersByTime(3000));
    expect(tracker.track).toHaveBeenCalledExactlyOnceWith('timers_screen_opened', { timer_count: 3 });
  });

  it('running: progress, −1 / +1, Pause and Resume', () => {
    act(() => void store.start('Blind bake', 10 * 60, 'step', quiche));
    setup();
    act(() => vi.advanceTimersByTime(150 * 1000));
    expect(clockOf('Blind bake')).toBe('07:30');
    expect(within(card('Blind bake')).getByRole('progressbar').getAttribute('aria-valuenow')).toBe('25');

    fireEvent.click(within(card('Blind bake')).getByRole('button', { name: 'One minute more' }));
    expect(clockOf('Blind bake')).toBe('08:30');
    fireEvent.click(within(card('Blind bake')).getByRole('button', { name: 'One minute less' }));
    expect(clockOf('Blind bake')).toBe('07:30');

    fireEvent.click(within(card('Blind bake')).getByRole('button', { name: 'Pause' }));
    act(() => vi.advanceTimersByTime(5000));
    expect(clockOf('Blind bake')).toBe('07:30');
    expect(screen.getByText('0 running · 1 total')).toBeTruthy();
    expect(within(card('Blind bake')).getByText('Leek & bacon quiche · Paused')).toBeTruthy();
    fireEvent.click(within(card('Blind bake')).getByRole('button', { name: 'Resume' }));
    act(() => vi.advanceTimersByTime(1000));
    expect(clockOf('Blind bake')).toBe('07:29');
  });

  it('Edit opens 5 · 10 · 15 · 30 min; picking one sets it and closes', () => {
    act(() => void store.start('Blind bake', 12 * 60, 'step', quiche));
    setup();
    const c = () => within(card('Blind bake'));
    expect(c().queryByText('Set to')).toBeNull();
    fireEvent.click(c().getByRole('button', { name: 'Edit' }));
    expect(c().getByText('Set to')).toBeTruthy();
    expect(['5 min', '10 min', '15 min', '30 min'].every((l) => c().getByRole('button', { name: l }))).toBe(true);
    expect(c().getByRole('button', { name: 'Close' }).getAttribute('aria-expanded')).toBe('true');

    fireEvent.click(c().getByRole('button', { name: '15 min' }));
    expect(clockOf('Blind bake')).toBe('15:00');
    expect(c().queryByText('Set to')).toBeNull();
    expect(c().getByRole('button', { name: 'Edit' })).toBeTruthy();
  });

  it('Stop takes a timer away', () => {
    act(() => void store.start('Blind bake', 12 * 60, 'step', quiche));
    setup();
    fireEvent.click(within(card('Blind bake')).getByRole('button', { name: 'Stop' }));
    expect(screen.queryByText('Blind bake')).toBeNull();
  });

  it('done: "Add 1 more minute" runs it again; Dismiss takes it away', () => {
    act(() => void store.start('Simmer', 60, 'step'));
    setup();
    act(() => vi.advanceTimersByTime(60 * 1000));
    const c = () => within(card('Simmer'));
    expect(c().getByText('No recipe · Done!')).toBeTruthy();
    expect(c().queryByRole('button', { name: 'Pause' })).toBeNull();

    fireEvent.click(c().getByRole('button', { name: 'Add 1 more minute' }));
    expect(clockOf('Simmer')).toBe('01:00');
    expect(c().getByText('No recipe · Running')).toBeTruthy();
    act(() => vi.advanceTimersByTime(60 * 1000));
    fireEvent.click(c().getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText('Simmer')).toBeNull();
  });

  it('no timers: the empty message above the quick timer, which adds a 5 min kitchen timer', () => {
    setup();
    expect(screen.getByText('0 running · 0 total')).toBeTruthy();
    expect(screen.getByText('No timers running. Start one from any recipe step.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '+ Quick kitchen timer (5 min)' }));
    expect(screen.queryByText('No timers running. Start one from any recipe step.')).toBeNull();
    expect(clockOf('Kitchen timer')).toBe('05:00');
    expect(within(card('Kitchen timer')).getByText('No recipe · Running')).toBeTruthy();
  });

  it('Back goes back', () => {
    const { onBack } = setup();
    fireEvent.click(screen.getByRole('link', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledOnce();
  });
});
