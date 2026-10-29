// Spec 026 on Home: the latest AI changes with who asked for them (US1), Undo (US2), and the
// "Mia ticked 2 of these items. Undo the rest?" edge case.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ToastProvider } from '../../lib/toast';
import type { ActivityEntry } from '@cocon/schemas';
import { alex, fakeTracker, flush, gabriel, mia } from '../../test/fakes';
import type { UndoOutcome } from '../../lib/activity';
import { ActivitySection } from './ActivitySection';

afterEach(cleanup);

const now = new Date('2026-10-26T16:00:00Z');
const groceries: ActivityEntry = {
  key: '11111111-1111-4111-8111-111111111111',
  actor_id: alex.user_id,
  source: 'chatgpt',
  kind: 'groceries_added',
  created_at: '2026-10-26T12:00:00Z',
  count: 6,
  names: ['Bread', 'Butter', 'Carrots'],
  recipe_id: null,
  recipe_name: null,
  event_id: null,
  event_name: null,
  undone_by: null,
  undone_at: null,
  undo_action: null,
  can_undo: true,
  can_restore: false,
};
const soup: ActivityEntry = { ...groceries, key: '22222222-2222-4222-8222-222222222222', kind: 'recipe_created', count: 1, names: [], recipe_name: 'Pumpkin soup', created_at: '2026-10-26T15:00:00Z' };

function setup(onUndo: (entry: ActivityEntry, skip: boolean) => Promise<UndoOutcome>, entries = [soup, groceries], readOnly = false) {
  const tracker = fakeTracker();
  const onSeeAll = vi.fn();
  const undo = vi.fn(onUndo);
  render(<ActivitySection entries={entries} members={[gabriel, alex, mia]} tracker={tracker} onUndo={undo} onSeeAll={onSeeAll} now={now} readOnly={readOnly} />, { wrapper: ToastProvider });
  return { tracker, onSeeAll, undo };
}
const done = (kind: ActivityEntry['kind']): UndoOutcome => ({ status: 'done', result: { applied: true, kind, done: 6, conflicts: [] } });

describe('Home › activity', () => {
  it('US1: says what the AI did, who asked, and when, with Undo and See all', () => {
    const { onSeeAll } = setup(async () => done('groceries_added'));
    expect(screen.getByText('6 items added to Groceries')).toBeTruthy();
    expect(screen.getByText('Added by Alex via ChatGPT · 4 h ago')).toBeTruthy();
    expect(screen.getByText('New: Pumpkin soup')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'See all' }));
    expect(onSeeAll).toHaveBeenCalled();
  });

  it('US2: Undo undoes it and says "Undone"', async () => {
    const { undo, tracker } = setup(async () => done('groceries_added'));
    fireEvent.click(screen.getByRole('button', { name: 'Undo: 6 items added to Groceries' }));
    await flush();
    expect(undo).toHaveBeenCalledWith(groceries, false);
    expect(tracker.track).toHaveBeenCalledWith('ai_change_undone', { kind: 'groceries_added' });
    expect(screen.getByText('Undone')).toBeTruthy();
  });

  it('edge: Mia ticked 2 of these items, so it asks, then undoes the rest', async () => {
    const { undo } = setup(async (_e, skip) => (skip ? done('groceries_added') : { status: 'conflicts', conflicts: [{ kind: 'ticked', by: mia.user_id, count: 2 }] }));
    fireEvent.click(screen.getByRole('button', { name: 'Undo: 6 items added to Groceries' }));
    await flush();
    expect(screen.getByRole('heading', { name: 'Undo the rest?' })).toBeTruthy();
    expect(screen.getByText("Mia ticked 2 of these items. They'll stay as they are.")).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Undo the rest' }));
    await flush();
    expect(undo).toHaveBeenLastCalledWith(groceries, true);
    expect(screen.getByText('Undone')).toBeTruthy();
  });

  it('FR-004: Restore for an AI delete', async () => {
    const deleted: ActivityEntry = { ...soup, kind: 'recipe_deleted', can_undo: false, can_restore: true };
    const { tracker } = setup(async () => done('recipe_deleted'), [deleted]);
    expect(screen.getByText('Deleted by Alex via ChatGPT · 1 h ago')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Restore: Deleted: Pumpkin soup' }));
    await flush();
    expect(tracker.track).toHaveBeenCalledWith('ai_delete_restored', {});
    expect(screen.getByText('Restored')).toBeTruthy();
  });

  it('offline: Undo is off', () => {
    const { undo } = setup(async () => done('groceries_added'), [groceries], true);
    fireEvent.click(screen.getByRole('button', { name: 'Undo: 6 items added to Groceries' }));
    expect(undo).not.toHaveBeenCalled();
  });

  it('no AI activity: hidden', () => {
    setup(async () => done('other'), []);
    expect(screen.queryByText('See all')).toBeNull();
  });
});
