// One full step (spec 009 FR-001, US3; spec 010), as the shared page (019) shows it: text, the
// temperature check, the timer row and the tip. The recipe page lists steps compactly instead.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { quiche } from '@cocon/schemas/quiche.fixture';
import { RecipeStep } from './RecipeStep';
import { recipeView } from '../../lib/recipe-view';
import { TimersProvider } from '../../lib/timer-store';
import type { ChoiceStorage } from '../../lib/recipe-choices';
import { fakeTracker, gabriel } from '../../test/fakes';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const recipe = { serves: 6, ingredients: quiche.ingredients, steps: quiche.steps, variants: quiche.variants, facts: {} };

function memoryStorage(): ChoiceStorage {
  const data = new Map<string, string>();
  return { getItem: async (k: string) => data.get(k) ?? null, setItem: async (k: string, v: string) => void data.set(k, v) };
}

function setup(name: string, thermometer = true) {
  const tracker = fakeTracker();
  const view = recipeView(recipe, 6, { version: null, options: [] }, undefined, { thermometer });
  const index = view.steps.findIndex((s) => s.name === name);
  const step = view.steps[index];
  if (!step) throw new Error(`no step ${name}`);
  render(
    <TimersProvider userId={gabriel.user_id} storage={memoryStorage()} tracker={tracker}>
      <RecipeStep step={step} index={index} recipeId="r-quiche" recipeName="Leek & bacon quiche" tracker={tracker} />
    </TimersProvider>,
  );
  return { tracker };
}

const button = () => screen.getAllByRole('button')[0] as HTMLElement;

describe('RecipeStep', () => {
  it('FR-001: number, name, highlighted amounts and the tip', () => {
    setup('Cook the filling');
    expect(screen.getByRole('heading', { name: 'Cook the filling' })).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    for (const amount of ['20 g butter', '2 leeks (300 g)', '200 g bacon lardons']) expect(screen.getByText(amount)).toBeTruthy();
  });

  it('US2: the thermometer setting shows or hides the temperature check', () => {
    setup('Bake');
    expect(screen.getByText(/the center should reach 71 °C \(160 °F\)/).textContent).toBe('Temperature check: the center should reach 71 °C (160 °F) and barely wobble.');
    cleanup();
    setup('Bake', false);
    expect(screen.queryByText(/Temperature check/)).toBeNull();
    expect(screen.getByText('If the top browns too fast, cover it loosely with foil.')).toBeTruthy();
  });

  it('009 US3 / spec 010: "Start timer" turns olive and counts; Pause, Resume, −1 / +1 work', () => {
    const { tracker } = setup('Blind bake');
    expect(button().textContent).toBe('Start timer12:00');
    expect(button().getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(button());
    expect(tracker.track).toHaveBeenCalledWith('step_timer_started', { step_index: 1 });
    expect(tracker.track).toHaveBeenCalledWith('timer_started', { from: 'step' });
    act(() => vi.advanceTimersByTime(1000));
    expect(button().textContent).toBe('Pause11:59');
    expect(button().getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'One minute more' }));
    expect(button().textContent).toBe('Pause12:59');
    expect(tracker.track).toHaveBeenCalledWith('timer_adjusted', { delta_min: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'One minute less' }));
    expect(button().textContent).toBe('Pause11:59');

    fireEvent.click(button());
    act(() => vi.advanceTimersByTime(5000));
    expect(button().textContent).toBe('Resume11:59');
    fireEvent.click(button());
    act(() => vi.advanceTimersByTime(1000));
    expect(button().textContent).toBe('Pause11:58');
    // Names never reach analytics.
    expect(JSON.stringify(tracker.track.mock.calls)).not.toContain('Blind bake');
  });

  it('spec 010: at zero the row reads "Done!" 00:00 and says so; tapping it puts the row back', () => {
    setup('Blind bake');
    fireEvent.click(button());
    act(() => vi.advanceTimersByTime(11 * 60 * 1000));
    expect(screen.getByText('1 minute left')).toBeTruthy();
    act(() => vi.advanceTimersByTime(60 * 1000));
    expect(button().textContent).toBe('Done!00:00');
    expect(screen.getByText('Blind bake is done')).toBeTruthy();
    fireEvent.click(button());
    expect(button().textContent).toBe('Start timer12:00');
  });

  it('spec 010: before a timer starts, −1 / +1 change the time it starts with (never below 0:30)', () => {
    const { tracker } = setup('Blind bake');
    fireEvent.click(screen.getByRole('button', { name: 'One minute more' }));
    expect(button().textContent).toBe('Start timer13:00');
    for (let i = 0; i < 20; i++) fireEvent.click(screen.getByRole('button', { name: 'One minute less' }));
    expect(button().textContent).toBe('Start timer00:30');
    expect(tracker.track).not.toHaveBeenCalled();
    fireEvent.click(button());
    expect(button().textContent).toBe('Pause00:30');
  });
});
