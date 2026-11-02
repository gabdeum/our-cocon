// Home's Latest activity (spec 028 US5, FR-006) with spec 026: everyone's latest changes, "All · AI
// only", who and when (US1), Undo (US2), and the "Mia ticked 2 of these items. Undo the rest?" edge case.
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
  from_recipe_name: null,
  event_id: null,
  event_name: null,
  event_when: null,
  event_secret: false,
  undone_by: null,
  undone_at: null,
  undo_action: null,
  can_undo: true,
  can_restore: false,
};
const soup: ActivityEntry = { ...groceries, key: '22222222-2222-4222-8222-222222222222', kind: 'recipe_created', count: 1, names: [], recipe_name: 'Pumpkin soup', created_at: '2026-10-26T15:00:00Z' };

const ticked: ActivityEntry = { ...groceries, key: '33333333-3333-4333-8333-333333333333', source: 'app', actor_id: gabriel.user_id, kind: 'groceries_ticked', count: 4, can_undo: false };

function setup(onUndo: (entry: ActivityEntry, skip: boolean) => Promise<UndoOutcome>, entries = [soup, ticked, groceries], readOnly = false, show: 'all' | 'ai' = 'all') {
  const tracker = fakeTracker();
  const onSeeAll = vi.fn();
  const onShow = vi.fn();
  const undo = vi.fn(onUndo);
  render(
    <ActivitySection entries={entries} members={[gabriel, alex, mia]} tracker={tracker} onUndo={undo} onSeeAll={onSeeAll} now={now} readOnly={readOnly} show={show} onShow={onShow} />,
    { wrapper: ToastProvider },
  );
  return { tracker, onSeeAll, onShow, undo };
}
const done = (kind: ActivityEntry['kind']): UndoOutcome => ({ status: 'done', result: { applied: true, kind, done: 6, conflicts: [] } });

describe('Home › activity', () => {
  it('US5: everyone\'s changes, AI ones "via" their assistant with Undo, then See all activity', () => {
    const { onSeeAll } = setup(async () => done('groceries_added'));
    expect(screen.getByRole('heading', { name: 'Latest activity' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'All' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getAllByRole('listitem').map((r) => r.textContent)).toEqual([
      'AIAlex added Pumpkin soupRecipes · via ChatGPT · 1 h agoUndo',
      'GGabriel ticked 4 itemsGroceries · 4 h ago',
      'AIAlex added 6 itemsGroceries · via ChatGPT · 4 h agoUndo',
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'See all activity' }));
    expect(onSeeAll).toHaveBeenCalled();
  });

  it('US5: "AI only" asks for AI changes; none says so and keeps the toggle', () => {
    const { onShow } = setup(async () => done('other'));
    fireEvent.click(screen.getByRole('button', { name: 'AI only' }));
    expect(onShow).toHaveBeenCalledWith('ai');
    cleanup();
    setup(async () => done('other'), [], false, 'ai');
    expect(screen.getByText('No AI changes yet.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'AI only' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('US2: Undo undoes it and says "Undone"', async () => {
    const { undo, tracker } = setup(async () => done('groceries_added'));
    fireEvent.click(screen.getByRole('button', { name: 'Undo: Alex added 6 items' }));
    await flush();
    expect(undo).toHaveBeenCalledWith(groceries, false);
    expect(tracker.track).toHaveBeenCalledWith('ai_change_undone', { kind: 'groceries_added' });
    expect(screen.getByText('Undone')).toBeTruthy();
  });

  it('edge: Mia ticked 2 of these items, so it asks, then undoes the rest', async () => {
    const { undo } = setup(async (_e, skip) => (skip ? done('groceries_added') : { status: 'conflicts', conflicts: [{ kind: 'ticked', by: mia.user_id, count: 2 }] }));
    fireEvent.click(screen.getByRole('button', { name: 'Undo: Alex added 6 items' }));
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
    expect(screen.getByText('Recipes · via ChatGPT · 1 h ago')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Restore: Alex deleted Pumpkin soup' }));
    await flush();
    expect(tracker.track).toHaveBeenCalledWith('ai_delete_restored', {});
    expect(screen.getByText('Restored')).toBeTruthy();
  });

  it('offline: Undo is off', () => {
    const { undo } = setup(async () => done('groceries_added'), [groceries], true);
    fireEvent.click(screen.getByRole('button', { name: 'Undo: Alex added 6 items' }));
    expect(undo).not.toHaveBeenCalled();
  });

  it('no activity at all: hidden', () => {
    setup(async () => done('other'), []);
    expect(screen.queryByText('Latest activity')).toBeNull();
  });
});
