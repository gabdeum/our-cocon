// Spec 008: the recipe page. US1 (servings 6 → 9 at once), US2 (Vegetarian, "Make my own dough"),
// US3 (tabs), FR-006 (choices remembered on this device), the edge cases and the events.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { onlineManager } from '@tanstack/react-query';
import { quiche, quicheIds } from '@cocon/schemas/quiche.fixture';
import { format, scale } from '@cocon/quantity';
import { RecipePage, SERVINGS_SETTLE_MS, type RecipePageProps } from './RecipePage';
import type { RecipeDetail } from '../../lib/recipe';
import type { ChoiceStorage } from '../../lib/recipe-choices';
import { defaultFormat } from '../../lib/recipe-view';
import { alex, fakeTracker, gabriel } from '../../test/fakes';

beforeEach(() => {
  vi.useFakeTimers();
  onlineManager.setOnline(true);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const detail: RecipeDetail = {
  id: 'c0c0e000-0000-4000-8000-000000000001',
  name: 'Leek & bacon quiche',
  description: 'Silky custard, sweet leeks and a crisp, buttery crust.',
  serves: 6,
  total_minutes: 70,
  cuisine: 'french',
  best_months: [10, 11, 12, 1, 2, 3],
  photo_path: null,
  created_by: gabriel.user_id,
  source: 'claude',
  deleted_at: null,
  deleted_by: null,
  ingredients: quiche.ingredients,
  steps: quiche.steps,
  variants: quiche.variants,
  facts: {},
};

function memoryStorage(initial: Record<string, string> = {}): ChoiceStorage & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: vi.fn(async (k: string) => data.get(k) ?? null),
    setItem: vi.fn(async (k: string, v: string) => void data.set(k, v)),
  };
}

const settle = () =>
  act(async () => {
    for (let i = 0; i < 5; i++) await Promise.resolve();
  });

async function setup(props: Partial<RecipePageProps> = {}) {
  const tracker = fakeTracker();
  const storage = props.storage ?? memoryStorage();
  const onTabChange = vi.fn();
  const utils = render(
    <RecipePage
      recipe={detail}
      members={[gabriel, alex]}
      userId={gabriel.user_id}
      tracker={tracker}
      tab="ingredients"
      onTabChange={onTabChange}
      storage={storage}
      onBack={vi.fn()}
      onShare={vi.fn()}
      onSettings={vi.fn()}
      onAddToGroceries={vi.fn()}
      onStartCooking={vi.fn()}
      {...props}
    />,
  );
  await settle();
  return { ...utils, tracker, storage, onTabChange };
}

const rows = () => within(screen.getByRole('list', { name: 'Ingredients' })).getAllByRole('listitem');
const row = (name: string) => rows().find((r) => within(r).queryByText(name));
const tap = (name: string) => fireEvent.click(screen.getByRole('button', { name }));

describe('header (FR-001)', () => {
  it('shows the title, description and chips', async () => {
    await setup();
    expect(screen.getByRole('heading', { level: 1, name: 'Leek & bacon quiche' })).toBeTruthy();
    for (const chip of ['1 h 10', 'French', 'Best Oct – Mar', 'Gabriel · via Claude']) expect(screen.getByText(chip)).toBeTruthy();
    for (const label of ['Back to recipes', 'Share recipe', 'Recipe settings']) expect(screen.getByRole('button', { name: label })).toBeTruthy();
  });

  it('hides an empty time, cuisine Other and all-year months; no photo shows the first letter', async () => {
    await setup({ recipe: { ...detail, total_minutes: null, cuisine: null, best_months: [], variants: [] } });
    expect(screen.queryByText('1 h 10')).toBeNull();
    expect(screen.queryByText(/^Best /)).toBeNull();
    expect(screen.getByText('L')).toBeTruthy();
    expect(screen.queryByText('Version')).toBeNull();
  });
});

describe('US1: cook for more people', () => {
  it('+ three times shows every amount for 9 at once, with no Apply button', async () => {
    const { tracker } = await setup();
    for (let i = 0; i < 3; i++) tap('More servings');
    expect(screen.getByText('9')).toBeTruthy();
    const engine = scale({ serves: 6, ingredients: quiche.ingredients }, { servings: 9 }).ingredients.map((i) => format(i, defaultFormat));
    rows().forEach((r, n) => expect(r.textContent?.startsWith((engine[n] as { amount: string }).amount)).toBe(true));
    expect(row('Bacon lardons')?.textContent).toContain('300 g');
    expect(screen.queryByRole('button', { name: /apply/i })).toBeNull();
    // One event once the stepper settles.
    expect(tracker.track).not.toHaveBeenCalledWith('servings_changed', expect.anything());
    act(() => vi.advanceTimersByTime(SERVINGS_SETTLE_MS));
    expect(tracker.track).toHaveBeenCalledTimes(1);
    expect(tracker.track).toHaveBeenCalledWith('servings_changed', { from: 6, to: 9 });
  });

  it('sends the change when the page closes before the stepper settles', async () => {
    const { tracker, unmount } = await setup();
    tap('More servings');
    unmount();
    expect(tracker.track).toHaveBeenCalledWith('servings_changed', { from: 6, to: 7 });
  });

  it('does nothing past 1 or 16', async () => {
    const storage = memoryStorage({ [`cocon.recipe.${gabriel.user_id}.${detail.id}`]: JSON.stringify({ servings: 16, version: null, options: [] }) });
    await setup({ storage });
    tap('More servings');
    expect(screen.getByText('16')).toBeTruthy();
    for (let i = 0; i < 20; i++) tap('Fewer servings');
    expect(screen.getByText('1')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Fewer servings' }) as HTMLButtonElement).getAttribute('aria-disabled')).toBe('true');
  });
});

describe('US2: pick a version', () => {
  it('Vegetarian replaces "Bacon lardons 200 g" with "Mushrooms, sliced 250 g" and a Variant tag', async () => {
    const { tracker } = await setup();
    expect(row('Bacon lardons')?.textContent).toContain('200 g');
    expect(screen.getByRole('button', { name: 'Classic' }).getAttribute('aria-pressed')).toBe('true');
    tap('Vegetarian');
    expect(row('Bacon lardons')).toBeUndefined();
    const mushrooms = row('Mushrooms, sliced');
    expect(mushrooms?.textContent).toContain('250 g');
    expect(within(mushrooms as HTMLElement).getByText('Variant')).toBeTruthy();
    expect(tracker.track).toHaveBeenCalledWith('variant_selected', { variant_count: 1 });
    tap('Vegetarian');
    expect(tracker.track).toHaveBeenCalledTimes(1);
  });

  it('"Make my own dough" swaps pastry for flour, cold butter and ice water; Steps goes 6 → 7', async () => {
    await setup();
    expect(screen.getByText('Adds 3 ingredients and 1 step. Changes 1 step')).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Steps · 6' })).toBeTruthy();
    fireEvent.click(screen.getByRole('switch', { name: 'Make my own dough' }));
    expect(row('Shortcrust pastry')).toBeUndefined();
    for (const name of ['Flour', 'Cold butter, cubed', 'Ice water']) expect(row(name)).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Steps · 7' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Ingredients · 10' })).toBeTruthy();
  });
});

describe('US3: tabs', () => {
  it('switches to Steps and back', async () => {
    const { onTabChange, rerender } = await setup();
    fireEvent.click(screen.getByRole('tab', { name: 'Steps · 6' }));
    expect(onTabChange).toHaveBeenCalledWith('steps');
    expect(screen.getByRole('tab', { name: 'Ingredients · 8' }).getAttribute('aria-selected')).toBe('true');
    rerender(
      <RecipePage
        recipe={detail}
        members={[gabriel]}
        userId={gabriel.user_id}
        tracker={fakeTracker()}
        tab="steps"
        onTabChange={onTabChange}
        storage={memoryStorage()}
        onBack={vi.fn()}
        onShare={vi.fn()}
        onSettings={vi.fn()}
        onAddToGroceries={vi.fn()}
        onStartCooking={vi.fn()}
      />,
    );
    await settle();
    expect(screen.queryByRole('list', { name: 'Ingredients' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Start cooking' })).toBeTruthy();
  });
});

describe('FR-006: choices are remembered on this device', () => {
  it('reopens with the servings and variants picked last time', async () => {
    const storage = memoryStorage();
    await setup({ storage });
    tap('More servings');
    tap('Vegetarian');
    cleanup();
    await setup({ storage });
    expect(screen.getByText('7')).toBeTruthy();
    expect(row('Mushrooms, sliced')).toBeTruthy();
    expect(storage.data.get(`cocon.recipe.${gabriel.user_id}.${detail.id}`)).toBe(JSON.stringify({ servings: 7, version: quicheIds.vegetarian, options: [] }));
  });

  it("starts from the recipe as saved for someone else, or when a remembered variant is gone", async () => {
    const storage = memoryStorage({ [`cocon.recipe.${gabriel.user_id}.${detail.id}`]: JSON.stringify({ servings: 4, version: 'deleted', options: [quicheIds.dough] }) });
    await setup({ storage, userId: alex.user_id });
    expect(screen.getByText('6')).toBeTruthy();
    cleanup();
    await setup({ storage });
    expect(screen.getByText('4')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Classic' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('switch', { name: 'Make my own dough' }).getAttribute('aria-checked')).toBe('true');
  });
});

describe('states', () => {
  it('loading shows a skeleton', async () => {
    await setup({ recipe: undefined });
    expect(screen.getByRole('progressbar', { name: 'Loading recipe' })).toBeTruthy();
  });

  it('a recipe that failed to load says what to do', async () => {
    const onRetry = vi.fn();
    await setup({ recipe: undefined, failed: true, onRetry });
    expect(screen.getByText("We couldn't open this recipe.")).toBeTruthy();
    tap('Try again');
    expect(onRetry).toHaveBeenCalled();
  });

  it('a recipe deleted while open says who deleted it, with a way back', async () => {
    const onBack = vi.fn();
    await setup({ recipe: { ...detail, deleted_at: '2026-10-19T10:00:00Z', deleted_by: alex.user_id }, onBack });
    expect(screen.getByText('This recipe was deleted by Alex.')).toBeTruthy();
    const backs = screen.getAllByRole('button', { name: 'Back to recipes' });
    fireEvent.click(backs[backs.length - 1] as HTMLElement);
    expect(onBack).toHaveBeenCalled();
  });

  it('"…" turns honey and is announced as expanded', async () => {
    await setup();
    tap('More options');
    expect(screen.getByRole('button', { name: 'More options' }).getAttribute('aria-expanded')).toBe('true');
  });
});

describe('FR-005: actions', () => {
  it('opens add to groceries and cooking mode', async () => {
    const onAddToGroceries = vi.fn();
    const onStartCooking = vi.fn();
    await setup({ onAddToGroceries, onStartCooking });
    tap('Add to groceries…');
    tap('Start cooking');
    expect(onAddToGroceries).toHaveBeenCalled();
    expect(onStartCooking).toHaveBeenCalled();
  });
});

// Spec 009: the Steps tab.
describe('Steps tab (spec 009)', () => {
  const cards = () => within(screen.getByRole('list', { name: 'Steps' })).getAllByRole('listitem');
  const card = (name: string) => cards().find((c) => within(c).queryByRole('heading', { name })) as HTMLElement;

  it('FR-001: one StepCard per step, in order, with number, name and highlighted amounts', async () => {
    await setup({ tab: 'steps' });
    expect(cards()).toHaveLength(6);
    expect(cards().map((c) => within(c).getByRole('heading').textContent)).toEqual(['Preheat and line', 'Blind bake', 'Cook the filling', 'Mix the custard', 'Bake', 'Rest']);
    const filling = card('Cook the filling');
    expect(within(filling).getByText('3')).toBeTruthy();
    for (const amount of ['20 g butter', '2 leeks (300 g)', '200 g bacon lardons']) expect(within(filling).getByText(amount)).toBeTruthy();
    expect(within(card('Preheat and line')).getByText("Chef's tip")).toBeTruthy();
    expect(screen.getByText('−1 / +1 changes a timer by a minute, even while it runs.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Start cooking' })).toBeTruthy();
  });

  it('US1: amounts follow the servings', async () => {
    await setup({ tab: 'steps' });
    for (let i = 0; i < 3; i++) tap('More servings');
    expect(within(card('Cook the filling')).getByText('3 leeks (450 g)')).toBeTruthy();
    expect(within(card('Cook the filling')).getByText('30 g butter')).toBeTruthy();
  });

  it('US2: the thermometer setting shows or hides the temperature check', async () => {
    await setup({ tab: 'steps' });
    expect(within(card('Bake')).getByText('the center should reach 71 °C (160 °F) and barely wobble.', { exact: false }).textContent).toBe(
      'Temperature check: the center should reach 71 °C (160 °F) and barely wobble.',
    );
    cleanup();
    await setup({ tab: 'steps', thermometer: false });
    expect(within(card('Bake')).queryByText(/Temperature check/)).toBeNull();
    expect(within(card('Bake')).getByText('If the top browns too fast, cover it loosely with foil.')).toBeTruthy();
  });

  it('US3 (buttons only until spec 010): the timer row shows "Start timer", the clock and −1 / +1', async () => {
    const { tracker } = await setup({ tab: 'steps' });
    const blind = card('Blind bake');
    const start = within(blind).getByRole('button', { name: /Start timer/ });
    expect(start.textContent).toContain('12:00');
    expect(within(blind).getByRole('button', { name: 'One minute less' }).textContent).toBe('−1');
    expect(within(blind).getByRole('button', { name: 'One minute more' }).textContent).toBe('+1');
    // Not working until spec 010, and screen readers say so.
    expect(start.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(start);
    expect(tracker.track).not.toHaveBeenCalled();
    expect(within(card('Preheat and line')).queryByRole('button', { name: /Start timer/ })).toBeNull();
  });

  it('edge: a variant step carries the Variant tag and numbering stays continuous', async () => {
    await setup({ tab: 'steps' });
    fireEvent.click(screen.getByRole('switch', { name: /Make my own dough/ }));
    await settle();
    expect(cards()).toHaveLength(7);
    const dough = card('Make the dough');
    expect(within(dough).getByText('1')).toBeTruthy();
    expect(within(dough).getByText('Variant')).toBeTruthy();
    expect(within(card('Preheat and line')).getByText('2')).toBeTruthy();
    expect(within(card('Preheat and line')).queryByText('Variant')).toBeNull();
  });
});
