// Spec 018 (OC-Delete › After deleting): Recipes shows "Recipe deleted" with "Undo" for 8 s.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { fakeTracker, flush } from '../../test/fakes';
import { UndoDelete } from './UndoDelete';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function setup(onUndo = vi.fn(async () => undefined)) {
  const tracker = fakeTracker();
  const onDone = vi.fn();
  render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 0 } }}>
      <UndoDelete onUndo={onUndo} tracker={tracker} onDone={onDone} />
    </SafeAreaProvider>,
  );
  return { tracker, onUndo, onDone };
}

describe('Recipe deleted · Undo', () => {
  it('Undo restores the recipe', async () => {
    const { tracker, onUndo, onDone } = setup();
    expect(screen.getByRole('status').textContent).toContain('Recipe deleted');
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await flush();
    expect(onUndo).toHaveBeenCalledOnce();
    expect(tracker.track).toHaveBeenCalledWith('recipe_restored', { days_since_delete: 0 });
    expect(onDone).toHaveBeenCalled();
  });

  it('goes away after 8 s', () => {
    vi.useFakeTimers();
    const { onDone } = setup();
    act(() => vi.advanceTimersByTime(7999));
    expect(onDone).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onDone).toHaveBeenCalledOnce();
  });

  it('says what to do when Undo fails', async () => {
    const { tracker } = setup(vi.fn(async () => Promise.reject(new Error('offline'))));
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await flush();
    expect(screen.getByText("Couldn't restore. Try again.")).toBeTruthy();
    expect(tracker.track).not.toHaveBeenCalled();
  });
});
