// Spec 041 FR-009: the save toast shows over the screen below the closed sheet for 5 s, Undo runs
// once and closes it, and the calendar knows it's up (to hide its add button, 032-later L96).
// Spec 042 (032-later L99): a failed Undo says so.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { TOAST_MS, ToastProvider, useToast } from './toast';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function Screen({ onUndo }: { onUndo: () => Promise<unknown> }) {
  const toast = useToast();
  return (
    <>
      <span>{toast.visible ? 'add hidden' : 'add shown'}</span>
      <button onClick={() => toast.show({ text: 'Poker night added for tonight, 18:00–22:00.', onUndo })}>save</button>
    </>
  );
}

describe('ToastProvider', () => {
  it('shows the toast for 5 s while the add button hides', () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <Screen onUndo={vi.fn(async () => undefined)} />
      </ToastProvider>,
    );
    expect(screen.queryByRole('status')).toBeNull();
    fireEvent.click(screen.getByText('save'));
    expect(screen.getByRole('status').textContent).toContain('Poker night added for tonight, 18:00–22:00.');
    expect(screen.getByText('add hidden')).toBeTruthy();
    act(() => vi.advanceTimersByTime(TOAST_MS - 1));
    expect(screen.queryByRole('status')).not.toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByText('add shown')).toBeTruthy();
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
