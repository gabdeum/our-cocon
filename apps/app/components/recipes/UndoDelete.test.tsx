// Spec 018 (OC-Delete › After deleting): Recipes shows "Recipe deleted" with "Undo" in the toast for 8 s.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { fakeTracker, flush } from '../../test/fakes';
import { TOAST_ACTION_MS, ToastProvider } from '../../lib/toast';
import { useUndoDelete } from './UndoDelete';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function Recipes(p: Parameters<typeof useUndoDelete>[0]) {
  useUndoDelete(p);
  return null;
}

function setup(onUndo = vi.fn(async () => undefined)) {
  const tracker = fakeTracker();
  const onShown = vi.fn();
  render(
    <ToastProvider>
      <Recipes deleted="r1" onUndo={onUndo} tracker={tracker} onShown={onShown} />
    </ToastProvider>,
  );
  return { tracker, onUndo, onShown };
}

describe('Recipe deleted · Undo', () => {
  it('Undo restores the recipe', async () => {
    const { tracker, onUndo, onShown } = setup();
    expect(onShown).toHaveBeenCalledOnce();
    expect(screen.getByRole('status').textContent).toContain('Recipe deleted');
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await flush();
    expect(onUndo).toHaveBeenCalledOnce();
    expect(tracker.track).toHaveBeenCalledWith('recipe_restored', { days_since_delete: 0 });
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('goes away after 8 s', () => {
    vi.useFakeTimers();
    setup();
    act(() => vi.advanceTimersByTime(TOAST_ACTION_MS - 1));
    expect(screen.queryByRole('status')).not.toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('says what to do when Undo fails', async () => {
    const { tracker } = setup(vi.fn(async () => Promise.reject(new Error('offline'))));
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await flush();
    expect(screen.getByText("Couldn't restore. Try again.")).toBeTruthy();
    expect(tracker.track).not.toHaveBeenCalled();
  });
});
