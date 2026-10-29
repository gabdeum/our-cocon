// Toast README: one sage toast at the top, over any screen, a sheet included; it goes by itself
// (5 s, 8 s with a button), and a new one replaces it.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { BottomSheet } from './BottomSheet';
import { TOAST_ACTION_MS, TOAST_MS, ToastProvider, useToast, type ToastRequest } from './Toast';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function Show({ toast, label = 'show' }: { toast: ToastRequest; label?: string }) {
  const { show } = useToast();
  return <button onClick={() => show(toast)}>{label}</button>;
}

describe('ToastProvider', () => {
  it('shows a toast for 5 s', () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <Show toast={{ text: 'Link copied' }} />
      </ToastProvider>,
    );
    expect(screen.queryByRole('status')).toBeNull();
    fireEvent.click(screen.getByText('show'));
    expect(screen.getByRole('status').textContent).toBe('Link copied');
    act(() => vi.advanceTimersByTime(TOAST_MS - 1));
    expect(screen.queryByRole('status')).not.toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('with a button: 8 s, and tapping it closes the toast', () => {
    vi.useFakeTimers();
    const onAction = vi.fn();
    render(
      <ToastProvider>
        <Show toast={{ text: 'Onion removed.', actionLabel: 'Undo', onAction }} />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText('show'));
    act(() => vi.advanceTimersByTime(TOAST_ACTION_MS - 1));
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(onAction).toHaveBeenCalledOnce();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('a new toast replaces the old one, with its own time', () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <Show toast={{ text: 'Link copied' }} label="first" />
        <Show toast={{ text: "Couldn't save. Try again.", tone: 'warn' }} label="second" />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText('first'));
    act(() => vi.advanceTimersByTime(TOAST_MS - 1000));
    fireEvent.click(screen.getByText('second'));
    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(screen.getByRole('status').textContent).toBe("Couldn't save. Try again.");
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.queryByRole('status')).not.toBeNull();
  });

  it('draws once, on the open sheet', () => {
    render(
      <ToastProvider>
        <BottomSheet visible title="Share" closeLabel="Close" onClose={() => undefined}>
          <Show toast={{ text: 'Link copied' }} />
        </BottomSheet>
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText('show'));
    const toasts = screen.getAllByRole('status');
    expect(toasts).toHaveLength(1);
    expect(screen.getByRole('dialog').parentElement?.parentElement?.contains(toasts[0] as Node)).toBe(true);
  });
});
