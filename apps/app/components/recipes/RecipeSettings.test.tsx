// Specs 017 and 032-later L25 (design/ui/OC-RecipeSettings.md): recipe settings' "Edit recipe" row
// and Variants list. The switches come with spec 027.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { quicheIds } from '@cocon/schemas/quiche.fixture';
import { flush } from '../../test/fakes';
import { quicheDetail } from '../../test/quiche-detail';
import { RecipeSettings, type RecipeSettingsProps } from './RecipeSettings';

afterEach(cleanup);

function setup(props: Partial<RecipeSettingsProps> = {}) {
  const onEditRecipe = vi.fn();
  const onEditVariants = vi.fn();
  const onBack = vi.fn();
  render(<RecipeSettings recipe={quicheDetail} onBack={onBack} onEditRecipe={onEditRecipe} onEditVariants={onEditVariants} {...props} />);
  return { onEditRecipe, onEditVariants, onBack };
}

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
