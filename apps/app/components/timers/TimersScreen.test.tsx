// Spec 011 US2: the Timers screen lists every timer, newest first, with progress, −1/+1,
// Pause/Resume and Stop; done ones offer "Add 1 more minute" and Dismiss. Also the empty state, the
// quick kitchen timers of 5 · 10 · 15 · 30 min (FR-004), the footnote (FR-005) and `timers_screen_opened`.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { createTimerStore, TimersContext, type TimerStore } from '../../lib/timer-store';
import type { ChoiceStorage } from '../../lib/recipe-choices';
import { fakeTracker } from '../../test/fakes';
import { TimersScreen, type TimersScreenProps } from './TimersScreen';
import { quiche as quicheRecipe } from '@cocon/schemas/quiche.fixture';
import type { RecipeDetail } from '../../lib/recipe';

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

function setup(props: Partial<TimersScreenProps> = {}) {
  const tracker = fakeTracker();
  const onBack = vi.fn();
  render(
    <TimersContext.Provider value={store}>
      <TimersScreen tracker={tracker} onBack={onBack} {...props} />
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

  it('cards have no Edit button', () => {
    act(() => void store.start('Blind bake', 12 * 60, 'step', quiche));
    setup();
    expect(within(card('Blind bake')).queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(within(card('Blind bake')).queryByRole('button', { name: /min$/ })).toBeNull();
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

  it('no timers: the empty message above the quick timers; 5 min adds a running kitchen timer', () => {
    setup();
    expect(screen.getByText('0 running · 0 total')).toBeTruthy();
    expect(screen.getByText('No timers running. Start one from any recipe step.')).toBeTruthy();
    const quick = within(screen.getByRole('group', { name: 'Quick kitchen timer' }));
    expect(quick.getAllByRole('button').map((b) => b.textContent)).toEqual(['5 min', '10 min', '15 min', '30 min']);
    fireEvent.click(quick.getByRole('button', { name: 'Start a 5 min kitchen timer' }));
    expect(screen.queryByText('No timers running. Start one from any recipe step.')).toBeNull();
    expect(clockOf('Kitchen timer')).toBe('05:00');
    expect(within(card('Kitchen timer')).getByText('No recipe · Running')).toBeTruthy();
  });

  it('each quick timer starts its own kitchen timer: 15 and 30 min', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Start a 15 min kitchen timer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start a 30 min kitchen timer' }));
    expect(screen.getAllByRole('timer').map((t) => t.textContent)).toEqual(['30:00', '15:00']);
    expect(screen.getByText('2 running · 2 total')).toBeTruthy();
  });

  it('Back goes back', () => {
    const { onBack } = setup();
    fireEvent.click(screen.getByRole('link', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledOnce();
  });
});

// 032-later L19: a step timer's card opens cooking mode at its step, while that step is there.
describe('Go to step (L19)', () => {
  const recipeId = 'c0c0e000-0000-4000-8000-000000000001';
  const stepId = (quicheRecipe.steps[1]?.id ?? '');
  const recipe = { deleted_at: null, steps: quicheRecipe.steps, variants: quicheRecipe.variants } as unknown as RecipeDetail;
  const startStep = (id = stepId) => act(() => void store.start('Blind bake', 720, 'step', { recipeId, recipeName: 'Leek & bacon quiche', stepId: id }));

  it('opens cooking mode at the step', () => {
    startStep();
    const onGoToStep = vi.fn();
    setup({ recipes: { [recipeId]: recipe }, onGoToStep });
    fireEvent.click(within(card('Blind bake')).getByRole('button', { name: 'Go to step: Blind bake' }));
    expect(onGoToStep).toHaveBeenCalledWith(recipeId, stepId);
  });

  it('is hidden for kitchen timers', () => {
    act(() => void store.quick(5 * 60));
    setup({ recipes: {}, onGoToStep: vi.fn() });
    expect(screen.queryByRole('button', { name: /^Go to step/ })).toBeNull();
  });

  it('is hidden when the step or the recipe is gone, or while the recipe loads', () => {
    startStep('c0c02000-0000-4000-8000-00000000000f');
    setup({ recipes: { [recipeId]: recipe }, onGoToStep: vi.fn() });
    expect(screen.queryByRole('button', { name: /^Go to step/ })).toBeNull();
    cleanup();
    store.destroy();
    store = createTimerStore({ storage: noStorage, userId: '', tracker: fakeTracker() });
    startStep();
    setup({ recipes: { [recipeId]: null }, onGoToStep: vi.fn() });
    expect(screen.queryByRole('button', { name: /^Go to step/ })).toBeNull();
    cleanup();
    setup({ recipes: { [recipeId]: { ...recipe, deleted_at: '2026-10-20T10:00:00Z' } }, onGoToStep: vi.fn() });
    expect(screen.queryByRole('button', { name: /^Go to step/ })).toBeNull();
    cleanup();
    setup({ recipes: {}, onGoToStep: vi.fn() });
    expect(screen.queryByRole('button', { name: /^Go to step/ })).toBeNull();
  });
});
