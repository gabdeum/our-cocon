// Spec 015 (design/ui/OC-EditIngredients.md): the recipe form's Ingredients section. US1 paste a
// list, US2 counted items and their weight, US3 problems block Save, and the edge cases (to taste,
// removing an ingredient a step uses), plus reorder, catalog suggestions and new ingredients.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { format } from '@cocon/quantity';
import type { IngredientFacts, RecipeFormSection } from '@cocon/schemas';
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
const LEEKS = 'c0c01000-0000-4000-8000-000000000003';
const BUTTER = 'c0c01000-0000-4000-8000-000000000002';

const egg: IngredientFacts = { catalog_key: 'egg', family_ingredient_id: null, name: 'Egg', plural: 'Eggs', aisle: 'dairy_eggs', density_g_per_ml: null, size_small_g: 43, size_medium_g: 50, size_large_g: 57, default_size: 'medium', noun_singular: null, noun_plural: null, whole_only: true, diet: [] };
const leek: IngredientFacts = { ...egg, catalog_key: 'leek', name: 'Leek', plural: 'Leeks', aisle: 'produce', size_small_g: 100, size_medium_g: 150, size_large_g: 220, whole_only: false };

/** A saved step with only its text. */
const savedStep = (position: number, body: string) => ({
  id: `00000000-0000-4000-8000-0000000005${String(position).padStart(2, '0')}`,
  position,
  name: null,
  body,
  timer_seconds: null,
  timer_label: null,
  temp_check_c: null,
  temp_check_text: null,
  tip: null,
  photo_path: null,
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
    { id: BUTTER, position: 0, name: 'Butter', quantity: 30, unit: 'g' },
    { id: LEEKS, position: 1, name: 'Leeks', quantity: 2, unit: 'piece', weight_per_piece_g: 150, catalog_key: 'leek' },
  ],
  steps: [
    savedStep(0, 'Preheat the oven.'),
    savedStep(1, 'Melt {ing:c0c01000-0000-4000-8000-000000000002}.'),
    savedStep(2, 'Add {ing:c0c01000-0000-4000-8000-000000000003} and cook.'),
  ],
  facts: { leek },
};

function fakeClient() {
  const eq = vi.fn(() => Promise.resolve({ error: null }));
  const insert = vi.fn(() => Promise.resolve({ error: null }));
  const update = vi.fn(() => ({ eq }));
  const upsert = vi.fn(() => Promise.resolve({ error: null }));
  const known: Record<string, IngredientFacts> = { egg, leek };
  const rpc = vi.fn((name: string, args: Record<string, unknown>) => {
    if (name === 'match_ingredients') {
      const queries = args.queries as { full: string; core: string }[];
      return Promise.resolve({ data: queries.map((q, idx) => ({ idx, ...(known[q.core] ? { how: 'exact', ...known[q.core] } : { how: 'none' }) })), error: null });
    }
    if (name === 'suggest_ingredients') return Promise.resolve({ data: String(args.q).startsWith('le') ? [leek] : [], error: null });
    return Promise.resolve({ data: null, error: null });
  });
  const client = { from: vi.fn(() => ({ insert, update, upsert })), rpc, storage: { from: vi.fn(() => ({ remove: vi.fn(), createSignedUrls: vi.fn(() => Promise.resolve({ data: [], error: null })) })) } };
  return { client: client as unknown as Props['client'], insert, update, upsert, rpc };
}

function setup(over: Partial<Props> = {}) {
  const tracker = fakeTracker();
  const { client, insert, update, upsert, rpc } = fakeClient();
  const storage = { getItem: vi.fn(async () => null), setItem: vi.fn(async () => undefined) };
  const onSaved = vi.fn();
  let n = 0;
  const newId = () => `00000000-0000-4000-8000-${String((n += 1)).padStart(12, '0')}`;
  let section: RecipeFormSection = over.section ?? 'ingredients';
  const onSectionChange = vi.fn((s: RecipeFormSection) => {
    section = s;
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
  return { tracker, insert, update, upsert, rpc, onSaved, onSectionChange };
}

const names = () => screen.getAllByLabelText('Ingredient name').map((e) => (e as HTMLInputElement).value);
const quantities = () => screen.getAllByLabelText('Quantity').map((e) => (e as HTMLInputElement).value);
const last = (label: string) => screen.getAllByLabelText(label).at(-1) as HTMLInputElement;
const save = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await flush();
};
const savedRows = (rpc: ReturnType<typeof vi.fn>) => {
  const call = rpc.mock.calls.find((c) => c[0] === 'save_recipe_ingredients');
  return (call?.[1] as { p_ingredients: Record<string, unknown>[] } | undefined)?.p_ingredients;
};
const pickUnit = (row: number, unit: string) => {
  fireEvent.click(screen.getAllByRole('button', { name: /^Unit: / })[row] as HTMLElement);
  fireEvent.click(within(screen.getByRole('dialog', { name: 'Unit' })).getByRole('button', { name: unit }));
};

describe('the section (OC-EditIngredients › Layout)', () => {
  it('shows the title, servings from Details, the lead, the rows, the buttons and the tip', () => {
    setup();
    expect(screen.getByRole('heading', { name: 'Ingredients' })).toBeTruthy();
    expect(screen.getByText('For 6 servings')).toBeTruthy();
    expect(screen.getByText(/For things you count \(eggs, leeks\)/)).toBeTruthy();
    expect(names()).toEqual(['Butter', 'Leeks']);
    expect((screen.getByLabelText('Weight of one (g)') as HTMLInputElement).value).toBe('150');
    expect(screen.getByRole('button', { name: '+ Add ingredient' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Paste a list' })).toBeTruthy();
    expect(screen.getByText("Tip: paste “200 g lardons, 3 eggs…” and we'll split it into rows.")).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Next: Steps' })).toBeTruthy();
  });
});

describe('US1: add ingredients quickly', () => {
  it('splits a pasted list into rows, matches them and says to check', async () => {
    const { tracker } = setup({ recipe: null });
    fireEvent.click(screen.getByRole('button', { name: 'Paste a list' }));
    fireEvent.change(screen.getByLabelText('Your ingredients'), { target: { value: '200 g lardons, 3 eggs, 300 ml cream' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add ingredients' }));
    await flush();
    expect(names()).toEqual(['Lardons', 'Eggs', 'Cream']);
    expect(quantities()).toEqual(['200', '3', '300']);
    expect(screen.getAllByRole('button', { name: /^Unit: / }).map((b) => b.getAttribute('aria-label'))).toEqual(['Unit: g', 'Unit: pieces', 'Unit: ml']);
    expect(screen.getByRole('status').textContent).toContain('Added 3 ingredients. Check the amounts.');
    expect(tracker.track.mock.calls.filter((c) => c[0] === 'ingredient_line_added')).toEqual([
      ['ingredient_line_added', { parsed: true }],
      ['ingredient_line_added', { parsed: true }],
      ['ingredient_line_added', { parsed: true }],
    ]);
    // US2: a known counted item gets a default weight.
    expect((screen.getByLabelText('Weight of one (g)') as HTMLInputElement).value).toBe('50');
  });

  it('"+ Add ingredient" adds an empty row and tracks it as typed', () => {
    const { tracker } = setup();
    fireEvent.click(screen.getByRole('button', { name: '+ Add ingredient' }));
    expect(names()).toEqual(['Butter', 'Leeks', '']);
    expect(tracker.track).toHaveBeenCalledWith('ingredient_line_added', { parsed: false });
  });
});

describe('US2: counted items know their weight', () => {
  it('asks for the weight of one piece, and steps can show "2 leeks (300 g)"', async () => {
    const { rpc } = setup({ recipe: null });
    // A new recipe opens with one empty row, with placeholders that say what goes where.
    expect(names()).toEqual(['']);
    expect(last('Ingredient name').placeholder).toBe('Ingredient, like leeks');
    expect(last('Quantity').placeholder).toBe('Amount');
    fireEvent.change(last('Ingredient name'), { target: { value: 'Leeks' } });
    fireEvent.change(last('Quantity'), { target: { value: '2' } });
    expect(screen.queryByLabelText('Weight of one (g)')).toBeNull();
    pickUnit(0, 'pieces');
    expect((screen.getByLabelText('Weight of one (g)') as HTMLInputElement).placeholder).toBe('?');
    fireEvent.change(screen.getByLabelText('Weight of one (g)'), { target: { value: '150 g' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('link', { name: 'Details' }));
    });
    fireEvent.change(screen.getByLabelText('Recipe name'), { target: { value: 'Leek soup' } });
    await save();
    const rows = savedRows(rpc);
    expect(rows).toEqual([expect.objectContaining({ name: 'Leeks', quantity: 2, unit: 'piece', weight_per_piece_g: 150, piece_noun_singular: 'leek', piece_noun_plural: 'leeks' })]);
    const row = rows?.[0] as unknown as Parameters<typeof format>[0];
    expect(format({ ...row, id: 'x' }, { system: 'metric', scale: true }).phrase).toBe('2 leeks (300 g)');
  });

  it('offers small, medium and large for catalog items with sizes, with their weight', () => {
    setup();
    pickUnit(1, 'large');
    expect(screen.getAllByRole('button', { name: /^Unit: / })[1]?.getAttribute('aria-label')).toBe('Unit: large');
    // The leeks' 150 g was the catalog's medium, so the large size brings its own.
    expect((screen.getByLabelText('Weight of one (g)') as HTMLInputElement).value).toBe('220');
  });
});

describe('US3: fix problems before saving', () => {
  it('warns on a quantity with no unit, blocks Save and brings Ingredients back', async () => {
    const { rpc, update, onSaved, onSectionChange } = setup();
    fireEvent.click(screen.getByRole('button', { name: '+ Add ingredient' }));
    fireEvent.change(last('Ingredient name'), { target: { value: 'Heavy cream' } });
    fireEvent.change(last('Quantity'), { target: { value: '300' } });
    fireEvent.click(screen.getByRole('link', { name: 'Details' }));
    await save();
    expect(onSectionChange).toHaveBeenLastCalledWith('ingredients');
    expect(screen.getByRole('alert').textContent).toBe('Pick a unit so we can convert and scale it.');
    expect(screen.getByRole('button', { name: 'Unit: Unit?' }).getAttribute('aria-invalid')).toBe('true');
    expect(update).not.toHaveBeenCalled();
    expect(savedRows(rpc)).toBeUndefined();
    expect(onSaved).not.toHaveBeenCalled();
    // Picking a unit clears it, and Save goes through.
    pickUnit(2, 'ml');
    expect(screen.queryByRole('alert')).toBeNull();
    await save();
    expect(savedRows(rpc)?.at(-1)).toMatchObject({ name: 'Heavy cream', quantity: 300, unit: 'ml' });
    expect(onSaved).toHaveBeenCalled();
  });

  it('allows "Salt and pepper to taste" without an amount or a unit', async () => {
    const { rpc } = setup();
    fireEvent.click(screen.getByRole('button', { name: '+ Add ingredient' }));
    fireEvent.change(last('Ingredient name'), { target: { value: 'Salt and pepper to taste' } });
    await save();
    expect(savedRows(rpc)?.at(-1)).toMatchObject({ name: 'Salt and pepper to taste', quantity: null, unit: null });
  });
});

describe('remove and reorder (FR-002)', () => {
  it('asks before removing an ingredient a step uses, then saves without it', async () => {
    const { rpc } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Remove Leeks' }));
    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByRole('heading').textContent).toBe('Remove Leeks?');
    expect(dialog.textContent).toContain("It's used in step 3. We'll take it out of that step too.");
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(names()).toEqual(['Butter', 'Leeks']);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Leeks' }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Remove' }));
    expect(names()).toEqual(['Butter']);
    await save();
    expect(savedRows(rpc)?.map((r) => r.id)).toEqual([BUTTER]);
  });

  it('removes a row no step uses at once', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: '+ Add ingredient' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove ingredient' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(names()).toEqual(['Butter', 'Leeks']);
  });

  it('moves a row up from its handle and saves the new order', async () => {
    const { rpc } = setup();
    fireEvent.keyDown(screen.getAllByRole('button', { name: 'Drag to reorder' })[1] as HTMLElement, { key: 'ArrowUp' });
    expect(names()).toEqual(['Leeks', 'Butter']);
    await save();
    expect(savedRows(rpc)?.map((r) => r.id)).toEqual([LEEKS, BUTTER]);
  });

  it('saves nothing about ingredients when they did not change', async () => {
    const { rpc, update } = setup();
    await save();
    expect(update).toHaveBeenCalled();
    expect(savedRows(rpc)).toBeUndefined();
  });
});

describe('the catalog (spec 031)', () => {
  it('suggests catalog entries while typing a name', async () => {
    const { rpc } = setup();
    fireEvent.click(screen.getByRole('button', { name: '+ Add ingredient' }));
    fireEvent.focus(last('Ingredient name'));
    fireEvent.change(last('Ingredient name'), { target: { value: 'lee' } });
    await act(() => new Promise((r) => setTimeout(r, 300)));
    const list = screen.getByRole('list', { name: 'Suggestions' });
    fireEvent.click(within(list).getByText('Leek'));
    expect(names().at(-1)).toBe('Leek');
    await save();
    expect(savedRows(rpc)?.at(-1)).toMatchObject({ name: 'Leek', catalog_key: 'leek' });
  });

  it('asks for the aisle of a new ingredient and adds it to the family\'s list', async () => {
    const { rpc, upsert } = setup();
    fireEvent.click(screen.getByRole('button', { name: '+ Add ingredient' }));
    fireEvent.focus(last('Ingredient name'));
    fireEvent.change(last('Ingredient name'), { target: { value: "Grandma's spice mix" } });
    fireEvent.blur(last('Ingredient name'));
    await flush();
    expect(screen.getByText('New ingredient. Pick its aisle:')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Aisle: Pick an aisle' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Aisle' })).getByRole('button', { name: 'Spices & baking' }));
    await save();
    expect(upsert).toHaveBeenCalledWith([expect.objectContaining({ custom_name: "Grandma's spice mix", aisle: 'spices_baking', family_id: FAMILY })], {
      onConflict: 'family_id,name_norm',
      ignoreDuplicates: true,
    });
    expect(savedRows(rpc)?.at(-1)).toMatchObject({ name: "Grandma's spice mix", catalog_key: null });
  });
});

describe('amounts take only numbers', () => {
  it('drops letters typed in the quantity and the weight of one', () => {
    setup();
    fireEvent.change(screen.getAllByLabelText('Quantity')[0] as HTMLElement, { target: { value: '30g' } });
    expect(quantities()[0]).toBe('30');
    fireEvent.change(screen.getAllByLabelText('Quantity')[0] as HTMLElement, { target: { value: '1 1/2' } });
    expect(quantities()[0]).toBe('1 1/2');
    fireEvent.change(screen.getByLabelText('Weight of one (g)'), { target: { value: 'about 150' } });
    expect((screen.getByLabelText('Weight of one (g)') as HTMLInputElement).value).toBe('150');
  });
});

describe('the other row warnings and states (OC-EditIngredients › Validation copy)', () => {
  it('says how to fix an unreadable amount and a missing name', async () => {
    setup({ recipe: null });
    fireEvent.change(last('Ingredient name'), { target: { value: 'Flour' } });
    fireEvent.change(last('Quantity'), { target: { value: '1//2' } });
    fireEvent.click(screen.getByRole('button', { name: '+ Add ingredient' }));
    fireEvent.change(last('Quantity'), { target: { value: '2' } });
    pickUnit(1, 'pieces');
    await save();
    // Details first: the empty recipe name is warned there, so give it one and save again.
    fireEvent.change(screen.getByLabelText('Recipe name'), { target: { value: 'Bread' } });
    await save();
    expect(screen.getAllByRole('alert').map((a) => a.textContent)).toEqual(['Type an amount like 2, 1½ or 1/2.', 'Give this ingredient a name.']);
  });

  it('asks for an amount when only a unit is picked, and for grams in the weight', async () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: '+ Add ingredient' }));
    fireEvent.change(last('Ingredient name'), { target: { value: 'Milk' } });
    pickUnit(2, 'ml');
    fireEvent.change(screen.getAllByLabelText('Weight of one (g)')[0] as HTMLElement, { target: { value: '1..5' } });
    await save();
    expect(screen.getAllByRole('alert').map((a) => a.textContent)).toEqual(['Type the weight of one in grams, like 150.', 'Add an amount, or pick “No unit”.']);
  });

  it('says when a paste found nothing', async () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Paste a list' }));
    fireEvent.change(screen.getByLabelText('Your ingredients'), { target: { value: ' , \n ,' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add ingredients' }));
    await flush();
    expect(screen.getByRole('status').textContent).toContain("We couldn't find any ingredients in that.");
    expect(names()).toEqual(['Butter', 'Leeks']);
  });

  it('names every step that uses an ingredient', () => {
    const steps = [...(quiche.steps ?? []), savedStep(3, 'Top with {ing:c0c01000-0000-4000-8000-000000000003}.')];
    setup({ recipe: { ...quiche, steps } });
    fireEvent.click(screen.getByRole('button', { name: 'Remove Leeks' }));
    expect(screen.getByRole('alertdialog').textContent).toContain("It's used in steps 3 and 4. We'll take it out of those steps too.");
  });

  it('has no fields for what a piece is called, even in advanced mode', async () => {
    setup({ storage: { getItem: vi.fn(async () => 'true'), setItem: vi.fn(async () => undefined) } });
    await flush();
    expect(screen.queryByLabelText('Name for one')).toBeNull();
    expect(screen.queryByLabelText('Name for several')).toBeNull();
  });
});
