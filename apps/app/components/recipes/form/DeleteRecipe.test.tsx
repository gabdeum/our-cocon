// Spec 018 US1 (design/ui/OC-Delete.md): "Delete this recipe" at the end of the edit form asks in a
// Dialog that names the recipe and its variants, then moves it to Recently deleted for everyone.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import type { RecipeFormSection } from '@cocon/schemas';
import { quiche } from '@cocon/schemas/quiche.fixture';
import { fakeTracker, flush } from '../../../test/fakes';
import type { RecipeDetails } from '../../../lib/recipe-form';

vi.mock('expo-image-picker', () => ({}));
vi.mock('expo-image-manipulator', () => ({ ImageManipulator: {}, SaveFormat: { JPEG: 'jpeg' } }));
vi.mock('expo-crypto', () => ({ randomUUID: () => 'unused' }));

const { RecipeForm } = await import('./RecipeForm');
type Props = Parameters<typeof RecipeForm>[0];

afterEach(() => {
  cleanup();
  onlineManager.setOnline(true);
});

const RECIPE = '0b1c2d3e-4f50-4617-8899-aabbccddeeff';

const details = (variants = quiche.variants): RecipeDetails => ({
  id: RECIPE,
  name: 'Leek & bacon quiche',
  description: null,
  serves: 6,
  total_minutes: 70,
  prep_minutes: null,
  cuisine: null,
  source_text: null,
  best_months: [],
  photo_path: null,
  ingredients: [],
  steps: [],
  variants,
  facts: {},
});

function setup({ recipe = details(), section = 'variants', fails = false }: { recipe?: RecipeDetails | null; section?: RecipeFormSection; fails?: boolean } = {}) {
  const tracker = fakeTracker();
  const update = vi.fn(() => ({
    eq: () => ({ is: () => ({ select: () => Promise.resolve(fails ? { data: null, error: new Error('offline') } : { data: [{ id: RECIPE }], error: null }) }) }),
  }));
  const client = {
    from: vi.fn(() => ({ update })),
    rpc: vi.fn(() => Promise.resolve({ data: [], error: null })),
    storage: { from: vi.fn(() => ({ remove: vi.fn(), createSignedUrls: vi.fn(() => Promise.resolve({ data: [], error: null })) })) },
  } as unknown as Props['client'];
  const onDeleted = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <RecipeForm
        recipeId={RECIPE}
        recipe={recipe}
        familyId="5f3e2d1c-0b9a-4876-9543-210fedcba987"
        userId="u-gabriel"
        section={section}
        onSectionChange={vi.fn()}
        client={client}
        tracker={tracker}
        storage={{ getItem: vi.fn(async () => null), setItem: vi.fn(async () => undefined) }}
        photos={{ pickPhoto: vi.fn(), preparePhoto: vi.fn(), uploadPhoto: vi.fn(), removePhotos: vi.fn(async () => undefined), newPhotoPath: vi.fn() }}
        onClose={vi.fn()}
        onSaved={vi.fn()}
        onDeleted={onDeleted}
      />
    </QueryClientProvider>,
  );
  return { tracker, update, onDeleted };
}

const deleteLink = () => screen.queryByRole('button', { name: 'Delete this recipe' });
const tapDelete = () => fireEvent.click(screen.getByRole('button', { name: 'Delete this recipe' }));

describe('Delete this recipe (OC-Delete)', () => {
  it('shows only at the end of an existing recipe, in Variants', () => {
    setup();
    expect(deleteLink()).toBeTruthy();
    cleanup();
    setup({ section: 'details' });
    expect(deleteLink()).toBeNull();
    cleanup();
    setup({ recipe: null });
    expect(deleteLink()).toBeNull();
  });

  it('asks with the recipe name and its 2 variants, then deletes it for everyone', async () => {
    const { tracker, update, onDeleted } = setup();
    tapDelete();
    const dialog = screen.getByRole('alertdialog', { name: 'Delete “Leek & bacon quiche”?' });
    expect(dialog.textContent).toContain(
      'It will disappear for the whole family, along with its 2 variants. You can bring it back from Recently deleted for 30 days.',
    );
    expect(screen.getByRole('button', { name: 'Keep it' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Delete recipe' }));
    await flush();
    expect(update).toHaveBeenCalledWith({ deleted_at: expect.any(String) });
    expect(tracker.track).toHaveBeenCalledWith('recipe_deleted', { source: 'app' });
    expect(onDeleted).toHaveBeenCalledOnce();
  });

  it('says nothing about variants when there are none', () => {
    setup({ recipe: details([]) });
    tapDelete();
    expect(screen.getByRole('alertdialog').textContent).toContain('It will disappear for the whole family. You can bring it back');
  });

  it('"Keep it" deletes nothing', () => {
    const { update } = setup();
    tapDelete();
    fireEvent.click(screen.getByRole('button', { name: 'Keep it' }));
    expect(update).not.toHaveBeenCalled();
  });

  it('says what to do when deleting fails, and stays on the form', async () => {
    const { tracker, onDeleted } = setup({ fails: true });
    tapDelete();
    fireEvent.click(screen.getByRole('button', { name: 'Delete recipe' }));
    await flush();
    expect(screen.getByText("Couldn't delete. Try again.")).toBeTruthy();
    expect(onDeleted).not.toHaveBeenCalled();
    expect(tracker.track).not.toHaveBeenCalledWith('recipe_deleted', expect.anything());
  });

  it('is off while offline', () => {
    act(() => onlineManager.setOnline(false));
    const { update } = setup();
    tapDelete();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(update).not.toHaveBeenCalled();
  });
});
