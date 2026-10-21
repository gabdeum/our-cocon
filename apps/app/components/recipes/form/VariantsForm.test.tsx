// Spec 017 (design/ui/OC-EditVariants.md): the recipe form's Variants section. US1 a vegetarian
// version, US2 an optional extra with an added step, the edge cases (two variants changing the same
// ingredient, a change pointing at a removed ingredient), Save's checks and catalog matching.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { IngredientFacts, RecipeFormSection, RecipeVariant } from '@cocon/schemas';
import { quiche, quicheIds } from '@cocon/schemas/quiche.fixture';
import { fakeTracker, flush } from '../../../test/fakes';
import type { RecipeDetails } from '../../../lib/recipe-form';

vi.mock('expo-image-picker', () => ({}));
vi.mock('expo-image-manipulator', () => ({ ImageManipulator: {}, SaveFormat: { JPEG: 'jpeg' } }));
vi.mock('expo-crypto', () => ({ randomUUID: () => 'unused' }));

const { RecipeForm } = await import('./RecipeForm');
type Props = Parameters<typeof RecipeForm>[0];

afterEach(cleanup);

const FAMILY = '5f3e2d1c-0b9a-4876-9543-210fedcba987';
const RECIPE = '0b1c2d3e-4f50-4617-8899-aabbccddeeff';

const flour: IngredientFacts = {
  catalog_key: 'flour',
  family_ingredient_id: null,
  name: 'Flour',
  plural: 'Flour',
  aisle: 'spices_baking',
  density_g_per_ml: 0.53,
  size_small_g: null,
  size_medium_g: null,
  size_large_g: null,
  default_size: null,
  noun_singular: null,
  noun_plural: null,
  whole_only: false,
  diet: [],
};

const recipe = (variants: RecipeVariant[] = []): RecipeDetails => ({
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
  ingredients: quiche.ingredients.map((i, position) => ({ ...i, position })),
  steps: quiche.steps.map((s, position) => ({
    id: s.id,
    position,
    name: s.name ?? null,
    body: s.body,
    timer_seconds: s.timer_seconds ?? null,
    timer_label: s.timer_label ?? null,
    temp_check_c: s.temp_check_c ?? null,
    temp_check_text: s.temp_check_text ?? null,
    tip: s.tip ?? null,
    photo_path: null,
  })),
  variants,
  facts: {},
});

function setup(over: Partial<Props> = {}, data = recipe()) {
  const tracker = fakeTracker();
  const rpc = vi.fn((name: string, args: Record<string, unknown>) => {
    if (name === 'match_ingredients') {
      const queries = args.queries as { full: string; core: string }[];
      return Promise.resolve({ data: queries.map((q, idx) => ({ idx, ...(q.core === 'flour' ? { how: 'exact', ...flour } : { how: 'none' }) })), error: null });
    }
    if (name === 'suggest_ingredients') return Promise.resolve({ data: [], error: null });
    return Promise.resolve({ data: null, error: null });
  });
  const eq = vi.fn(() => Promise.resolve({ error: null }));
  const client = {
    from: vi.fn(() => ({ insert: vi.fn(() => Promise.resolve({ error: null })), update: vi.fn(() => ({ eq })), upsert: vi.fn(() => Promise.resolve({ error: null })) })),
    rpc,
    storage: { from: vi.fn(() => ({ remove: vi.fn(), createSignedUrls: vi.fn(() => Promise.resolve({ data: [], error: null })) })) },
  } as unknown as Props['client'];
  const storage = { getItem: vi.fn(async () => null), setItem: vi.fn(async () => undefined) };
  const onSaved = vi.fn();
  const onClose = vi.fn();
  let n = 0;
  const newId = () => `00000000-0000-4000-8000-${String((n += 1)).padStart(12, '0')}`;
  let section: RecipeFormSection = over.section ?? 'variants';
  const onSectionChange = vi.fn((next: RecipeFormSection) => {
    section = next;
    view.rerender(ui());
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const photos = { pickPhoto: vi.fn(), preparePhoto: vi.fn(), uploadPhoto: vi.fn(), removePhotos: vi.fn(async () => undefined), newPhotoPath: vi.fn() };
  const ui = () => (
    <QueryClientProvider client={queryClient}>
      <RecipeForm
        recipeId={RECIPE}
        recipe={data}
        familyId={FAMILY}
        userId="u-gabriel"
        client={client}
        tracker={tracker}
        storage={storage}
        photos={photos}
        onClose={onClose}
        onSaved={onSaved}
        newId={newId}
        {...over}
        section={section}
        onSectionChange={onSectionChange}
      />
    </QueryClientProvider>
  );
  const view = render(ui());
  return { tracker, rpc, onSaved, onClose, goTo: onSectionChange, removePhotos: (over.photos ?? photos).removePhotos as ReturnType<typeof vi.fn> };
}

const tap = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));
/** Collapsed variants and change blocks are cards: the whole card is the tap target. */
const card = (name: string) => screen.getByRole('link', { name });
const type = (el: HTMLElement, value: string) => fireEvent.change(el, { target: { value } });
const last = (label: string) => screen.getAllByLabelText(label).at(-1) as HTMLInputElement;
const pickUnit = (unit: string) => {
  fireEvent.click(screen.getAllByRole('button', { name: /^Unit: / }).at(-1) as HTMLElement);
  fireEvent.click(within(screen.getByRole('dialog', { name: 'Unit' })).getByRole('button', { name: unit }));
};
const pick = (group: string, name: string) => fireEvent.click(within(screen.getByRole('radiogroup', { name: group })).getByRole('radio', { name }));
const save = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await flush();
};
const savedVariants = (rpc: ReturnType<typeof vi.fn>) => {
  const call = rpc.mock.calls.find((c) => c[0] === 'save_recipe_variants');
  return (call?.[1] as { p_variants: Record<string, unknown>[] } | undefined)?.p_variants;
};

describe('the section (OC-EditVariants › Layout)', () => {
  it('reads like the screen: title, lead, a collapsed row per variant, "+ New variant", "Save recipe"', () => {
    setup({}, recipe(quiche.variants));
    expect(screen.getByRole('heading', { name: 'Variants (optional)' })).toBeTruthy();
    expect(screen.getByText('A variant changes a few things in the recipe. People pick it with one tap on the recipe page.')).toBeTruthy();
    expect(card('Vegetarian, 1 change. Tap to edit.')).toBeTruthy();
    expect(card('Make my own dough, 3 changes. Tap to edit.')).toBeTruthy();
    expect(screen.getByRole('button', { name: '+ New variant' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save recipe' })).toBeTruthy();
  });

  it('an open variant shows its name, "Shown as", its changes in plain words (FR-005) and the six change buttons', () => {
    setup({ openVariant: quicheIds.dough }, recipe(quiche.variants));
    expect(last('Variant name').value).toBe('Make my own dough');
    expect(screen.getByRole('button', { name: 'An option (on/off)' }).getAttribute('aria-pressed')).toBe('true');
    const swap = card('Replace ingredient. Tap to edit.');
    expect(swap.textContent).toBe('Replace ingredientShortcrust pastry → 200 g flour, 100 g cubed cold butter, 50 ml ice water');
    expect(card('Add step · before step 1. Tap to edit.').textContent).toContain('Make the dough · 30 min timer');
    for (const label of ['Swap ingredient', 'Add ingredient', 'Remove ingredient', 'Add a step', 'Change a step', 'Remove a step']) expect(screen.getByRole('button', { name: label })).toBeTruthy();
  });
});

describe('US1: a vegetarian version', () => {
  it('"Vegetarian" swapping Bacon lardons for 250 g sliced mushrooms saves, and sends variant_created', { timeout: 20_000 }, async () => {
    const { rpc, tracker, onSaved } = setup();
    tap('+ New variant');
    type(last('Variant name'), 'Vegetarian');
    tap('Swap ingredient');
    pick('Which ingredient?', 'Bacon lardons');
    type(last('Ingredient name'), 'Mushrooms');
    type(last('Quantity'), '250');
    pickUnit('g');
    tap('Done');
    expect(card('Replace ingredient. Tap to edit.').textContent).toContain('Bacon lardons → 250 g mushrooms');
    await save();
    expect(savedVariants(rpc)).toEqual([
      {
        id: expect.any(String),
        name: 'Vegetarian',
        kind: 'version',
        changes: [{ type: 'swap_ingredient', ingredient_id: quicheIds.lardons, with: [expect.objectContaining({ name: 'Mushrooms', quantity: 250, unit: 'g' })] }],
      },
    ]);
    expect(tracker.track).toHaveBeenCalledWith('variant_created', { change_count: 1 });
    expect(onSaved).toHaveBeenCalled();
  });
});

describe('US2: an optional extra', () => {
  it('"Make my own dough": swap pastry for flour, add "Make the dough" before step 1 with a 30 min timer', { timeout: 20_000 }, async () => {
    const { rpc } = setup();
    tap('+ New variant');
    type(last('Variant name'), 'Make my own dough');
    tap('An option (on/off)');
    tap('Swap ingredient');
    pick('Which ingredient?', 'Shortcrust pastry');
    type(last('Ingredient name'), 'Flour');
    fireEvent.blur(last('Ingredient name'));
    await flush();
    type(last('Quantity'), '200');
    pickUnit('g');
    tap('Done');
    tap('Add a step');
    pick('Which step?', 'Step 1 · Preheat and line');
    type(last('Step name'), 'Make the dough');
    type(screen.getByRole('textbox', { name: 'Instructions' }), 'Rub the flour and butter, then chill.');
    tap('Timer');
    type(screen.getByRole('textbox', { name: 'Timer' }), '30');
    tap('Done');
    expect(card('Add step · before step 1. Tap to edit.').textContent).toContain('Make the dough · 30 min timer');
    await save();
    const [variant] = savedVariants(rpc) ?? [];
    expect(variant).toMatchObject({ name: 'Make my own dough', kind: 'option' });
    expect(variant?.changes).toEqual([
      // Matched against the catalog (032-later L11).
      { type: 'swap_ingredient', ingredient_id: quicheIds.pastry, with: [expect.objectContaining({ name: 'Flour', catalog_key: 'flour', quantity: 200, unit: 'g' })] },
      {
        type: 'add_step',
        step_id: quicheIds.preheat,
        place: 'before',
        step: expect.objectContaining({ name: 'Make the dough', body: 'Rub the flour and butter, then chill.', timer_seconds: 1800, timer_label: 'Make the dough' }),
      },
    ]);
  });
});

describe('Save checks (Validation copy)', () => {
  it('a variant with no name and no changes: both warnings, Save waits', async () => {
    const { rpc, onSaved } = setup({ section: 'details' });
    const view = screen;
    tap('Next: Ingredients');
    tap('Next: Steps');
    tap('Next: Variants');
    tap('+ New variant');
    await save();
    expect(view.getByText('Give this variant a name')).toBeTruthy();
    expect(view.getByText('Add at least one change, or delete this variant')).toBeTruthy();
    expect(savedVariants(rpc)).toBeUndefined();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('"Delete this variant" asks, then takes it out', async () => {
    const { rpc } = setup({ openVariant: quicheIds.vegetarian }, recipe(quiche.variants));
    tap('Delete this variant');
    expect(screen.getByRole('alertdialog', { name: 'Delete this variant?' })).toBeTruthy();
    tap('Delete');
    expect(screen.queryByRole('link', { name: /Vegetarian/ })).toBeNull();
    await save();
    expect(savedVariants(rpc)?.map((v) => v.name)).toEqual(['Make my own dough']);
  });

  it("deleting a variant whose added step has a photo removes that photo once saved, and only then", async () => {
    const photo = `${FAMILY}/${RECIPE}/00000000-0000-4000-8000-0000000000f1.jpg`;
    const withPhoto = quiche.variants.map((v) =>
      v.id === quicheIds.dough ? { ...v, changes: v.changes.map((c) => (c.type === 'add_step' ? { ...c, step: { ...c.step, photo_path: photo } } : c)) } : v,
    );
    const { removePhotos } = setup({ openVariant: quicheIds.dough }, { ...recipe(withPhoto), variantPhotos: [photo] });
    tap('Delete this variant');
    tap('Delete');
    await save();
    expect(removePhotos.mock.calls.at(-1)?.[1]).toEqual([photo]);
  });

  it('opening with nothing changed saves no variants; Cancel asks once something changed', async () => {
    const { rpc, onClose } = setup({ openVariant: quicheIds.vegetarian }, recipe(quiche.variants));
    tap('Cancel');
    expect(onClose).toHaveBeenCalled();
    type(last('Variant name'), 'Veggie');
    tap('Cancel');
    expect(screen.getByRole('alertdialog', { name: 'Discard your changes?' })).toBeTruthy();
    expect(rpc.mock.calls.some((c) => c[0] === 'save_recipe_variants')).toBe(false);
  });

  it('"Add a variant" on recipe settings opens the form with a new one', () => {
    setup({ openVariant: 'new' }, recipe(quiche.variants));
    expect(last('Variant name').value).toBe('');
    expect(card('Vegetarian, 1 change. Tap to edit.')).toBeTruthy();
  });
});

describe('edge cases', () => {
  const noBacon: RecipeVariant = { id: '00000000-0000-4000-8000-0000000000d1', position: 2, name: 'No bacon', kind: 'option', changes: [{ type: 'remove_ingredient', ingredient_id: quicheIds.lardons }] };

  it('two variants change the same ingredient: "Also changed by “No bacon”"', () => {
    setup({ openVariant: quicheIds.vegetarian }, recipe([...quiche.variants, noBacon]));
    expect(screen.getByText('Also changed by “No bacon”')).toBeTruthy();
  });

  it('an ingredient removed in the form: the change shows as broken, and "Remove change" takes it out', async () => {
    const { goTo, rpc } = setup({ section: 'ingredients' }, recipe(quiche.variants));
    fireEvent.click(screen.getByRole('button', { name: 'Remove Bacon lardons' }));
    tap('Remove');
    goTo('variants');
    fireEvent.click(card('Vegetarian, 1 change. Tap to edit.'));
    expect(screen.getByText('This change points to something that was removed.')).toBeTruthy();
    tap('Remove change');
    expect(screen.queryByText('This change points to something that was removed.')).toBeNull();
    await save();
    expect(screen.getByText('Add at least one change, or delete this variant')).toBeTruthy();
    expect(savedVariants(rpc)).toBeUndefined();
  });
});
