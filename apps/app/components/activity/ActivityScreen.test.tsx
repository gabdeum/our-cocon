// Spec 026 FR-002: the full activity list, "All · AI only" (spec 028 FR-006), filterable by person and, under AI only, by assistant.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ActivityEntry } from '@cocon/schemas';
import { alex, fakeTracker, gabriel, mia } from '../../test/fakes';
import { ActivityScreen } from './ActivityScreen';

afterEach(cleanup);

const entry: ActivityEntry = {
  key: '11111111-1111-4111-8111-111111111111',
  actor_id: alex.user_id,
  source: 'chatgpt',
  kind: 'groceries_ticked',
  created_at: '2026-10-26T12:00:00Z',
  count: 2,
  names: ['Bread', 'Milk'],
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

function setup(over: Partial<Parameters<typeof ActivityScreen>[0]> = {}) {
  const onFilter = vi.fn();
  render(
    <ActivityScreen
      entries={[entry]}
      members={[gabriel, alex, mia]}
      actors={[alex.user_id, mia.user_id]}
      sources={['chatgpt', 'claude', 'other']}
      filter={{}}
      onFilter={onFilter}
      onRetry={vi.fn()}
      onShowMore={vi.fn()}
      onBack={vi.fn()}
      tracker={fakeTracker()}
      onUndo={vi.fn()}
      now={new Date('2026-10-26T16:00:00Z')}
      {...over}
    />,
  );
  return { onFilter };
}

describe('Activity', () => {
  it('lists entries, with pills for the people who have some; assistants only under AI only', () => {
    const { onFilter } = setup();
    expect(screen.getByRole('heading', { name: 'Activity' })).toBeTruthy();
    expect(screen.getByText('Alex ticked 2 items')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Gabriel/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Claude' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Mia/ }));
    expect(onFilter).toHaveBeenCalledWith({ actor: mia.user_id });
    fireEvent.click(screen.getByRole('button', { name: 'AI only' }));
    expect(onFilter).toHaveBeenLastCalledWith({ ai: true });
  });

  it('AI only: the assistant pills; tapping a selected one clears it; All drops it', () => {
    const { onFilter } = setup({ filter: { ai: true, source: 'claude' } });
    fireEvent.click(screen.getByRole('button', { name: 'Claude' }));
    expect(onFilter).toHaveBeenCalledWith({ ai: true, source: null });
    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    expect(onFilter).toHaveBeenLastCalledWith({ actor: null });
  });

  it('empty, and nothing matching the filters', () => {
    setup({ entries: [] });
    expect(screen.getByText('No activity yet')).toBeTruthy();
    cleanup();
    setup({ entries: [], filter: { ai: true } });
    expect(screen.getByText('No AI changes yet')).toBeTruthy();
    cleanup();
    setup({ entries: [], filter: { actor: mia.user_id } });
    expect(screen.getByText('Nothing matches these filters.')).toBeTruthy();
  });
});
