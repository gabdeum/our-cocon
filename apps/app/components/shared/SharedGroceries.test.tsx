// Spec 072 US2–US4 on the public shared list (design/ui/OC-SharedGroceries.md).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { SharedGroceriesResponse } from '@cocon/schemas';
import { ToastProvider } from '../../lib/toast';
import { SharedGroceries, type SharedGroceriesProps } from './SharedGroceries';
import { expectAccessible } from '../../test/axe';

vi.mock('react-native', async (actual) => ({ ...(await actual<typeof import('react-native')>()), useWindowDimensions: () => ({ width: 390, height: 844, scale: 2, fontScale: 1 }) }));
vi.mock('expo-linking', () => ({ createURL: (p: string) => `ourcocon://${p}` }));
vi.mock('expo-clipboard', () => ({ setStringAsync: vi.fn() }));

afterEach(() => cleanup());

const onion = '00000000-0000-4000-8000-0000000000a1';
const salt = '00000000-0000-4000-8000-0000000000a2';
const row = (name: string) => screen.getByRole('checkbox', { name: new RegExp(name) });
const list = (over: Partial<SharedGroceriesResponse> = {}): SharedGroceriesResponse => ({
  family_name: 'The Demanges',
  can_edit: true,
  expires_at: null,
  settings: { store_profile: 'eu', round_to_packs: false, units: 'metric' },
  items: [
    { id: onion, name: 'Onions', catalog_key: 'onion', quantity: 2, unit: null, aisle: 'produce', checked: false, recipe_detail: null },
    { id: salt, name: 'Salt', catalog_key: null, quantity: null, unit: null, aisle: 'spices_baking', checked: true, recipe_detail: null },
  ],
  packs: {},
  ...over,
});

function setup(over: Partial<SharedGroceriesProps> = {}) {
  const props = {
    load: { kind: 'shared', list: list() } as SharedGroceriesProps['load'],
    tracker: { track: vi.fn() },
    use24h: true,
    onRetry: vi.fn(),
    onAdd: vi.fn<SharedGroceriesProps['onAdd']>().mockResolvedValue('ok'),
    onToggle: vi.fn<SharedGroceriesProps['onToggle']>().mockResolvedValue('ok'),
    onClear: vi.fn<SharedGroceriesProps['onClear']>().mockResolvedValue('ok'),
    onRestore: vi.fn<SharedGroceriesProps['onRestore']>().mockResolvedValue('ok'),
    ...over,
  };
  render(<SharedGroceries {...props} />, { wrapper: ToastProvider });
  return props;
}

describe('Shared grocery list', () => {
  it('shows the list by aisle, with the family and no end (US2)', async () => {
    const { tracker } = setup();
    expect(screen.getByText('Shared list')).toBeTruthy();
    expect(screen.getByText('From the Demanges family')).toBeTruthy();
    expect(screen.getByText('Produce')).toBeTruthy();
    expect(screen.getByText('Onions: 2 pieces')).toBeTruthy();
    expect(screen.getByText('Spices & baking')).toBeTruthy();
    expect(tracker.track).toHaveBeenCalledWith('shared_groceries_viewed', {});
    // Spec 030 SC-001.
    await expectAccessible();
  });

  it('adds what is typed (FR-004)', async () => {
    const { onAdd, tracker } = setup();
    fireEvent.change(screen.getByLabelText('Add an item'), { target: { value: '2 lemons' } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Add item' })));
    expect(onAdd).toHaveBeenCalledWith('2 lemons');
    expect(tracker.track).toHaveBeenCalledWith('shared_grocery_added', {});
    expect((screen.getByLabelText('Add an item') as HTMLInputElement).value).toBe('');
  });

  it('ticks a row, and removes one with Undo (FR-005)', async () => {
    const { onToggle, onClear, onRestore, tracker } = setup();
    await act(async () => fireEvent.click(row('Onions')));
    expect(onToggle).toHaveBeenCalledWith([onion], true);
    expect(tracker.track).toHaveBeenCalledWith('shared_grocery_ticked', {});
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Remove Onions' })));
    expect(onClear).toHaveBeenCalledWith([onion]);
    expect(tracker.track).toHaveBeenCalledWith('shared_grocery_removed', {});
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Undo' })));
    expect(onRestore).toHaveBeenCalledWith([onion]);
  });

  it('says why a write was refused', async () => {
    const { tracker } = setup({ onAdd: vi.fn<SharedGroceriesProps['onAdd']>().mockResolvedValue('read_only') });
    fireEvent.change(screen.getByLabelText('Add an item'), { target: { value: 'eggs' } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Add item' })));
    expect(screen.getByText('The list is view only now.')).toBeTruthy();
    expect(tracker.track).not.toHaveBeenCalledWith('shared_grocery_added', {});
  });

  it('is view only with editing off (US3)', () => {
    const { onToggle } = setup({ load: { kind: 'shared', list: list({ can_edit: false }) } });
    expect(screen.getByText('View only')).toBeTruthy();
    expect(screen.queryByLabelText('Add an item')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Remove Onions' })).toBeNull();
    fireEvent.click(screen.getByText('Onions: 2 pieces'));
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('says when the link ends', () => {
    const tonight = new Date(new Date().setHours(23, 59, 0, 0)).toISOString();
    setup({ load: { kind: 'shared', list: list({ expires_at: tonight }) } });
    expect(screen.getByText('From the Demanges family · ends today at 23:59')).toBeTruthy();
  });

  it('says when the list is empty', () => {
    setup({ load: { kind: 'shared', list: list({ items: [] }) } });
    expect(screen.getByText('The list is empty.')).toBeTruthy();
    expect(screen.getByText('Add what you need above.')).toBeTruthy();
  });

  it('reads "no longer shared" for a stopped or ended link (US4)', () => {
    setup({ load: { kind: 'not_shared' } });
    expect(screen.getByText('This list is no longer shared.')).toBeTruthy();
    expect(screen.getByText('Ask the person who sent it for a new link.')).toBeTruthy();
  });

  it('offers to try again when it can\'t load', () => {
    const { onRetry } = setup({ load: 'failed' });
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalled();
  });
});
