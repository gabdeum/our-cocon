// Spec 012: cooking mode. US1 (Next, swipe, segments), US2 (the dark timer in the step and the
// header pill), US3 (the screen stays on), the edge cases (Finish, the recipe page's servings and
// variants) and the events. Scrolling itself is in use-step-scroll.test.ts.
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { quiche, quicheIds } from '@cocon/schemas/quiche.fixture';
import type { RecipeDetail } from '../../lib/recipe';
import type { ChoiceStorage } from '../../lib/recipe-choices';
import { TimersProvider } from '../../lib/timer-store';
import { fakeTracker, gabriel } from '../../test/fakes';

const keepAwake = vi.hoisted(() => ({
  isAvailableAsync: vi.fn(async () => true),
  activateKeepAwakeAsync: vi.fn(async () => undefined),
  deactivateKeepAwake: vi.fn(async () => undefined),
}));
vi.mock('expo-keep-awake', () => keepAwake);

const { CookScreen } = await import('./CookScreen');
type CookScreenProps = Parameters<typeof CookScreen>[0];

const T0 = 1_760_000_000_000;
const detail: RecipeDetail = {
  id: 'c0c0e000-0000-4000-8000-000000000001',
  name: 'Leek & bacon quiche',
  description: null,
  serves: 6,
  total_minutes: 70,
  prep_minutes: null,
  source_text: null,
  cuisine: 'french',
  best_months: [],
  photo_path: null,
  created_by: gabriel.user_id,
  source: 'app',
  deleted_at: null,
  deleted_by: null,
  ingredients: quiche.ingredients,
  steps: quiche.steps,
  variants: quiche.variants,
  facts: {},
};
const STEPS = quiche.steps.length;

function memoryStorage(initial: Record<string, string> = {}): ChoiceStorage {
  const data = new Map(Object.entries(initial));
  return { getItem: async (k: string) => data.get(k) ?? null, setItem: async (k: string, v: string) => void data.set(k, v) };
}

const settle = () =>
  act(async () => {
    for (let i = 0; i < 5; i++) await Promise.resolve();
  });

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
  keepAwake.isAvailableAsync.mockResolvedValue(true);
  // jsdom has no scrolling.
  Element.prototype.scrollTo = vi.fn();
  Element.prototype.scroll = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

async function setup(props: Partial<CookScreenProps> = {}) {
  const tracker = fakeTracker();
  const onClose = vi.fn();
  const onOpenTimers = vi.fn();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <TimersProvider userId={gabriel.user_id} storage={memoryStorage()} tracker={tracker}>
      {children}
    </TimersProvider>
  );
  const utils = render(
    <CookScreen
      recipe={detail}
      userId={gabriel.user_id}
      storage={memoryStorage()}
      tracker={tracker}
      onClose={onClose}
      onOpenTimers={onOpenTimers}
      onScaleByIngredient={vi.fn()}
      onConvert={vi.fn()}
      {...props}
    />,
    { wrapper },
  );
  await settle();
  return { ...utils, tracker, onClose, onOpenTimers };
}

const section = (i: number) => screen.getByTestId(`cook-step-${i}`);
const isCurrent = (i: number) => section(i).getAttribute('aria-current') === 'step';
const press = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));

describe('Cooking mode (spec 012)', () => {
  it('opens at step 1 with the header, every step and "Bon appétit!", and sends cooking_started', async () => {
    const { tracker } = await setup();
    // The header's Exit, and Back reads Exit on the first step.
    expect(screen.getAllByRole('button', { name: 'Exit' })).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Cooking options' })).toBeTruthy();
    expect(screen.getByText(`Step 1 of ${STEPS}`)).toBeTruthy();
    expect(screen.getByText('Serves 6 · swipe up for next')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Blind bake' })).toBeTruthy();
    expect(screen.getByText('Bon appétit!')).toBeTruthy();
    expect(isCurrent(0)).toBe(true);
    expect(isCurrent(1)).toBe(false);
    expect(tracker.track).toHaveBeenCalledWith('cooking_started', { step_count: STEPS });
    expect(tracker.track).toHaveBeenCalledTimes(1);
  });

  it('US1 › 1: "Next step" moves to step 2 and dims the others', async () => {
    await setup();
    press('Next step');
    expect(screen.getByText(`Step 2 of ${STEPS}`)).toBeTruthy();
    expect(isCurrent(1)).toBe(true);
    expect(isCurrent(0)).toBe(false);
    press('Back');
    expect(isCurrent(0)).toBe(true);
  });

  it('US1 › 3: tapping the 5th segment jumps to step 5', async () => {
    await setup();
    press(/^Go to step 5/);
    expect(screen.getByText(`Step 5 of ${STEPS}`)).toBeTruthy();
    expect(isCurrent(4)).toBe(true);
    expect(screen.getByRole('button', { name: `Go to step 5: ${(quiche.steps[4]?.name ?? '')}` })).toBeTruthy();
  });

  it('US2: a timed step has the dark timer; starting it puts the pill in the header, beside the options', async () => {
    const { tracker } = await setup();
    const blind = section(1);
    expect(within(blind).getByText('Blind bake timer')).toBeTruthy();
    expect(within(blind).getByRole('timer').textContent).toBe('12:00');

    fireEvent.click(within(blind).getByRole('button', { name: 'One minute more' }));
    expect(within(blind).getByRole('timer').textContent).toBe('13:00');
    fireEvent.click(within(blind).getByRole('button', { name: 'Start timer' }));
    expect(tracker.track).toHaveBeenCalledWith('step_timer_started', { step_index: 1 });
    expect(within(blind).getByRole('button', { name: 'Pause' })).toBeTruthy();
    expect(screen.getByRole('link', { name: '1 timer running. Open timers' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cooking options' })).toBeTruthy();

    fireEvent.click(within(blind).getByRole('button', { name: 'Pause' }));
    expect(within(blind).getByRole('button', { name: 'Resume' })).toBeTruthy();
    // A paused timer isn't shown in the pill (TimerPill README).
    expect(screen.queryByRole('link', { name: /Open timers/ })).toBeNull();
  });

  it('US3: keeps the screen on while open and lets it lock after', async () => {
    const { unmount } = await setup();
    expect(keepAwake.activateKeepAwakeAsync).toHaveBeenCalledTimes(1);
    unmount();
    await settle();
    expect(keepAwake.deactivateKeepAwake).toHaveBeenCalledTimes(1);
  });

  it('US3: "Screen stays on" is a switch in the options sheet; off lets the screen lock', async () => {
    const { tracker } = await setup();
    press('Cooking options');
    const awake = screen.getByRole('switch', { name: 'Screen stays on' });
    expect(awake.getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText("Your screen won't lock while you cook")).toBeTruthy();
    fireEvent.click(awake);
    await settle();
    expect(keepAwake.deactivateKeepAwake).toHaveBeenCalled();
    expect(screen.getByRole('switch', { name: 'Screen stays on' }).getAttribute('aria-checked')).toBe('false');
    expect(tracker.track).toHaveBeenCalledWith('cook_screen_awake_toggled', { on: false });
  });

  it('US3: the switch explains it when this browser cannot keep the screen on; it starts off when the setting is off', async () => {
    keepAwake.isAvailableAsync.mockResolvedValue(false);
    const first = await setup();
    expect(screen.queryByText('This browser may let the screen lock.')).toBeNull();
    press('Cooking options');
    expect(screen.getByText('This browser may let the screen lock.')).toBeTruthy();
    first.unmount();

    keepAwake.isAvailableAsync.mockResolvedValue(true);
    await setup({ cooking: { thermometer: true, keepAwake: false } });
    expect(keepAwake.activateKeepAwakeAsync).not.toHaveBeenCalled();
    press('Cooking options');
    expect(screen.getByRole('switch', { name: 'Screen stays on' }).getAttribute('aria-checked')).toBe('false');
  });

  it('the options sheet has the recipe page\'s "…" options: Imperial changes the steps at once and is remembered', async () => {
    const storage = memoryStorage();
    const onConvert = vi.fn();
    const { tracker } = await setup({ storage, onConvert });
    press('Cooking options');
    expect(screen.getByRole('switch', { name: "I'm using a kitchen scale" })).toBeTruthy();
    press('Imperial');
    expect(within(section(0)).getByText(/350 °F \(180 °C\)/)).toBeTruthy();
    expect(tracker.track).toHaveBeenCalledWith('units_toggled', { system: 'imperial' });
    expect(JSON.parse((await storage.getItem(`cocon.recipe.${gabriel.user_id}.${detail.id}`)) ?? '{}').system).toBe('imperial');
    fireEvent.click(screen.getByRole('link', { name: 'Unit converter' }));
    expect(onConvert).toHaveBeenCalledOnce();
    expect(screen.queryByRole('switch', { name: 'Screen stays on' })).toBeNull();
  });

  it('Back on the first step reads Exit and leaves cooking mode, like Exit', async () => {
    const { tracker, onClose } = await setup();
    const back = screen.getAllByRole('button', { name: 'Exit' })[1] as HTMLElement;
    fireEvent.click(back);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(tracker.track).toHaveBeenCalledWith('cooking_exited', { at_step: 1, step_count: STEPS });
    cleanup();
    await setup();
    press('Next step');
    expect(screen.getByRole('button', { name: 'Back' })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Exit' })).toHaveLength(1);
  });

  it('the last step reads "Finish": it closes with no prompt and sends cooking_finished', async () => {
    const { tracker, onClose } = await setup();
    press(new RegExp(`^Go to step ${STEPS}`));
    expect(screen.queryByRole('button', { name: 'Next step' })).toBeNull();
    act(() => vi.advanceTimersByTime(42 * 60_000));
    press('Finish');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(tracker.track).toHaveBeenCalledWith('cooking_finished', { step_count: STEPS, minutes: 42 });
  });

  it('Exit closes and sends cooking_exited with the step it was on', async () => {
    const { tracker, onClose } = await setup();
    press(/^Go to step 3/);
    press('Exit');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(tracker.track).toHaveBeenCalledWith('cooking_exited', { at_step: 3, step_count: STEPS });
  });

  it("uses the recipe page's servings and variants on this device", async () => {
    const storage = memoryStorage({
      [`cocon.recipe.${gabriel.user_id}.${detail.id}`]: JSON.stringify({ servings: 9, version: null, options: [quicheIds.dough] }),
    });
    await setup({ storage });
    // "Make my own dough" adds a step first.
    expect(screen.getByText(`Step 1 of ${STEPS + 1}`)).toBeTruthy();
    expect(screen.getByText('Serves 9 · swipe up for next')).toBeTruthy();
    expect(within(section(0)).getByRole('heading', { level: 2, name: 'Make the dough' })).toBeTruthy();
    // Amounts are scaled: 200 g flour for 6 is 300 g for 9.
    expect(within(section(0)).getByText(/300 g flour/i)).toBeTruthy();
  });

  it("032-later L22: uses the recipe page's units, kitchen scale and scale by an ingredient too", async () => {
    const storage = memoryStorage({
      [`cocon.recipe.${gabriel.user_id}.${detail.id}`]: JSON.stringify({
        servings: 6,
        version: null,
        options: [],
        system: 'imperial',
        kitchenScale: false,
        scaledBy: { ingredientId: quicheIds.lardons, amount: 250, unit: 'g' },
      }),
    });
    await setup({ storage });
    expect(screen.getByText('Serves 7½ · swipe up for next')).toBeTruthy();
    // Imperial and ×1.25: the oven reads °F first, and leeks drop their weight with no scale.
    expect(within(section(0)).getByText(/350 °F \(180 °C\)/)).toBeTruthy();
    expect(within(section(2)).getByText(/2½ leeks/)).toBeTruthy();
    expect(within(section(2)).queryByText(/\(375 g\)/)).toBeNull();
    expect(within(section(2)).getByText(/8.8 oz bacon lardons/)).toBeTruthy();
  });

  it('opens at a given step (a step timer\'s "Go to step"), or step 1 when it is gone', async () => {
    await setup({ stepId: (quiche.steps[3]?.id ?? '') });
    expect(screen.getByText(`Step 4 of ${STEPS}`)).toBeTruthy();
    cleanup();
    await setup({ stepId: 'gone' });
    expect(screen.getByText(`Step 1 of ${STEPS}`)).toBeTruthy();
  });

  it('shows loading, then the error with Try again; Exit still works', async () => {
    const onRetry = vi.fn();
    await setup({ recipe: undefined });
    expect(screen.getByRole('progressbar', { name: 'Loading recipe' })).toBeTruthy();
    cleanup();
    const { onClose } = await setup({ recipe: null, failed: true, onRetry });
    expect(screen.getByText("We couldn't open this recipe.")).toBeTruthy();
    press('Try again');
    expect(onRetry).toHaveBeenCalled();
    press('Exit');
    expect(onClose).toHaveBeenCalled();
  });

  it('leaving another way (system or browser back) still sends cooking_exited, once', async () => {
    const first = await setup();
    press(/^Go to step 2/);
    first.unmount();
    expect(first.tracker.track).toHaveBeenCalledWith('cooking_exited', { at_step: 2, step_count: STEPS });

    const second = await setup();
    fireEvent.click(screen.getAllByRole('button', { name: 'Exit' })[0] as HTMLElement);
    second.unmount();
    expect(second.tracker.track.mock.calls.filter(([e]) => e === 'cooking_exited')).toHaveLength(1);
  });

  it('a recipe with no steps closes straight back, once', async () => {
    const { onClose, rerender } = await setup({ recipe: { ...detail, steps: [], variants: [] } });
    rerender(
      <CookScreen
        recipe={{ ...detail, steps: [], variants: [] }}
        userId={gabriel.user_id}
        storage={memoryStorage()}
        tracker={fakeTracker()}
        onClose={vi.fn()}
        onOpenTimers={vi.fn()}
        onScaleByIngredient={vi.fn()}
        onConvert={vi.fn()}
      />,
    );
    await settle();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('a deleted recipe shows that it could not be opened', async () => {
    await setup({ recipe: { ...detail, deleted_at: '2026-10-20T10:00:00Z' }, onRetry: vi.fn() });
    expect(screen.getByText("We couldn't open this recipe.")).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
    expect(screen.queryByText('Bon appétit!')).toBeNull();
  });
});
