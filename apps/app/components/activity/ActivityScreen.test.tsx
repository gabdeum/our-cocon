// Spec 026 FR-002: the full AI activity list, filterable by person and assistant.
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

describe('AI activity', () => {
  it('lists entries, with pills for the people and assistants that have some', () => {
    const { onFilter } = setup();
    expect(screen.getByRole('heading', { name: 'AI activity' })).toBeTruthy();
    expect(screen.getByText('2 items ticked')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Gabriel/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Mia/ }));
    expect(onFilter).toHaveBeenCalledWith({ actor: mia.user_id });
    fireEvent.click(screen.getByRole('button', { name: 'Other' }));
    expect(onFilter).toHaveBeenLastCalledWith({ source: 'other' });
  });

  it('tapping a selected pill clears it', () => {
    const { onFilter } = setup({ filter: { source: 'claude' } });
    fireEvent.click(screen.getByRole('button', { name: 'Claude' }));
    expect(onFilter).toHaveBeenCalledWith({ source: null });
  });

  it('empty, and nothing matching the filters', () => {
    setup({ entries: [] });
    expect(screen.getByText('No AI changes yet')).toBeTruthy();
    cleanup();
    setup({ entries: [], filter: { actor: mia.user_id } });
    expect(screen.getByText('Nothing matches these filters.')).toBeTruthy();
  });
});
