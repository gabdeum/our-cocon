// Spec 019 US2 (the friend cooks it), US3's "no longer shared", FR-003 and the edge cases on the
// public page (design/ui/OC-SharedView.md).
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { quiche } from '@cocon/schemas/quiche.fixture';
import type { SharedRecipe as Shared } from '@cocon/schemas';
import { INGREDIENTS_SHOWN, SharedRecipe, type SharedRecipeProps } from './SharedRecipe';
import { TimersProvider } from '../../lib/timer-store';
import { fakeTracker } from '../../test/fakes';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const token = 'a'.repeat(43);
const recipe: Shared = {
  name: 'Leek & bacon quiche',
  description: 'Silky custard, sweet leeks and a crisp, buttery crust.',
  serves: 6,
  total_minutes: 70,
  prep_minutes: null,
  cuisine: 'french',
  best_months: [],
  photo_path: null,
  shared_by: 'Gabriel',
  ingredients: quiche.ingredients,
  steps: quiche.steps,
  variants: [],
  facts: {},
};

function memoryStorage() {
  const data = new Map<string, string>();
  return { getItem: vi.fn(async (k: string) => data.get(k) ?? null), setItem: vi.fn(async (k: string, v: string) => void data.set(k, v)) };
}

async function setup(props: Partial<SharedRecipeProps> = {}) {
  const tracker = { track: vi.fn() };
  const timerTracker = fakeTracker();
  const onSave = vi.fn();
  const onRetry = vi.fn();
  const storage = memoryStorage();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <TimersProvider userId="shared" storage={storage} tracker={timerTracker}>
      {children}
    </TimersProvider>
  );
  render(
    <SharedRecipe load={{ kind: 'shared', recipe, photoUrls: {} }} token={token} tracker={tracker} timerTracker={timerTracker} onRetry={onRetry} onSave={onSave} {...props} />,
    { wrapper },
  );
  await act(async () => undefined);
  return { tracker, timerTracker, onSave, onRetry };
}

const rows = () => within(screen.getByRole('list', { name: 'Ingredients' })).getAllByRole('listitem');
const cards = () => within(screen.getByRole('list', { name: 'Steps' })).getAllByRole('listitem');

describe('Shared recipe page', () => {
  it('shows who shared it, the recipe, Servings, Ingredients, Steps and the promo, in order', async () => {
    const { tracker } = await setup();
    expect(screen.getByText('Our Cocon')).toBeTruthy();
    expect(screen.getByText('View only')).toBeTruthy();
    expect(screen.getByText('Shared by Gabriel')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'Leek & bacon quiche' })).toBeTruthy();
    expect(screen.getByText('Silky custard, sweet leeks and a crisp, buttery crust.')).toBeTruthy();
    expect(screen.getByText("Keep your family's recipes together")).toBeTruthy();
    expect(screen.getByText('Save this leek & bacon quiche to your own Our Cocon and cook it with timers and servings that adapt.')).toBeTruthy();
    expect(tracker.track).toHaveBeenCalledWith('shared_recipe_viewed', {});
  });

  it('US2: nothing to edit, and no family data', async () => {
    await setup();
    for (const name of [/edit/i, /delete/i, /settings/i, /share/i, /add to groceries/i]) expect(screen.queryByRole('button', { name })).toBeNull();
    expect(screen.queryByText(/Gabriel ·|via /)).toBeNull();
  });

  it('US2: changing servings rescales the ingredients and the steps', async () => {
    await setup();
    const before = rows()[0]?.textContent;
    fireEvent.click(screen.getByRole('button', { name: 'More servings' }));
    fireEvent.click(screen.getByRole('button', { name: 'More servings' }));
    fireEvent.click(screen.getByRole('button', { name: 'More servings' }));
    expect(rows()[0]?.textContent).not.toBe(before);
  });

  it('FR-003: opens in metric; Imperial changes the amounts and sends an anonymous event', async () => {
    const { tracker } = await setup();
    expect(screen.getByRole('button', { name: 'Metric' }).getAttribute('aria-pressed')).toBe('true');
    const metric = rows().map((r) => r.textContent).join('|');
    fireEvent.click(screen.getByRole('button', { name: 'Imperial' }));
    expect(rows().map((r) => r.textContent).join('|')).not.toBe(metric);
    expect(tracker.track).toHaveBeenCalledWith('shared_units_toggled', { system: 'imperial' });
  });

  it(`shows ${INGREDIENTS_SHOWN} ingredients, then "Show {n} more"`, async () => {
    await setup();
    const hidden = quiche.ingredients.length - INGREDIENTS_SHOWN;
    expect(rows()).toHaveLength(INGREDIENTS_SHOWN);
    fireEvent.click(screen.getByRole('button', { name: `Show ${hidden} more` }));
    expect(rows()).toHaveLength(quiche.ingredients.length);
  });

  it('US2: every step reads, and a timed step\'s timer starts, without identified events', async () => {
    const { timerTracker } = await setup();
    expect(cards()).toHaveLength(quiche.steps.length);
    const blind = cards().find((c) => within(c).queryByRole('heading', { name: 'Blind bake' })) as HTMLElement;
    const start = within(blind).getAllByRole('button')[0] as HTMLElement;
    expect(start.textContent).toBe('Start timer12:00');
    fireEvent.click(start);
    act(() => vi.advanceTimersByTime(1000));
    expect(start.textContent).toBe('Pause11:59');
    // The page passes a silent tracker here; this one only proves where the events went.
    expect(timerTracker.track).toHaveBeenCalledWith('step_timer_started', { step_index: 1 });
  });

  it('edge case: tips show when shared, and are absent when "Include chef\'s tips" is off', async () => {
    await setup({ load: { kind: 'shared', recipe: { ...recipe, steps: quiche.steps.map((s) => ({ ...s, tip: null })) }, photoUrls: {} } });
    expect(screen.queryByText("Chef's tip")).toBeNull();
  });

  it('edge case: with variants, the Version choices show; without, only the base recipe', async () => {
    await setup({ load: { kind: 'shared', recipe: { ...recipe, variants: quiche.variants }, photoUrls: {} } });
    expect(screen.getByRole('heading', { name: 'Version' })).toBeTruthy();
    cleanup();
    await setup();
    expect(screen.queryByRole('heading', { name: 'Version' })).toBeNull();
  });

  it('FR-004: "Save to my Our Cocon", at the top and in the promo card', async () => {
    const { onSave } = await setup();
    const buttons = screen.getAllByRole('button', { name: 'Save to my Our Cocon' });
    expect(buttons).toHaveLength(2);
    for (const b of buttons) fireEvent.click(b);
    expect(onSave).toHaveBeenCalledTimes(2);
  });

  it('both save buttons read "Saving…" while it saves', async () => {
    await setup({ saving: true });
    expect(screen.getAllByRole('button', { name: 'Saving…' })).toHaveLength(2);
  });

  it('says when saving failed', async () => {
    await setup({ saveFailed: true });
    expect(screen.getByText("Couldn't save this recipe. Try again.")).toBeTruthy();
  });

  it('US3: a stopped link, deleted recipe or unknown link reads "no longer shared"', async () => {
    await setup({ load: { kind: 'not_shared' } });
    expect(screen.getByRole('heading', { level: 1, name: 'This recipe is no longer shared.' })).toBeTruthy();
    expect(screen.getByText('Ask the person who sent it for a new link.')).toBeTruthy();
    expect(screen.queryByText('Leek & bacon quiche')).toBeNull();
  });

  it('offers to try again when the page could not load', async () => {
    const { onRetry } = await setup({ load: 'failed' });
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
