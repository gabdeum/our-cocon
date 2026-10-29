// Spec 041 FR-009: the save toast shows over the screen below the closed sheet, for 8 s with its
// Undo; Undo runs once and closes it. Spec 042 (032-later L99): a failed Undo says so.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { TOAST_ACTION_MS, ToastProvider, useToast } from './toast';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function Screen({ onUndo }: { onUndo: () => Promise<unknown> }) {
  const toast = useToast();
  return (
    <button onClick={() => toast.show({ text: 'Poker night added for tonight, 18:00–22:00.', onUndo })}>save</button>
  );
}

describe('ToastProvider', () => {
  it('shows the toast for 8 s', () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <Screen onUndo={vi.fn(async () => undefined)} />
      </ToastProvider>,
    );
    expect(screen.queryByRole('status')).toBeNull();
    fireEvent.click(screen.getByText('save'));
    expect(screen.getByRole('status').textContent).toContain('Poker night added for tonight, 18:00–22:00.');
    act(() => vi.advanceTimersByTime(TOAST_ACTION_MS - 1));
    expect(screen.queryByRole('status')).not.toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('Undo runs once and closes it', () => {
    const onUndo = vi.fn(async () => undefined);
    render(
      <ToastProvider>
        <Screen onUndo={onUndo} />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText('save'));
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('says so when Undo fails, with nothing more to tap', async () => {
    render(
      <ToastProvider>
        <Screen onUndo={vi.fn(async () => Promise.reject(new Error('offline')))} />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText('save'));
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await act(async () => undefined);
    expect(screen.getByRole('status').textContent).toBe("Couldn't undo. Check your connection and try again.");
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
  });
});
