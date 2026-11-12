// Spec 026 FR-002: the full activity list, "All · AI only" (spec 028 FR-006), filterable by person and, under AI only, by assistant.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';
import { ToastProvider } from '@cocon/ui';
import type { ActivityEntry } from '@cocon/schemas';
import { alex, fakeTracker, gabriel, mia } from '../../test/fakes';
import { ActivityScreen } from './ActivityScreen';
import { expectAccessible } from '../../test/axe';

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
  const withToast = (ui: ReactElement) => render(<ToastProvider>{ui}</ToastProvider>);
  withToast(
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
  it('lists entries, with pills for the people who have some; assistants only under AI only', async () => {
    const { onFilter } = setup();
    expect(screen.getByRole('heading', { name: 'Activity' })).toBeTruthy();
    expect(screen.getByText('Alex ticked 2 items')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Gabriel/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Claude' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Mia/ }));
    expect(onFilter).toHaveBeenCalledWith({ actor: mia.user_id });
    fireEvent.click(screen.getByRole('button', { name: 'AI only' }));
    expect(onFilter).toHaveBeenLastCalledWith({ ai: true });
    // Spec 030 SC-001.
    await expectAccessible();
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

  // Spec 053 FR-015, FR-018, FR-021.
  it('a list that couldn\'t load keeps its skeleton, and a warn toast offers Try again', () => {
    const onRetry = vi.fn();
    setup({ entries: undefined, failed: true, onRetry });
    expect(screen.getByRole('progressbar', { name: 'Loading activity' })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe("Couldn't load activity. Check your connection and try again.");
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('Show more reads Loading… while the next page loads, and a failed page is a toast; the entries stay', async () => {
    const onShowMore = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    setup({ hasMore: true, onShowMore });
    fireEvent.click(screen.getByRole('button', { name: 'Show more' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe("Couldn't load more activity. Check your connection and try again."));
    expect(screen.getByText('Alex ticked 2 items')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(onShowMore).toHaveBeenCalledTimes(2));
    cleanup();
    setup({ hasMore: true, loadingMore: true });
    expect(screen.getByRole('button', { name: 'Loading…' }).getAttribute('aria-disabled') ?? screen.getByRole('button', { name: 'Loading…' }).hasAttribute('disabled')).toBeTruthy();
  });
});
