// Spec 020 on the Groceries screen: US1 (ticked rows struck through, the count), US2 (add "2 lemons"),
// US3 (who's shopping), merging, Clear done items with Undo, a failed tick, the row menu, the recipe
// cards and the empty list. The data rules are in lib/groceries.test.ts and the live sync in
// lib/groceries.integration.test.ts. Spec 021 (what to buy beside each name, the settings sheet, Edit
// and Clear all) is the last block.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { onlineManager } from '@tanstack/react-query';
import { alex, fakeTracker, flush, gabriel, groceryItem, mia, packData } from '../../test/fakes';
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
    settings: { store_profile: 'us', round_to_packs: true },
    packs: undefined,
    onChangeSettings: vi.fn(async () => 'saved' as const),
    onSavePacks: vi.fn(async () => 'saved' as const),
    now,
    ...over,
  };
  const view = render(<GroceryList {...props} />);
  return { tracker, props, rerender: (next: Partial<Props>) => view.rerender(<GroceryList {...props} {...next} />) };
}

const row = (name: string) => screen.getByRole('checkbox', { name: new RegExp(name) });
const aisle = (name: string) => screen.getByRole('heading', { name }).parentElement as HTMLElement;

describe('Groceries', () => {
  it('groups rows by aisle in store order, with the source and amount (FR-001, FR-003)', () => {
    setup();
    const headings = screen.getAllByRole('heading').map((h) => h.textContent);
    expect(headings).toEqual(['Groceries', 'Produce', 'Bakery', 'Dairy & eggs', 'Spices & baking']);
    expect(screen.getByText('6 items to buy · shared with family')).toBeTruthy();
    const dairy = within(aisle('Dairy & eggs'));
    expect(dairy.getAllByText('For Leek & bacon quiche')).toHaveLength(2);
    expect(dairy.getByText('Heavy cream: 300 ml')).toBeTruthy();
    expect(dairy.getByText('Alex via ChatGPT')).toBeTruthy();
    expect(within(aisle('Produce')).getByText('Added by Mia')).toBeTruthy();
    // No quantity, no Need.
    expect(within(aisle('Spices & baking')).getByText('Salt')).toBeTruthy();
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
    expect(screen.queryByText(/Long-press/)).toBeNull();
    fireEvent.change(field, { target: { value: '2 lemons' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add item' }));
    await flush();
    expect(props.onAdd).toHaveBeenCalledWith('2 lemons');
    expect((field as HTMLInputElement).value).toBe('');
    expect(tracker.track).toHaveBeenCalledWith('grocery_item_added', { from: 'app' });
  });

  it('US2: the new row reads "Lemons: 2 pieces · Added by Gabriel" under Produce (before its packs load)', () => {
    setup({ items: [...sample, groceryItem({ id: 'lemons', name: 'Lemons', aisle: 'produce' })] });
    const produce = within(aisle('Produce'));
    expect(produce.getByText('Lemons: 2 pieces')).toBeTruthy();
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

describe('Groceries › what to buy (spec 021)', () => {
  const keys = ['heavy_cream', 'gruyere', 'milk', 'apple', 'salt', 'sourdough', 'croissant'];
  /** The row's title line: "Heavy cream: 1 pint carton (need 300 ml)". */
  const line = (name: string) => within(row(name)).getByText(new RegExp(`^${name}`)).textContent;
  const openSettings = async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Grocery settings' }));
    await flush();
  };

  it('US1: in US stores, heavy cream is a pint carton, beside its name; no leftover', async () => {
    setup({ packs: await packData(keys) });
    expect(line('Heavy cream')).toBe('Heavy cream: 1 pint carton (need 300 ml)');
    expect(screen.queryByText(/left over/)).toBeNull();
  });

  it('US1: in European stores, it is 2 × 20 cl', async () => {
    setup({ packs: await packData(keys), settings: { store_profile: 'eu', round_to_packs: true } });
    expect(line('Heavy cream')).toBe('Heavy cream: 2 × 20 cl (need 300 ml)');
    // Exactly what's needed is said once.
    expect(line('Milk')).toBe('Milk: 2 × 1 l carton');
  });

  it('US2: the settings sheet changes where the family shops, and every row follows', async () => {
    const { props, rerender } = setup({ packs: await packData(keys) });
    // No store row on the page any more.
    expect(screen.queryByRole('button', { name: 'Europe' })).toBeNull();
    await openSettings();
    expect(screen.getByRole('heading', { name: 'Grocery settings' })).toBeTruthy();
    expect(screen.getByText('Buy 1 pint')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'European stores' }));
    await flush();
    expect(props.onChangeSettings).toHaveBeenCalledWith({ store_profile: 'eu' });
    rerender({ settings: { store_profile: 'eu', round_to_packs: true } });
    expect(screen.getByText('Buy 2 × 20 cl')).toBeTruthy();
    expect(line('Heavy cream')).toBe('Heavy cream: 2 × 20 cl (need 300 ml)');
  });

  it('US2: the sheet says so when a change could not be saved', async () => {
    setup({ packs: await packData(keys), onChangeSettings: vi.fn(async () => 'failed' as const) });
    await openSettings();
    fireEvent.click(screen.getByRole('button', { name: 'European stores' }));
    await flush();
    expect(screen.getByText("Couldn't save. Try again.")).toBeTruthy();
  });

  it('US3: round-up is in the sheet; off, rows show only what recipes need', async () => {
    const { props, rerender } = setup({ packs: await packData(keys) });
    await openSettings();
    fireEvent.click(screen.getByRole('switch', { name: 'Round up to store sizes' }));
    await flush();
    expect(props.onChangeSettings).toHaveBeenCalledWith({ round_to_packs: false });
    rerender({ settings: { store_profile: 'us', round_to_packs: false } });
    expect(line('Heavy cream')).toBe('Heavy cream: 300 ml');
  });

  it('edge cases: one by one, no quantity, no pack data', async () => {
    setup({
      items: [...sample, groceryItem({ id: 'zaatar', name: "Za'atar", catalog_key: null, quantity: 50, unit: 'g', aisle: 'other' })],
      packs: await packData(keys),
      settings: { store_profile: 'eu', round_to_packs: true },
    });
    expect(line('Apple')).toBe('Apple: 6 pieces');
    expect(line('Salt')).toBe('Salt');
    expect(line("Za'atar")).toBe("Za'atar: 50 g");
    expect(screen.queryByText(/is what to pick up at the store/)).toBeNull();
  });

  it('every row has an Edit button that opens its sheet, beside the row (not inside it)', async () => {
    setup({ packs: await packData(keys) });
    const edit = screen.getByRole('button', { name: 'Edit Heavy cream' });
    expect(row('Heavy cream').contains(edit)).toBe(false);
    fireEvent.click(edit);
    await flush();
    expect(screen.getByRole('heading', { name: 'Edit item' })).toBeTruthy();
    expect((screen.getByLabelText('Item') as HTMLInputElement).value).toBe('300 ml Heavy cream');
  });

  it('the Edit sheet keeps Move to… and Store size together, and Remove apart, in red', async () => {
    const { props } = setup({ packs: await packData(keys) });
    fireEvent.click(screen.getByRole('button', { name: 'Edit Heavy cream' }));
    await flush();
    const remove = screen.getByRole('button', { name: 'Remove' });
    const options = screen.getByRole('link', { name: /Move to…/ }).parentElement as HTMLElement;
    expect(options.contains(remove)).toBe(false);
    expect(within(options).getByRole('link', { name: /Store size/ })).toBeTruthy();
    fireEvent.click(remove);
    await flush();
    expect(props.onClear).toHaveBeenCalledWith(['cream']);
  });

  it('Clear all items asks first, then clears every item with Undo', async () => {
    const { props, tracker } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Clear all items' }));
    await flush();
    expect(screen.getByText('Clear all 7 items on the list?')).toBeTruthy();
    expect(screen.getByText('This removes every item, ticked or not, for everyone in the family. You can undo it right after.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Keep the list' }));
    await flush();
    expect(props.onClear).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Clear all items' }));
    await flush();
    const dialog = screen.getByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Clear all items' }));
    await flush();
    expect(props.onClear).toHaveBeenCalledWith(sample.map((i) => i.id));
    expect(tracker.track).toHaveBeenCalledWith('all_items_cleared', { count: 7 });
    expect(screen.getByText('Cleared 7 items')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await flush();
    expect(props.onRestore).toHaveBeenCalledWith(sample.map((i) => i.id));
    expect(tracker.track).not.toHaveBeenCalledWith('clear_done_undone', expect.anything());
  });

  it('Clear all says "the 1 item" for one, and says so when it fails', async () => {
    setup({ items: [sample[0] as GroceryItem], onClear: vi.fn(async () => false) });
    fireEvent.click(screen.getByRole('button', { name: 'Clear all items' }));
    await flush();
    expect(screen.getByText('Clear the 1 item on the list?')).toBeTruthy();
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Clear all items' }));
    await flush();
    expect(screen.getByText("Couldn't update. Try again.")).toBeTruthy();
  });

  it('has no Clear all on an empty list', () => {
    setup({ items: [] });
    expect(screen.queryByRole('button', { name: 'Clear all items' })).toBeNull();
  });

  it('FR-004: Edit › Store size saves the family’s own pack size', async () => {
    const { props, tracker } = setup({ packs: await packData(keys) });
    fireEvent.click(screen.getByRole('button', { name: 'Edit Heavy cream' }));
    await flush();
    fireEvent.click(screen.getByRole('link', { name: /Store size/ }));
    await flush();
    expect(screen.getByText('What Heavy cream comes in where you shop. Saved for your family.')).toBeTruthy();
    expect(screen.queryByText('Use the usual sizes')).toBeNull();
    fireEvent.change(screen.getByLabelText('Pack size'), { target: { value: '25 cl' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await flush();
    expect(props.onSavePacks).toHaveBeenCalledWith(expect.objectContaining({ id: 'cream' }), '25 cl');
    expect(tracker.track).toHaveBeenCalledWith('catalog_override_saved', { field: 'packs' });
  });

  it('FR-004: a size it cannot read keeps the sheet open with a warning; a correction can be undone', async () => {
    const onSavePacks = vi.fn(async (_item: GroceryItem, text: string | null) => (text === 'a bag' ? ('invalid' as const) : ('saved' as const)));
    const { tracker } = setup({ packs: await packData(keys, { heavy_cream: '25 cl' }), onSavePacks });
    fireEvent.click(screen.getByRole('button', { name: 'Edit Heavy cream' }));
    await flush();
    fireEvent.click(screen.getByRole('link', { name: /Store size/ }));
    await flush();
    const field = screen.getByLabelText('Pack size') as HTMLInputElement;
    expect(field.value).toBe('25 cl');
    fireEvent.change(field, { target: { value: 'a bag' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await flush();
    expect(screen.getByText('Type one amount, like 250 g or 1 l.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Use the usual sizes' }));
    await flush();
    expect(onSavePacks).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'cream' }), null);
    // Putting the usual sizes back isn't a correction.
    expect(tracker.track).not.toHaveBeenCalledWith('catalog_override_saved', expect.anything());
  });

  it('FR-004: a failed pack save says so', async () => {
    setup({ packs: await packData(keys), onSavePacks: vi.fn(async () => 'failed' as const) });
    fireEvent.click(screen.getByRole('button', { name: 'Edit Heavy cream' }));
    await flush();
    fireEvent.click(screen.getByRole('link', { name: /Store size/ }));
    await flush();
    fireEvent.change(screen.getByLabelText('Pack size'), { target: { value: '30 cl' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await flush();
    expect(screen.getByText("Couldn't update. Try again.")).toBeTruthy();
  });

  it('has no Store size for items the catalog does not know', async () => {
    setup({ items: [groceryItem({ id: 'zaatar', name: "Za'atar", catalog_key: null, quantity: 50, unit: 'g', aisle: 'other' })], packs: await packData(keys) });
    fireEvent.click(screen.getByRole('button', { name: "Edit Za'atar" }));
    await flush();
    expect(screen.getByRole('heading', { name: 'Edit item' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: /Store size/ })).toBeNull();
  });

  it('offline: Edit, Clear all and the settings are off; the sheet still shows the choice', async () => {
    setup({ packs: await packData(keys) });
    act(() => onlineManager.setOnline(false));
    expect(screen.getByRole('button', { name: 'Edit Heavy cream' }).getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByRole('button', { name: 'Clear all items' }).getAttribute('aria-disabled')).toBe('true');
    await openSettings();
    expect(screen.getByRole('button', { name: 'US stores' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('group', { name: 'Where do you shop?' }).getAttribute('aria-disabled')).toBe('true');
  });
});
