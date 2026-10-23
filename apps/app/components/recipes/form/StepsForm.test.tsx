// Spec 016 (design/ui/OC-EditSteps.md): the recipe form's Steps section. US1 ingredient chips by
// "@" and "+ Leeks" with a live Preview, US2 a step timer, US3 a temperature check, the edge cases
// (one step open, badges, a missing ingredient), Save's checks, reorder and typed temperatures.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { IngredientFacts, RecipeFormSection } from '@cocon/schemas';
import { fakeTracker, flush } from '../../../test/fakes';
import type { RecipeDetails } from '../../../lib/recipe-form';
import type { SavedStep } from '../../../lib/recipe-steps';

vi.mock('expo-image-picker', () => ({}));
vi.mock('expo-image-manipulator', () => ({ ImageManipulator: {}, SaveFormat: { JPEG: 'jpeg' } }));
vi.mock('expo-crypto', () => ({ randomUUID: () => 'unused' }));

const { RecipeForm } = await import('./RecipeForm');
type Props = Parameters<typeof RecipeForm>[0];

afterEach(cleanup);

const FAMILY = '5f3e2d1c-0b9a-4876-9543-210fedcba987';
const RECIPE = '0b1c2d3e-4f50-4617-8899-aabbccddeeff';
const BUTTER = 'c0c01000-0000-4000-8000-000000000002';
const LEEKS = 'c0c01000-0000-4000-8000-000000000003';
const EGGS = 'c0c01000-0000-4000-8000-000000000004';
const GONE = 'c0c01000-0000-4000-8000-0000000000ff';

const leek: IngredientFacts = {
  catalog_key: 'leek',
  family_ingredient_id: null,
  name: 'Leek',
  plural: 'Leeks',
  aisle: 'produce',
  density_g_per_ml: null,
  size_small_g: 100,
  size_medium_g: 150,
  size_large_g: 220,
  default_size: 'medium',
  noun_singular: null,
  noun_plural: null,
  whole_only: false,
  diet: [],
};

const saved = (position: number, patch: Partial<SavedStep>): SavedStep => ({
  id: `00000000-0000-4000-8000-0000000005${String(position).padStart(2, '0')}`,
  position,
  name: null,
  body: 'Stir.',
  timer_seconds: null,
  timer_label: null,
  temp_check_c: null,
  temp_check_text: null,
  tip: null,
  photo_path: null,
  ...patch,
});

const quiche: RecipeDetails = {
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
  ingredients: [
    { id: BUTTER, position: 0, name: 'Butter', quantity: 20, unit: 'g' },
    { id: LEEKS, position: 1, name: 'Leeks', quantity: 2, unit: 'piece', weight_per_piece_g: 150, catalog_key: 'leek' },
    { id: EGGS, position: 2, name: 'Eggs', quantity: 3, unit: 'piece' },
  ],
  steps: [
    saved(0, { name: 'Preheat and line', body: 'Line the tin.', tip: 'Use baking paper.' }),
    saved(1, { name: 'Blind bake', body: 'Bake at {temp:180}.', timer_seconds: 720 }),
    saved(2, { name: 'Cook the filling', body: `In a large pan, melt {ing:${BUTTER}} over medium heat.` }),
  ],
  facts: { leek },
};

function fakeClient(stepsError = false) {
  const eq = vi.fn(() => Promise.resolve({ error: null }));
  const update = vi.fn(() => ({ eq }));
  const insert = vi.fn(() => Promise.resolve({ error: null }));
  const rpc = vi.fn((name: string) =>
    Promise.resolve({ data: name === 'match_ingredients' ? [] : null, error: name === 'save_recipe_steps' && stepsError ? { message: 'no' } : null }),
  );
  const client = {
    from: vi.fn(() => ({ insert, update, upsert: vi.fn(() => Promise.resolve({ error: null })) })),
    rpc,
    storage: { from: vi.fn(() => ({ remove: vi.fn(), createSignedUrls: vi.fn(() => Promise.resolve({ data: [], error: null })) })) },
  };
  return { client: client as unknown as Props['client'], rpc };
}

function setup(over: Partial<Props> = {}, opts: { stepsError?: boolean } = {}) {
  const tracker = fakeTracker();
  const { client, rpc } = fakeClient(opts.stepsError);
  const storage = { getItem: vi.fn(async () => null), setItem: vi.fn(async () => undefined) };
  const onSaved = vi.fn();
  let n = 0;
  const newId = () => `00000000-0000-4000-8000-${String((n += 1)).padStart(12, '0')}`;
  let section: RecipeFormSection = over.section ?? 'steps';
  const onSectionChange = vi.fn((next: RecipeFormSection) => {
    section = next;
    view.rerender(ui());
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const ui = () => (
    <QueryClientProvider client={queryClient}>
      <RecipeForm
        recipeId={RECIPE}
        recipe={quiche}
        familyId={FAMILY}
        userId="u-gabriel"
        client={client}
        tracker={tracker}
        storage={storage}
        photos={{ pickPhoto: vi.fn(), preparePhoto: vi.fn(), uploadPhoto: vi.fn(), removePhotos: vi.fn(async () => undefined), newPhotoPath: vi.fn() }}
        onClose={vi.fn()}
        onSaved={onSaved}
        newId={newId}
        {...over}
        section={section}
        onSectionChange={onSectionChange}
      />
    </QueryClientProvider>
  );
  const view = render(ui());
  return { tracker, rpc, onSaved };
}

const openStep = (n: number, name: string) => fireEvent.click(screen.getByRole('button', { name: `Step ${n}, ${name}. Tap to edit.` }));
const editor = () => screen.getByRole('textbox', { name: 'Instructions' }) as HTMLTextAreaElement;
const field = (name: string) => screen.getByRole('textbox', { name }) as HTMLInputElement;
const type = (el: HTMLElement, value: string) => fireEvent.change(el, { target: { value } });
const toggle = (name: string) => fireEvent.click(screen.getByRole('button', { name }));
const save = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await flush();
};
const savedSteps = (rpc: ReturnType<typeof vi.fn>) => {
  const call = rpc.mock.calls.find((c) => c[0] === 'save_recipe_steps');
  return (call?.[1] as { p_steps: Record<string, unknown>[] } | undefined)?.p_steps;
};
const preview = () => screen.getByRole('heading', { name: 'Preview' }).parentElement?.textContent ?? '';

describe('US1: amounts that scale by themselves', () => {
  it('"@le" suggests Leeks; picking it puts a Leeks chip in, and the Preview reads "Add 2 leeks (300 g)"', async () => {
    const { rpc } = setup();
    openStep(3, 'Cook the filling');
    expect(editor().value).toBe('In a large pan, melt Butter over medium heat.');
    fireEvent.focus(editor());
    type(editor(), 'In a large pan, melt Butter over medium heat. Add @le');
    const list = screen.getByRole('list', { name: 'Ingredient suggestions' });
    fireEvent.click(within(list).getByText('Leeks'));
    expect(editor().value).toBe('In a large pan, melt Butter over medium heat. Add Leeks ');
    expect(preview()).toContain('melt 20 g butter over medium heat. Add 2 leeks (300 g)');
    await save();
    expect(savedSteps(rpc)?.[2]?.body).toBe(`In a large pan, melt {ing:${BUTTER}} over medium heat. Add {ing:${LEEKS}}`);
  });

  it('"@" leaves out ingredients a step already mentions (each goes in one step)', () => {
    setup();
    openStep(3, 'Cook the filling');
    fireEvent.focus(editor());
    type(editor(), 'In a large pan, melt Butter over medium heat. Add @bu');
    expect(screen.queryByRole('list', { name: 'Ingredient suggestions' })).toBeNull();
  });

  it('"+ Eggs" offers ingredients no step uses yet, and inserts one', () => {
    setup();
    openStep(3, 'Cook the filling');
    expect(screen.queryByRole('button', { name: 'Insert Butter' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Insert Eggs' }));
    expect(editor().value).toBe('In a large pan, melt Butter over medium heat. Eggs ');
    expect(screen.queryByRole('button', { name: 'Insert Eggs' })).toBeNull();
  });

  it('a chip is never partly edited: deleting into it removes it whole', () => {
    setup();
    openStep(3, 'Cook the filling');
    type(editor(), 'In a large pan, melt Butte over medium heat.');
    expect(editor().value).toBe('In a large pan, melt  over medium heat.');
  });
});

describe('US2: a timer on a step', () => {
  it('shows minutes and a label that starts as the step name; the closed card shows "8 min"', async () => {
    const { rpc } = setup();
    openStep(3, 'Cook the filling');
    toggle('Timer');
    expect(screen.getByRole('button', { name: 'Timer' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('Timer ✓')).toBeTruthy();
    expect(field('Timer label').value).toBe('Cook the filling');
    type(field('Timer'), '8');
    openStep(1, 'Preheat and line');
    expect(screen.getByRole('button', { name: 'Step 3, Cook the filling. Tap to edit.' }).textContent).toContain('8 min');
    await save();
    expect(savedSteps(rpc)?.[2]).toEqual(expect.objectContaining({ timer_seconds: 480, timer_label: 'Cook the filling' }));
  });

  it('warns when the timer is not a number', async () => {
    const { rpc } = setup();
    openStep(3, 'Cook the filling');
    toggle('Timer');
    type(field('Timer'), 'a while');
    await save();
    expect(screen.getByText('Enter minutes, like 8 or 1 h 30')).toBeTruthy();
    expect(savedSteps(rpc)).toBeUndefined();
  });
});

describe('US3: a temperature check', () => {
  it('71 °C and "center reaches" preview as "center reaches 71 °C (160 °F)"', () => {
    setup();
    openStep(3, 'Cook the filling');
    toggle('Temperature check');
    type(field('Temperature'), '71');
    type(field('What to check'), 'center reaches');
    expect(screen.getByText('Temperature check: center reaches 71 °C (160 °F)')).toBeTruthy();
  });

  it('takes °F and stores °C (FR-005); {temp} places the reading (032-later L15)', async () => {
    const { rpc } = setup();
    openStep(3, 'Cook the filling');
    toggle('Temperature check');
    fireEvent.click(screen.getByRole('button', { name: '°F' }));
    type(field('Temperature'), '160');
    type(field('What to check'), 'the center should reach {temp} and barely wobble');
    expect(screen.getByText('Temperature check: the center should reach 71 °C (160 °F) and barely wobble')).toBeTruthy();
    await save();
    expect(savedSteps(rpc)?.[2]).toEqual(expect.objectContaining({ temp_check_c: 71.1, temp_check_text: 'the center should reach {temp} and barely wobble' }));
  });
});

describe('the temperature check, more', () => {
  it('warns when the temperature is not a number', async () => {
    const { rpc } = setup();
    openStep(3, 'Cook the filling');
    toggle('Temperature check');
    type(field('Temperature'), 'hot');
    await save();
    expect(screen.getByText('Enter a temperature, like 71')).toBeTruthy();
    expect(savedSteps(rpc)).toBeUndefined();
  });

  it('shows on the closed card as a pill, like the other add-ons', () => {
    const path = `${FAMILY}/${RECIPE}/00000000-0000-4000-8000-0000000000c4.jpg`;
    setup({
      recipe: { ...quiche, steps: [saved(0, { name: 'Bake', timer_seconds: 2100, temp_check_c: 71, temp_check_text: 'center reaches', tip: 'Wait.', photo_path: path }), saved(1, { name: 'Rest' })] },
    });
    const card = screen.getByRole('button', { name: 'Step 1, Bake. Tap to edit.' });
    expect(card.textContent).toBe('1Bake35 minTemp checkTipPhoto');
  });
});

describe('edge cases', () => {
  it('opens one step at a time; the others show number, name and badges', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Step 1, Preheat and line. Tap to edit.' }).textContent).toContain('Tip');
    expect(screen.getByRole('button', { name: 'Step 2, Blind bake. Tap to edit.' }).textContent).toContain('12 min');
    openStep(1, 'Preheat and line');
    expect(screen.getAllByRole('textbox', { name: 'Step name' })).toHaveLength(1);
    openStep(2, 'Blind bake');
    expect(screen.getAllByRole('textbox', { name: 'Step name' })).toHaveLength(1);
    expect(field('Step name').value).toBe('Blind bake');
  });

  it('a chip whose ingredient is gone shows "Missing ingredient", with what to do', () => {
    setup({ recipe: { ...quiche, steps: [saved(0, { name: 'Top', body: `Top with {ing:${GONE}}.` })] } });
    openStep(1, 'Top');
    expect(editor().value).toBe('Top with Missing ingredient.');
    expect(screen.getByText('This ingredient was removed. Delete the chip or add it back.')).toBeTruthy();
  });

  it('removing an ingredient takes it out of the steps too', async () => {
    const { rpc } = setup({ section: 'ingredients' });
    fireEvent.click(screen.getByRole('button', { name: 'Remove Butter' }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Remove' }));
    await save();
    expect(savedSteps(rpc)?.[2]?.body).toBe('In a large pan, melt over medium heat.');
  });
});

describe('Save', () => {
  it('a step with no instructions opens with "Add instructions or remove this step"', async () => {
    const { rpc } = setup();
    openStep(3, 'Cook the filling');
    type(editor(), '');
    openStep(1, 'Preheat and line');
    await save();
    expect(field('Step name').value).toBe('Cook the filling');
    expect(screen.getByText('Add instructions or remove this step')).toBeTruthy();
    expect(rpc.mock.calls.some((c) => c[0] === 'save_recipe_steps')).toBe(false);
  });

  it('turns typed temperatures into chips (FR-006), and one can be a thermometer reading', async () => {
    const { rpc } = setup();
    openStep(3, 'Cook the filling');
    type(editor(), 'Cook the sugar to 115C, then bake at 350°F.');
    fireEvent.blur(editor());
    expect(editor().value).toBe('Cook the sugar to 115 °C (250 °F), then bake at 177 °C (350 °F).');
    const choices = screen.getAllByRole('button', { name: 'Thermometer' });
    fireEvent.click(choices[0] as HTMLElement);
    expect(editor().value).toBe('Cook the sugar to 115 °C (240 °F), then bake at 177 °C (350 °F).');
    await save();
    expect(savedSteps(rpc)?.[2]?.body).toBe('Cook the sugar to {temp:115:food}, then bake at {temp:176.7}.');
  });

  it('adds, reorders and removes steps, and tracks new ones without their text', async () => {
    const { rpc, tracker } = setup();
    fireEvent.click(screen.getByRole('button', { name: '+ Add a step' }));
    type(field('Step name'), 'Rest');
    type(editor(), 'Rest 10 minutes.');
    toggle("Chef's tip");
    type(screen.getByRole('textbox', { name: "Chef's tip" }), 'It sets as it cools.');
    fireEvent.keyDown(screen.getAllByRole('button', { name: 'Drag to reorder' })[0] as HTMLElement, { key: 'ArrowDown' });
    openStep(1, 'Blind bake');
    fireEvent.click(screen.getByRole('button', { name: 'Remove step' }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Remove' }));
    await save();
    expect(savedSteps(rpc)?.map((r) => r.name)).toEqual(['Preheat and line', 'Cook the filling', 'Rest']);
    expect(tracker.track).toHaveBeenCalledWith('recipe_step_added', { has_timer: false, has_temperature: false, has_tip: true });
    expect(tracker.track).toHaveBeenCalledTimes(2); // that and recipe_edited
  });

  it('"Keep it" keeps a step; an empty step goes without asking', () => {
    setup();
    openStep(1, 'Preheat and line');
    fireEvent.click(screen.getByRole('button', { name: 'Remove step' }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Keep it' }));
    expect(screen.getByRole('textbox', { name: 'Step name' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '+ Add a step' }));
    expect(screen.getAllByRole('button', { name: /^Step \d/ })).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: 'Remove step' }));
    // Gone straight away, with no question: the three saved steps are left, all closed.
    expect(screen.queryByRole('textbox', { name: 'Step name' })).toBeNull();
    expect(screen.getAllByRole('button', { name: /^Step \d/ })).toHaveLength(3);
  });

  it('a step photo is stored under the recipe and saved with the step', async () => {
    const uploadPhoto = vi.fn(async () => true);
    const path = `${FAMILY}/${RECIPE}/00000000-0000-4000-8000-0000000000c1.jpg`;
    const photos = {
      pickPhoto: vi.fn(async () => ({ uri: 'file:///leeks.jpg', width: 1300, height: 800 })),
      preparePhoto: vi.fn(async () => ({ uri: 'file:///cropped.jpg', bytes: new Uint8Array([1]) })),
      uploadPhoto,
      removePhotos: vi.fn(async () => undefined),
      newPhotoPath: vi.fn(() => path),
    };
    const { rpc } = setup({ photos: photos as unknown as Props['photos'] });
    openStep(3, 'Cook the filling');
    toggle('Photo');
    fireEvent.click(screen.getByRole('button', { name: 'Add a photo (optional)' }));
    await flush();
    fireEvent.click(screen.getByRole('button', { name: 'Use photo' }));
    await flush();
    expect(uploadPhoto).toHaveBeenCalledWith(expect.anything(), path, expect.any(Uint8Array));
    expect(screen.getByLabelText('Photo for step 3')).toBeTruthy();
    await save();
    expect(savedSteps(rpc)?.[2]).toEqual(expect.objectContaining({ photo_path: path }));
  });

  it('discarding after a save that failed at the steps keeps the header photo the recipe now points to', async () => {
    const path = `${FAMILY}/${RECIPE}/00000000-0000-4000-8000-0000000000c2.jpg`;
    const removePhotos = vi.fn(async () => undefined);
    const photos = {
      pickPhoto: vi.fn(async () => ({ uri: 'file:///quiche.jpg', width: 1300, height: 800 })),
      preparePhoto: vi.fn(async () => ({ uri: 'file:///cropped.jpg', bytes: new Uint8Array([1]) })),
      uploadPhoto: vi.fn(async () => true),
      removePhotos,
      newPhotoPath: vi.fn(() => path),
    };
    const { onSaved } = setup({ section: 'details', photos: photos as unknown as Props['photos'], onClose: vi.fn() }, { stepsError: true });
    fireEvent.click(screen.getByRole('button', { name: 'Add a photo (optional)' }));
    await flush();
    fireEvent.click(screen.getByRole('button', { name: 'Use photo' }));
    await flush();
    fireEvent.click(screen.getByRole('link', { name: 'Steps' }));
    openStep(3, 'Cook the filling');
    toggle("Chef's tip");
    type(screen.getByRole('textbox', { name: "Chef's tip" }), 'Low heat.');
    await save();
    expect(onSaved).not.toHaveBeenCalled();
    expect(screen.getByText("Couldn't save. Try again.")).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Discard' }));
    const removed = removePhotos.mock.calls.flatMap((c) => (c as unknown as [unknown, string[]])[1]);
    expect(removed).not.toContain(path);
  });

  it('never removes a photo a variant uses', async () => {
    const shared = `${FAMILY}/${RECIPE}/00000000-0000-4000-8000-0000000000c3.jpg`;
    const removePhotos = vi.fn(async () => undefined);
    const photos = { pickPhoto: vi.fn(), preparePhoto: vi.fn(), uploadPhoto: vi.fn(), removePhotos, newPhotoPath: vi.fn() };
    setup({
      photos: photos as unknown as Props['photos'],
      recipe: { ...quiche, steps: [saved(0, { name: 'Plate', photo_path: shared }), saved(1, { name: 'Rest' })], variantPhotos: [shared] },
    });
    openStep(1, 'Plate');
    toggle('Photo'); // off: the step no longer uses it
    await save();
    const removed = removePhotos.mock.calls.flatMap((c) => (c as unknown as [unknown, string[]])[1]);
    expect(removed).not.toContain(shared);
  });

  it('a new recipe starts with one open, empty step that Save drops when left empty', async () => {
    const { rpc } = setup({ recipe: null });
    expect(editor().value).toBe('');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await flush();
    // The name is checked first; nothing about the empty step.
    expect(screen.queryByText('Add instructions or remove this step')).toBeNull();
    expect(rpc.mock.calls.some((c) => c[0] === 'save_recipe_steps')).toBe(false);
  });
});
