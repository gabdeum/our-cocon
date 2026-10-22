// Spec 022 (design/ui/OC-AddGroceries.md): US1 untick what you have, US2 the merge note, US3 the
// success state and Undo, and the edge cases (nothing ticked, one item, offline, a failed add).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { onlineManager } from '@tanstack/react-query';
import { AddGroceriesSheet, type AddGroceriesApi } from './AddGroceriesSheet';
import { recipeGroceryLines, type AddedFromRecipe } from '../../lib/add-from-recipe';
import { defaultPanelChoices } from '../../lib/recipe-choices';
import type { GroceryItem } from '../../lib/groceries';
import { fakeTracker, flush, groceryItem } from '../../test/fakes';
import { quicheDetail } from '../../test/quiche-detail';

beforeEach(() => onlineManager.setOnline(true));
afterEach(cleanup);

const { lines } = recipeGroceryLines(quicheDetail, { servings: 6, version: null, options: [], ...defaultPanelChoices, scaledBy: null });
const added: AddedFromRecipe = { addedIds: ['a'], merges: [] };

function setup({ list = [], api = {} }: { list?: GroceryItem[]; api?: Partial<AddGroceriesApi> } = {}) {
  const tracker = fakeTracker();
  const full: AddGroceriesApi = { add: vi.fn().mockResolvedValue(added), undo: vi.fn().mockResolvedValue(true), ...api };
  const onClose = vi.fn();
  const onSeeList = vi.fn();
  render(<AddGroceriesSheet recipeName="Leek & bacon quiche" servings="6" lines={lines} list={list} facts={quicheDetail.facts} api={full} tracker={tracker} onClose={onClose} onSeeList={onSeeList} />);
  return { tracker, api: full, onClose, onSeeList };
}
const row = (name: RegExp) => screen.getByRole('checkbox', { name });
const button = (name: string | RegExp) => screen.getByRole('button', { name });

describe('Add to groceries', () => {
  it('US1: all 8 ticked with amounts; untick butter, eggs and nutmeg → "Add 5 items"', () => {
    setup();
    expect(screen.getByText('Add to groceries')).toBeTruthy();
    expect(screen.getByText('Leek & bacon quiche · serves 6. Untick what you already have at home.')).toBeTruthy();
    expect(screen.getByText('From this recipe')).toBeTruthy();
    expect(screen.getByText('All ticked to start')).toBeTruthy();
    const rows = screen.getAllByRole('checkbox');
    expect(rows).toHaveLength(8);
    expect(rows.every((r) => r.getAttribute('aria-checked') === 'true')).toBe(true);
    expect(screen.getByText('2 · 300 g')).toBeTruthy();
    expect(button('Add 8 items')).toBeTruthy();
    fireEvent.click(row(/^Butter/));
    fireEvent.click(row(/^Eggs/));
    fireEvent.click(row(/^Nutmeg/));
    expect(row(/^Butter/).getAttribute('aria-checked')).toBe('false');
    expect(button('Add 5 items')).toBeTruthy();
  });

  it('edge: nothing ticked is disabled "Nothing selected"; one reads "Add 1 item"', () => {
    const { api } = setup();
    for (const r of screen.getAllByRole('checkbox')) fireEvent.click(r);
    const nothing = button('Nothing selected');
    expect(nothing.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(nothing);
    expect(api.add).not.toHaveBeenCalled();
    fireEvent.click(row(/^Butter/));
    expect(button('Add 1 item')).toBeTruthy();
  });

  it('US2: the cream row says it is already on the list, only while ticked', () => {
    setup({ list: [groceryItem({ id: 'cream', name: 'Heavy cream', catalog_key: 'heavy_cream', quantity: 100, unit: 'ml' })] });
    expect(screen.getByText('Already on the list (100 ml) → will be 400 ml')).toBeTruthy();
    fireEvent.click(row(/^Heavy cream/));
    expect(screen.queryByText(/Already on the list/)).toBeNull();
  });

  it('US3: Add shows "Added 5 items to groceries" with Undo, Back to recipe and See the list', async () => {
    const { api, tracker, onClose, onSeeList } = setup();
    fireEvent.click(row(/^Butter/));
    fireEvent.click(row(/^Eggs/));
    fireEvent.click(row(/^Nutmeg/));
    fireEvent.click(button('Add 5 items'));
    await flush();
    expect(api.add).toHaveBeenCalledWith(lines.filter((l) => !['Butter', 'Eggs', 'Nutmeg'].includes(l.name)));
    expect(tracker.track).toHaveBeenCalledWith('groceries_added_from_recipe', { ingredient_count: 5, unticked_count: 3 });
    expect(screen.getByText('Added 5 items to groceries')).toBeTruthy();
    expect(screen.getByText('The whole family can see them now.')).toBeTruthy();
    expect(button('See the list')).toBeTruthy();
    expect(button('Back to recipe')).toBeTruthy();
    fireEvent.click(button('Undo'));
    await flush();
    expect(api.undo).toHaveBeenCalledWith(added);
    expect(button('Add 5 items')).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
    expect(onSeeList).not.toHaveBeenCalled();
  });

  it('unticks everything at once, then ticks it all back', () => {
    setup();
    fireEvent.click(button('Untick all'));
    expect(screen.getAllByRole('checkbox').every((r) => r.getAttribute('aria-checked') === 'false')).toBe(true);
    expect(button('Nothing selected')).toBeTruthy();
    fireEvent.click(row(/^Butter/));
    fireEvent.click(button('Untick all'));
    expect(button('Nothing selected')).toBeTruthy();
    fireEvent.click(button('Tick all'));
    expect(button('Add 8 items')).toBeTruthy();
  });

  it.each(['See the list', 'Back to recipe'])('"%s" takes the sheet away before leaving, so it never stays over the next screen', async (label) => {
    const { onSeeList, onClose } = setup();
    fireEvent.click(button('Add 8 items'));
    await flush();
    fireEvent.click(button(label));
    expect(label === 'See the list' ? onSeeList : onClose).toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('says what to do when adding or undoing fails', async () => {
    setup({ api: { add: vi.fn().mockResolvedValueOnce(null).mockResolvedValue(added), undo: vi.fn().mockResolvedValue(false) } });
    fireEvent.click(button('Add 8 items'));
    await flush();
    expect(screen.getByText("Couldn't add these items. Check your connection and try again.")).toBeTruthy();
    fireEvent.click(button('Add 8 items'));
    await flush();
    fireEvent.click(button('Undo'));
    await flush();
    expect(screen.getByText("Couldn't undo. Try again.")).toBeTruthy();
    expect(screen.getByText('Added 8 items to groceries')).toBeTruthy();
  });

  it('offline: the list stays readable but Add is off', () => {
    onlineManager.setOnline(false);
    setup();
    expect(button('Add 8 items').getAttribute('aria-disabled')).toBe('true');
  });
});
