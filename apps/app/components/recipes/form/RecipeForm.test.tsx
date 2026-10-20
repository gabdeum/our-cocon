// Spec 014 (design/ui/OC-EditBasics.md): the recipe form's Details section. US1 Save, US2 Advanced
// mode, US3 Cancel with changes, and the edge cases (empty name, photo upload failed).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { RecipeFormSection } from '@cocon/schemas';
import { fakeTracker, flush } from '../../../test/fakes';
import type { RecipeDetails } from '../../../lib/recipe-form';

// Native pickers aren't used: the form gets fake photo functions.
vi.mock('expo-image-picker', () => ({}));
vi.mock('expo-image-manipulator', () => ({ ImageManipulator: {}, SaveFormat: { JPEG: 'jpeg' } }));
vi.mock('expo-crypto', () => ({ randomUUID: () => 'photo-1' }));

const { RecipeForm } = await import('./RecipeForm');
type Props = Parameters<typeof RecipeForm>[0];

afterEach(cleanup);

const FAMILY = '5f3e2d1c-0b9a-4876-9543-210fedcba987';
const NEW_ID = '0b1c2d3e-4f50-4617-8899-aabbccddeeff';
const PHOTO = `${FAMILY}/${NEW_ID}/9a8b7c6d-5e4f-4321-8fed-cba987654321.jpg`;
const OLD_PHOTO = `${FAMILY}/r1/00000000-0000-4000-8000-00000000000a.jpg`;
const quiche: RecipeDetails = {
  id: 'r1',
  name: 'Leek & bacon quiche',
  description: null,
  serves: 6,
  total_minutes: 70,
  prep_minutes: null,
  cuisine: null,
  source_text: null,
  best_months: [],
  photo_path: null,
};

function fakeClient(result: { error: unknown } = { error: null }) {
  const eq = vi.fn(() => Promise.resolve(result));
  const insert = vi.fn(() => Promise.resolve(result));
  const update = vi.fn(() => ({ eq }));
  const remove = vi.fn(() => Promise.resolve({ error: null }));
  const createSignedUrls = vi.fn(() => Promise.resolve({ data: [], error: null }));
  const client = { from: vi.fn(() => ({ insert, update })), storage: { from: vi.fn(() => ({ remove, createSignedUrls })) } };
  return { client: client as unknown as Props['client'], insert, update, eq, remove };
}

function fakePhotos(upload = true) {
  return {
    pickPhoto: vi.fn(async () => ({ uri: 'file:///picked.jpg', width: 4000, height: 3000 })),
    preparePhoto: vi.fn(async () => ({ uri: 'file:///cropped.jpg', bytes: new Uint8Array([1, 2, 3]) })),
    uploadPhoto: vi.fn(async () => upload),
    removePhotos: vi.fn(async () => undefined),
    newPhotoPath: vi.fn(() => PHOTO),
  };
}

function setup(over: Partial<Props> = {}, opts: { saveError?: boolean; stored?: Record<string, string> } = {}) {
  const tracker = fakeTracker();
  const { client, insert, update, eq } = fakeClient({ error: opts.saveError ? new Error('down') : null });
  const saved = new Map(Object.entries(opts.stored ?? {}));
  const storage = { getItem: vi.fn(async (k: string) => saved.get(k) ?? null), setItem: vi.fn(async (k: string, v: string) => void saved.set(k, v)) };
  const photos = fakePhotos();
  const onClose = vi.fn();
  const onSaved = vi.fn();
  let section: RecipeFormSection = over.section ?? 'details';
  const onSectionChange = vi.fn((s: RecipeFormSection) => {
    section = s;
    view.rerender(ui());
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const ui = () => (
    <QueryClientProvider client={queryClient}>
      <RecipeForm
        recipeId={NEW_ID}
        recipe={null}
        familyId={FAMILY}
        userId="u-gabriel"
        client={client}
        tracker={tracker}
        storage={storage}
        photos={photos}
        onClose={onClose}
        onSaved={onSaved}
        {...over}
        section={section}
        onSectionChange={onSectionChange}
      />
    </QueryClientProvider>
  );
  const view = render(ui());
  return { tracker, insert, update, eq, storage, saved, photos, onClose, onSaved, onSectionChange };
}

const field = (label: string) => screen.getByLabelText(label) as HTMLInputElement;
const type = (label: string, value: string) => fireEvent.change(field(label), { target: { value } });
const save = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await flush();
};

describe('the form shell (FR-001)', () => {
  it('says New recipe, offers the four sections and "Next: Ingredients"', () => {
    setup();
    expect(screen.getByRole('heading', { name: 'New recipe' })).toBeTruthy();
    expect(screen.getAllByRole('link').map((l) => l.textContent)).toEqual(['Details', 'Ingredients', 'Steps', 'Variants']);
    expect(screen.getByRole('link', { name: 'Details' }).getAttribute('aria-current')).toBe('step');
    expect(screen.getByRole('button', { name: 'Next: Ingredients' })).toBeTruthy();
  });

  it('shows the AI hint on new recipes only (FR-005)', () => {
    setup();
    expect(screen.getByText(/Faster: tell your AI assistant/)).toBeTruthy();
    cleanup();
    setup({ recipe: quiche, recipeId: 'r1' });
    expect(screen.queryByText(/Faster: tell your AI assistant/)).toBeNull();
    expect(screen.getByRole('heading', { name: 'Edit recipe' })).toBeTruthy();
  });

  it('"Next" opens the next section, and the last one reads "Save recipe"', () => {
    const { onSectionChange } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Next: Ingredients' }));
    expect(onSectionChange).toHaveBeenCalledWith('ingredients');
    fireEvent.click(screen.getByRole('link', { name: 'Variants' }));
    expect(screen.getByRole('button', { name: 'Save recipe' })).toBeTruthy();
  });
});

describe('US1: save a family recipe', () => {
  it('saves with only a name, tracks it without its text, and opens it', async () => {
    const { insert, tracker, onSaved } = setup();
    type('Recipe name', 'Grandma’s soup');
    await save();
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ id: NEW_ID, family_id: FAMILY, name: 'Grandma’s soup', serves: 4, total_minutes: null }));
    expect(tracker.track).toHaveBeenCalledWith('recipe_created', { source: 'app', has_photo: false, advanced_mode: false });
    expect(onSaved).toHaveBeenCalled();
  });

  it('saves from any section', async () => {
    const { insert } = setup({ section: 'steps' });
    // The name is checked first: Save brings Details back with the warning.
    await save();
    expect(insert).not.toHaveBeenCalled();
    expect(screen.getByText('Give your recipe a name')).toBeTruthy();
  });

  it('edits a saved recipe and tracks the section', async () => {
    const { update, eq, tracker, onSaved } = setup({ recipe: quiche, recipeId: 'r1' });
    expect(field('Total time').value).toBe('1 h 10');
    type('Serves', '8');
    await save();
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ name: 'Leek & bacon quiche', serves: 8, total_minutes: 70 }));
    expect(eq).toHaveBeenCalledWith('id', 'r1');
    expect(tracker.track).toHaveBeenCalledWith('recipe_edited', { section: 'details' });
    expect(onSaved).toHaveBeenCalled();
  });

  it('says so when saving fails, and stays', async () => {
    const { onSaved } = setup({}, { saveError: true });
    type('Recipe name', 'Soup');
    await save();
    expect(screen.getByText("Couldn't save. Try again.")).toBeTruthy();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('counts the description up to 140', () => {
    setup();
    expect(screen.getByText('0 / 140')).toBeTruthy();
    type('Short description', 'Silky custard.');
    expect(screen.getByText('14 / 140')).toBeTruthy();
  });

  it('warns about serves and times it cannot read', async () => {
    const { insert } = setup();
    type('Recipe name', 'Soup');
    type('Serves', '80');
    type('Total time', 'a while');
    await save();
    expect(screen.getByText('Enter a number from 1 to 50')).toBeTruthy();
    expect(screen.getByText('Try “1 h 10” or “70 min”')).toBeTruthy();
    expect(insert).not.toHaveBeenCalled();
  });
});

describe('US2: advanced details', () => {
  it('shows prep time, cuisine and source inline, and remembers the choice', async () => {
    const { saved } = setup();
    await flush();
    expect(screen.queryByLabelText('Prep time')).toBeNull();
    fireEvent.click(screen.getByRole('switch', { name: 'Advanced mode' }));
    expect(screen.getByLabelText('Prep time')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cuisine: Pick one' })).toBeTruthy();
    expect(screen.getByLabelText('Source')).toBeTruthy();
    await flush();
    expect(saved.get('cocon.form.u-gabriel.advanced')).toBe('true');
  });

  it('opens on for someone who left it on', async () => {
    setup({}, { stored: { 'cocon.form.u-gabriel.advanced': 'true' } });
    await flush();
    expect(screen.getByLabelText('Prep time')).toBeTruthy();
  });

  it('picks a cuisine from the sheet; "Other" leaves it empty', async () => {
    const { insert, tracker } = setup({}, { stored: { 'cocon.form.u-gabriel.advanced': 'true' } });
    await flush();
    fireEvent.click(screen.getByRole('button', { name: 'Cuisine: Pick one' }));
    const pills = screen.getAllByRole('button').map((b) => b.textContent);
    expect(pills.indexOf('American')).toBeLessThan(pills.indexOf('West African'));
    expect(pills.indexOf('West African')).toBeLessThan(pills.indexOf('Other'));
    fireEvent.click(screen.getByRole('button', { name: 'French' }));
    await flush();
    expect(screen.getByRole('button', { name: 'Cuisine: French' })).toBeTruthy();
    type('Recipe name', 'Quiche');
    await save();
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ cuisine: 'french' }));
    expect(tracker.track).toHaveBeenCalledWith('recipe_created', expect.objectContaining({ advanced_mode: true }));
  });
});

describe("US3: don't lose my work", () => {
  it('asks before discarding changes; Keep editing keeps them', () => {
    const { onClose } = setup();
    type('Recipe name', 'Soup');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByText('Discard your changes?')).toBeTruthy();
    expect(screen.getByText("Your edits to this recipe won't be saved.")).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
    expect(onClose).not.toHaveBeenCalled();
    expect(field('Recipe name').value).toBe('Soup');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('leaves at once when nothing changed', () => {
    const { onClose } = setup({ recipe: quiche, recipeId: 'r1' });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText('Discard your changes?')).toBeNull();
    expect(onClose).toHaveBeenCalled();
  });
});

describe('photos (FR-004)', () => {
  it('crops, uploads under the recipe and saves the path', async () => {
    const { photos, insert, tracker } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Add a photo (optional)' }));
    await flush();
    expect(screen.getByRole('heading', { name: 'Fit your photo' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Use photo' }));
    await flush();
    expect(photos.preparePhoto).toHaveBeenCalledWith('file:///picked.jpg', expect.objectContaining({ width: expect.any(Number) }));
    expect(photos.uploadPhoto).toHaveBeenCalledWith(expect.anything(), PHOTO, expect.any(Uint8Array));
    expect(screen.getByRole('button', { name: 'Change photo' })).toBeTruthy();
    type('Recipe name', 'Soup');
    await save();
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ photo_path: PHOTO }));
    expect(tracker.track).toHaveBeenCalledWith('recipe_created', expect.objectContaining({ has_photo: true }));
  });

  it('edge case: a failed upload says so with Retry, and the rest still saves', async () => {
    const { photos, insert } = setup();
    photos.uploadPhoto.mockResolvedValueOnce(false);
    fireEvent.click(screen.getByRole('button', { name: 'Add a photo (optional)' }));
    await flush();
    fireEvent.click(screen.getByRole('button', { name: 'Use photo' }));
    await flush();
    expect(screen.getByText("The photo didn't upload. Try again.")).toBeTruthy();
    type('Recipe name', 'Soup');
    await save();
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ name: 'Soup', photo_path: null }));
  });

  it('Retry uploads the same photo again', async () => {
    const { photos } = setup();
    photos.uploadPhoto.mockResolvedValueOnce(false);
    fireEvent.click(screen.getByRole('button', { name: 'Add a photo (optional)' }));
    await flush();
    fireEvent.click(screen.getByRole('button', { name: 'Use photo' }));
    await flush();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await flush();
    expect(photos.uploadPhoto).toHaveBeenCalledTimes(2);
    expect(screen.queryByText("The photo didn't upload. Try again.")).toBeNull();
  });

  it('removes the old photo once a save replaced it, and an unsaved one on Cancel', async () => {
    const withPhoto = { ...quiche, photo_path: OLD_PHOTO };
    const first = setup({ recipe: withPhoto, recipeId: 'r1' });
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    await save();
    expect(first.photos.removePhotos).toHaveBeenCalledWith(expect.anything(), [OLD_PHOTO]);
    cleanup();

    const second = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Add a photo (optional)' }));
    await flush();
    fireEvent.click(screen.getByRole('button', { name: 'Use photo' }));
    await flush();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(second.photos.removePhotos).toHaveBeenCalledWith(expect.anything(), [PHOTO]);
  });

  it('says how to allow photos when access is refused', async () => {
    const { photos } = setup();
    photos.pickPhoto.mockResolvedValueOnce('denied' as never);
    fireEvent.click(screen.getByRole('button', { name: 'Add a photo (optional)' }));
    await flush();
    expect(screen.getByText("Our Cocon can't see your photos. Allow access in Settings.")).toBeTruthy();
  });
});
