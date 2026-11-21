// Spec 018 US1 (design/ui/OC-Delete.md): "Delete recipe" at the end of the edit form's "This recipe"
// (spec 051 FR-013) moves it to Recently deleted for everyone at once, with no Dialog (2026-11-21).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { render } from '../../../test/render';
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

function setup({ recipe = details(), section = 'details', fails = false }: { recipe?: RecipeDetails | null; section?: RecipeFormSection; fails?: boolean } = {}) {
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

const deleteLink = () => screen.queryByRole('button', { name: 'Delete recipe' });
const tapDelete = () => fireEvent.click(screen.getByRole('button', { name: 'Delete recipe' }));

describe('Delete recipe (OC-Delete)', () => {
  it('shows only at the end of an existing recipe, in Details › This recipe (spec 051)', () => {
    setup();
    expect(deleteLink()).toBeTruthy();
    cleanup();
    setup({ section: 'variants' });
    expect(deleteLink()).toBeNull();
    cleanup();
    setup({ recipe: null });
    expect(deleteLink()).toBeNull();
  });

  it('deletes it for everyone at once, without asking', async () => {
    const { tracker, update, onDeleted } = setup();
    tapDelete();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    await flush();
    expect(update).toHaveBeenCalledWith({ deleted_at: expect.any(String) });
    expect(tracker.track).toHaveBeenCalledWith('recipe_deleted', { source: 'app' });
    expect(onDeleted).toHaveBeenCalledOnce();
  });


  it('says what to do when deleting fails, and stays on the form', async () => {
    const { tracker, onDeleted } = setup({ fails: true });
    tapDelete();
    await flush();
    expect(screen.getByText("Couldn't delete. Try again.")).toBeTruthy();
    expect(onDeleted).not.toHaveBeenCalled();
    expect(tracker.track).not.toHaveBeenCalledWith('recipe_deleted', expect.anything());
  });

  it('is off while offline', () => {
    act(() => onlineManager.setOnline(false));
    const { update } = setup();
    tapDelete();
    expect(update).not.toHaveBeenCalled();
  });
});
