// Spec 020 on the Groceries screen: US1 (ticked rows struck through, the count), US2 (add "2 lemons"),
// US3 (who's shopping), merging, Clear done items with Undo, a failed tick, the row menu, the recipe
// cards and the empty list. The data rules are in lib/groceries.test.ts and the live sync in
// lib/groceries.integration.test.ts.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { onlineManager } from '@tanstack/react-query';
import { alex, fakeTracker, flush, gabriel, groceryItem, mia } from '../../test/fakes';
import type { GroceryItem } from '../../lib/groceries';

vi.mock('expo-image-picker', () => ({}));
vi.mock('expo-image-manipulator', () => ({ ImageManipulator: {}, SaveFormat: { JPEG: 'jpeg' } }));
vi.mock('expo-crypto', () => ({ randomUUID: () => 'unused' }));

const { GroceryList } = await import('./GroceryList');
type Props = Parameters<typeof GroceryList>[0];

afterEach(() => {
  cleanup();
  onlineManager.setOnline(true);
});

const now = Date.parse('2026-10-21T12:00:00Z');
const minutesAgo = (m: number) => new Date(now - m * 60_000).toISOString();
const quiche = { id: 'r-quiche', name: 'Leek & bacon quiche', serves: 6, photo_path: null, deleted_at: null };

/** The sample list (OC-Groceries): six to buy, the sourdough ticked. */
const sample: GroceryItem[] = [
  groceryItem({ id: 'cream', name: 'Heavy cream', catalog_key: 'heavy_cream', quantity: 300, unit: 'ml', aisle: 'dairy_eggs', recipes: quiche, recipe_id: quiche.id }),
  groceryItem({ id: 'cheese', name: 'Gruyère', catalog_key: 'gruyere', quantity: 100, unit: 'g', aisle: 'dairy_eggs', recipes: quiche, recipe_id: quiche.id }),
  groceryItem({ id: 'milk', name: 'Milk', catalog_key: 'milk', quantity: 2, unit: 'l', aisle: 'dairy_eggs', created_by: alex.user_id, source: 'chatgpt' }),
  groceryItem({ id: 'apples', name: 'Apples', catalog_key: 'apple', quantity: 6, unit: 'piece', aisle: 'produce', created_by: mia.user_id }),
  groceryItem({ id: 'salt', name: 'Salt', catalog_key: 'salt', quantity: null, aisle: 'spices_baking' }),
  groceryItem({ id: 'bread', name: 'Sourdough loaf', catalog_key: 'sourdough', quantity: 1, unit: 'piece', aisle: 'bakery', checked: true, checked_by: gabriel.user_id, checked_at: minutesAgo(1) }),
  groceryItem({ id: 'croissant', name: 'Croissants', catalog_key: 'croissant', quantity: 4, unit: 'piece', aisle: 'bakery', created_by: mia.user_id }),
];

function setup(over: Partial<Props> = {}) {
  const tracker = fakeTracker();
  const props: Props = {
    items: sample,
    onRetry: vi.fn(),
    me: gabriel.user_id,
    members: [gabriel, alex, mia],
    tracker,
    photoUrls: {},
    onAdd: vi.fn(async () => ({ status: 'added' as const, unmatched: false })),
    onToggle: vi.fn(async () => 'saved' as const),
    onClear: vi.fn(async () => true),
    onRestore: vi.fn(async () => true),
    onEdit: vi.fn(async () => 'saved' as const),
    onMove: vi.fn(async () => true),
    onOpenRecipe: vi.fn(),
    now,
    ...over,
  };
  const view = render(<GroceryList {...props} />);
  return { tracker, props, rerender: (next: Partial<Props>) => view.rerender(<GroceryList {...props} {...next} />) };
}

const row = (name: string) => screen.getByRole('checkbox', { name: new RegExp(name) });
const aisle = (name: string) => screen.getByRole('heading', { name }).parentElement as HTMLElement;

describe('Groceries', () => {
  it('groups rows by aisle in store order, with the source and Need (FR-001, FR-003)', () => {
    setup();
    const headings = screen.getAllByRole('heading').map((h) => h.textContent);
    expect(headings).toEqual(['Groceries', 'Produce', 'Bakery', 'Dairy & eggs', 'Spices & baking']);
    expect(screen.getByText('6 items to buy · shared with family')).toBeTruthy();
    const dairy = within(aisle('Dairy & eggs'));
    expect(dairy.getAllByText('For Leek & bacon quiche')).toHaveLength(2);
    expect(dairy.getByText('Need 300 ml')).toBeTruthy();
    expect(dairy.getByText('Alex via ChatGPT')).toBeTruthy();
    expect(within(aisle('Produce')).getByText('Added by Mia')).toBeTruthy();
    // No quantity, no Need.
    expect(within(aisle('Spices & baking')).queryByText(/Need/)).toBeNull();
  });

  it('US1: a tick from Mia shows struck through and the count drops', () => {
    const { rerender } = setup();
    expect(row('Gruyère').getAttribute('aria-checked')).toBe('false');
    rerender({ items: sample.map((i) => (i.id === 'cheese' ? { ...i, checked: true, checked_by: mia.user_id, checked_at: minutesAgo(0) } : i)) });
    expect(row('Gruyère').getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText('5 items to buy · shared with family')).toBeTruthy();
    expect(screen.getByText('Mia is shopping')).toBeTruthy();
  });

  it('ticks a row, tracking ticks but not unticks', async () => {
    const { props, tracker } = setup();
    fireEvent.click(row('Apples'));
    await flush();
    expect(props.onToggle).toHaveBeenCalledWith(expect.objectContaining({ id: 'apples' }), true);
    fireEvent.click(row('Sourdough loaf'));
    await flush();
    expect(props.onToggle).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'bread' }), false);
    expect(tracker.track.mock.calls.filter(([e]) => e === 'grocery_item_ticked')).toEqual([['grocery_item_ticked', {}]]);
  });

  it('FR-005: a failed tick says so (the row reverts with the data), and is not counted', async () => {
    const { tracker } = setup({ onToggle: vi.fn(async () => 'failed' as const) });
    fireEvent.click(row('Apples'));
    await flush();
    expect(screen.getByText("Couldn't update. Try again.")).toBeTruthy();
    expect(row('Apples').getAttribute('aria-checked')).toBe('false');
    expect(tracker.track).not.toHaveBeenCalledWith('grocery_item_ticked', {});
  });

  it('keeps the text when adding fails', async () => {
    const { tracker } = setup({ onAdd: vi.fn(async () => ({ status: 'failed' as const })) });
    const field = screen.getByLabelText('Add an item') as HTMLInputElement;
    fireEvent.change(field, { target: { value: '2 lemons' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add item' }));
    await flush();
    expect(screen.getByText("Couldn't add this item. Try again.")).toBeTruthy();
    expect(field.value).toBe('2 lemons');
    expect(tracker.track).not.toHaveBeenCalledWith('grocery_item_added', { from: 'app' });
  });

  it('says so when a merge had no amount', async () => {
    setup({ onAdd: vi.fn(async () => ({ status: 'merged' as const, total: null })) });
    fireEvent.change(screen.getByLabelText('Add an item'), { target: { value: 'salt' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add item' }));
    await flush();
    expect(screen.getByText('Already on the list.')).toBeTruthy();
  });

  it('offers Try again when the list could not load', () => {
    const { props } = setup({ items: undefined, failed: true });
    expect(screen.getByText("Couldn't load the list. Check your connection and try again.")).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(props.onRetry).toHaveBeenCalledOnce();
  });

  it('US2: adds what was typed, clears the field, and tracks it', async () => {
    const { props, tracker } = setup();
    const field = screen.getByLabelText('Add an item');
    expect(field.getAttribute('placeholder')).toBe('Add an item, e.g. 2 lemons');
    expect(screen.getByText('Long-press an item to edit, move or remove it.')).toBeTruthy();
    fireEvent.change(field, { target: { value: '2 lemons' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add item' }));
    await flush();
    expect(props.onAdd).toHaveBeenCalledWith('2 lemons');
    expect((field as HTMLInputElement).value).toBe('');
    expect(tracker.track).toHaveBeenCalledWith('grocery_item_added', { from: 'app' });
  });

  it('US2: the new row reads "Lemons · Need 2 · Added by Gabriel" under Produce', () => {
    setup({ items: [...sample, groceryItem({ id: 'lemons', name: 'Lemons', aisle: 'produce' })] });
    const produce = within(aisle('Produce'));
    expect(produce.getByText('Lemons')).toBeTruthy();
    expect(produce.getByText('Need 2')).toBeTruthy();
    expect(produce.getByText('Added by Gabriel')).toBeTruthy();
  });

  it('says when an item was already on the list', async () => {
    setup({ onAdd: vi.fn(async () => ({ status: 'merged' as const, total: '3' })) });
    fireEvent.change(screen.getByLabelText('Add an item'), { target: { value: '1 apple' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add item' }));
    await flush();
    expect(screen.getByText('Already on the list. Updated to 3.')).toBeTruthy();
    expect(screen.getByLabelText('Add an item').getAttribute('value') ?? '').toBe('');
  });

  it('counts an item the catalog does not know, never its name', async () => {
    const { tracker } = setup({ onAdd: vi.fn(async () => ({ status: 'added' as const, unmatched: true })) });
    fireEvent.change(screen.getByLabelText('Add an item'), { target: { value: "Za'atar" } });
    fireEvent.click(screen.getByRole('button', { name: 'Add item' }));
    await flush();
    expect(tracker.track).toHaveBeenCalledWith('ingredient_unmatched', {});
  });

  it('US3: shows who else ticked in the last 10 minutes, never me', () => {
    setup();
    expect(screen.queryByText(/is shopping/)).toBeNull();
    cleanup();
    setup({ items: sample.map((i) => (i.id === 'apples' ? { ...i, checked: true, checked_by: mia.user_id, checked_at: minutesAgo(9) } : i)) });
    expect(screen.getByText('Mia is shopping')).toBeTruthy();
    cleanup();
    setup({ items: sample.map((i) => (i.id === 'apples' ? { ...i, checked: true, checked_by: mia.user_id, checked_at: minutesAgo(11) } : i)) });
    expect(screen.queryByText(/is shopping/)).toBeNull();
  });

  it('clears ticked items on request only, with Undo', async () => {
    const { props, tracker } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Clear done items' }));
    await flush();
    expect(props.onClear).toHaveBeenCalledWith(['bread']);
    expect(tracker.track).toHaveBeenCalledWith('done_items_cleared', { count: 1 });
    expect(screen.getByText('Cleared 1 item')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await flush();
    expect(props.onRestore).toHaveBeenCalledWith(['bread']);
    expect(tracker.track).toHaveBeenCalledWith('clear_done_undone', { count: 1 });
  });

  it('has no Clear button when nothing is ticked', () => {
    setup({ items: sample.filter((i) => !i.checked) });
    expect(screen.queryByRole('button', { name: 'Clear done items' })).toBeNull();
  });

  it('FR-006: a row’s menu moves it to another aisle, for the family', async () => {
    const { props, tracker } = setup();
    fireEvent.contextMenu(row('Salt'));
    await flush();
    fireEvent.click(screen.getByRole('link', { name: /Move to…/ }));
    await flush();
    expect(screen.getByText('Salt will go here from now on, for your family.')).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: /Dry goods/ }));
    await flush();
    expect(props.onMove).toHaveBeenCalledWith(expect.objectContaining({ id: 'salt' }), 'dry_goods');
    expect(tracker.track).toHaveBeenCalledWith('catalog_override_saved', { field: 'aisle' });
  });

  it('FR-006: edits a row from its menu', async () => {
    const { props } = setup();
    fireEvent.contextMenu(row('Apples'));
    await flush();
    // The menu opens straight on the Edit field.
    expect(screen.getByRole('heading', { name: 'Edit item' })).toBeTruthy();
    const field = screen.getByLabelText('Item') as HTMLInputElement;
    expect(field.value).toBe('6 Apples');
    fireEvent.change(field, { target: { value: '8 apples' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await flush();
    expect(props.onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 'apples' }), '8 apples');
  });

  it('FR-006: removes a row, with Undo', async () => {
    const { props } = setup();
    fireEvent.contextMenu(row('Croissants'));
    await flush();
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    await flush();
    expect(props.onClear).toHaveBeenCalledWith(['croissant']);
    expect(screen.getByText('Removed Croissants.')).toBeTruthy();
  });

  it('FR-004: a card per linked recipe opens it', () => {
    const { props } = setup();
    expect(screen.getByText('2 items · serves 6')).toBeTruthy();
    fireEvent.click(screen.getByRole('link', { name: 'Open Leek & bacon quiche' }));
    expect(props.onOpenRecipe).toHaveBeenCalledWith('r-quiche');
  });

  it('offline: the list stays readable, nothing can be changed', async () => {
    const { props } = setup();
    act(() => onlineManager.setOnline(false));
    expect(screen.getByText("You're offline. You can read, but changes need a connection.")).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add item' }).getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByRole('button', { name: 'Clear done items' }).getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(row('Apples'));
    fireEvent.contextMenu(row('Apples'));
    await flush();
    expect(props.onToggle).not.toHaveBeenCalled();
    expect(screen.queryByRole('link', { name: /Move to…/ })).toBeNull();
  });

  it('shows the empty list', () => {
    setup({ items: [] });
    expect(screen.getByText('Your list is empty.')).toBeTruthy();
    expect(screen.getByText('Add items above, or from any recipe with “Add to groceries…”.')).toBeTruthy();
    expect(screen.getByText('0 items to buy · shared with family')).toBeTruthy();
  });
});
