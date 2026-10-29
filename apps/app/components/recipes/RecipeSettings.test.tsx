// Specs 017, 027 and 032-later L25 (design/ui/OC-RecipeSettings.md): recipe settings' "Edit recipe"
// row, the recipe's own cooking settings, and the Variants list.
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ToastProvider } from '../../lib/toast';
import { DEFAULT_FAMILY_SETTINGS, type FamilySettings, type RecipeOverrides, type RecipeOverridesUpdate } from '@cocon/schemas';
import { quicheIds } from '@cocon/schemas/quiche.fixture';
import { flush } from '../../test/fakes';
import { quicheDetail } from '../../test/quiche-detail';
import { RecipeSettings, type RecipeSettingsProps } from './RecipeSettings';

afterEach(cleanup);

function setup(props: Partial<RecipeSettingsProps> = {}) {
  const onEditRecipe = vi.fn();
  const onEditVariants = vi.fn();
  const onBack = vi.fn();
  render(
    <RecipeSettings
      recipe={quicheDetail}
      onBack={onBack}
      onEditRecipe={onEditRecipe}
      onEditVariants={onEditVariants}
      defaults={DEFAULT_FAMILY_SETTINGS}
      onChangeSettings={vi.fn().mockResolvedValue('saved')}
      {...props}
    />,
    { wrapper: ToastProvider },
  );
  return { onEditRecipe, onEditVariants, onBack };
}

/** The screen over a recipe whose overrides change as they're saved (the route's optimistic write). */
function settingsScreen(defaults: FamilySettings, result: 'saved' | 'failed' = 'saved', readOnly = false) {
  const saved: RecipeOverridesUpdate[] = [];
  function Screen() {
    const [overrides, setOverrides] = useState<RecipeOverrides>(quicheDetail.overrides);
    return (
      <RecipeSettings
        recipe={{ ...quicheDetail, overrides }}
        onBack={vi.fn()}
        onEditRecipe={vi.fn()}
        onEditVariants={vi.fn()}
        defaults={defaults}
        readOnly={readOnly}
        onChangeSettings={async (change) => {
          saved.push(change);
          if (result === 'saved') setOverrides((o) => ({ ...o, ...change }));
          return result;
        }}
      />
    );
  }
  render(<Screen />, { wrapper: ToastProvider });
  return saved;
}

const toggle = async (name: string) => {
  await act(async () => {
    fireEvent.click(screen.getByRole('switch', { name }));
  });
};

describe('Recipe settings: cooking settings (spec 027)', () => {
  it('shows each setting as the family has it, "Same as default", and units on Default', () => {
    settingsScreen({ ...DEFAULT_FAMILY_SETTINGS, has_thermometer: false });
    expect(screen.getByRole('switch', { name: 'Keep screen on' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('switch', { name: "I'll use a kitchen scale" }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('switch', { name: 'Thermometer checks' }).getAttribute('aria-checked')).toBe('false');
    expect(screen.getAllByText('Same as default')).toHaveLength(2);
    expect(screen.getByText('Shows “100 g” instead of “about 1 cup”')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Default' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('US2: turning "Thermometer checks" on shows "Changed for this recipe · Reset"; Reset puts it back', async () => {
    const saved = settingsScreen({ ...DEFAULT_FAMILY_SETTINGS, has_thermometer: false });
    await toggle('Thermometer checks');
    expect(saved).toEqual([{ has_thermometer: true }]);
    expect(screen.getByRole('switch', { name: 'Thermometer checks' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText(/Changed for this recipe/)).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    });
    expect(saved).toEqual([{ has_thermometer: true }, { has_thermometer: null }]);
    expect(screen.getByRole('switch', { name: 'Thermometer checks' }).getAttribute('aria-checked')).toBe('false');
    expect(screen.queryByText(/Changed for this recipe/)).toBeNull();
  });

  it('US3: Units picks Metric or Imperial for this recipe, and Default follows the family', async () => {
    const saved = settingsScreen(DEFAULT_FAMILY_SETTINGS);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Imperial' }));
    });
    expect(screen.getByRole('button', { name: 'Imperial' }).getAttribute('aria-pressed')).toBe('true');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Default' }));
    });
    expect(saved).toEqual([{ units: 'imperial' }, { units: null }]);
  });

  it('a failed save says so', async () => {
    settingsScreen(DEFAULT_FAMILY_SETTINGS, 'failed');
    await toggle('Keep screen on');
    expect(screen.getByText("Couldn't save. Try again.")).toBeTruthy();
    expect(screen.getByRole('switch', { name: 'Keep screen on' }).getAttribute('aria-checked')).toBe('true');
  });

  it('offline, the settings show but cannot change', async () => {
    const saved = settingsScreen(DEFAULT_FAMILY_SETTINGS, 'saved', true);
    await toggle('Keep screen on');
    expect(saved).toEqual([]);
  });
});

describe('Recipe settings (OC-RecipeSettings › Layout)', () => {
  it('reads like the screen: back to the recipe, title, lead, Edit recipe, Variants', () => {
    const { onBack } = setup();
    fireEvent.click(screen.getByRole('link', { name: 'Leek & bacon quiche' }));
    expect(onBack).toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Recipe settings' })).toBeTruthy();
    expect(screen.getByText('These only change this recipe. Your family defaults are in Settings.')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Variants' })).toBeTruthy();
    expect(screen.getByText('Variants are versions of this recipe. They swap ingredients or add steps without making a copy.')).toBeTruthy();
  });

  it('L25: "Edit recipe" opens the form at Details', () => {
    const { onEditRecipe } = setup();
    fireEvent.click(screen.getByRole('link', { name: 'Edit recipe' }));
    expect(onEditRecipe).toHaveBeenCalled();
  });

  it('one card per variant, with its one-line summary; a card opens that variant', () => {
    const { onEditVariants } = setup();
    const veg = screen.getByRole('link', { name: 'Vegetarian. Replaces bacon lardons with 250 g sliced mushrooms. Tap to edit.' });
    expect(screen.getByRole('link', { name: /^Make my own dough\. Replaces shortcrust pastry with 3 ingredients · adds step “Make the dough” · changes step 1/ })).toBeTruthy();
    fireEvent.click(veg);
    expect(onEditVariants).toHaveBeenCalledWith(quicheIds.vegetarian);
  });

  it('"Edit" opens Variants; "Add a variant" starts a new one', () => {
    const { onEditVariants } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Edit variants' }));
    expect(onEditVariants).toHaveBeenLastCalledWith();
    fireEvent.click(screen.getByRole('button', { name: 'Add a variant' }));
    expect(onEditVariants).toHaveBeenLastCalledWith('new');
  });

  it('loading, and a recipe that could not load', () => {
    setup({ recipe: undefined });
    expect(screen.getByRole('progressbar', { name: 'Loading recipe settings' })).toBeTruthy();
    cleanup();
    const onRetry = vi.fn();
    setup({ recipe: null, failed: true, onRetry });
    expect(screen.getByRole('heading', { name: "We couldn't open this recipe." })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalled();
  });
});

// Spec 018: the same "Delete this recipe" as the edit form, at the bottom (OC-Delete).
describe('Delete this recipe in recipe settings', () => {
  it('asks with the recipe name and its 2 variants, then deletes it', async () => {
    const onDelete = vi.fn(async () => undefined);
    setup({ onDelete });
    fireEvent.click(screen.getByRole('button', { name: 'Delete this recipe' }));
    expect(screen.getByRole('alertdialog', { name: 'Delete “Leek & bacon quiche”?' }).textContent).toContain('along with its 2 variants');
    fireEvent.click(screen.getByRole('button', { name: 'Delete recipe' }));
    await flush();
    expect(onDelete).toHaveBeenCalledOnce();
  });

  it('says what to do when deleting fails', async () => {
    setup({ onDelete: vi.fn(() => Promise.reject(new Error('offline'))) });
    fireEvent.click(screen.getByRole('button', { name: 'Delete this recipe' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete recipe' }));
    await flush();
    expect(screen.getByText("Couldn't delete. Try again.")).toBeTruthy();
  });
});
