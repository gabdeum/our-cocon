// Toast README: one sage toast at the top, over any screen, a sheet included; it goes by itself
// (5 s, 8 s with a button), and a new one replaces it. Spec 053: a round ✕ on every toast, round
// icon buttons for Undo and Try again, and a failure stays until it's closed.
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

  it('✕ hides it at once and says so, with its tone', () => {
    const onDismiss = vi.fn();
    render(
      <ToastProvider onDismiss={onDismiss}>
        <Show toast={{ text: 'Onion removed.', actionLabel: 'Undo', actionIcon: 'undo', onAction: () => undefined }} />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText('show'));
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('status')).toBeNull();
    expect(onDismiss).toHaveBeenCalledWith('sage');
  });

  it('Undo and Try again are round icon buttons, named', () => {
    const onAction = vi.fn();
    render(
      <ToastProvider>
        <Show toast={{ text: "Couldn't load activity.", tone: 'warn', actionLabel: 'Try again', actionIcon: 'retry', onAction }} />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText('show'));
    const retry = screen.getByRole('button', { name: 'Try again' });
    expect(retry.textContent).toBe('');
    fireEvent.click(retry);
    expect(onAction).toHaveBeenCalledOnce();
  });

  it('a failure stays until closed', () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <Show toast={{ text: "Couldn't save. Try again.", tone: 'warn' }} />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText('show'));
    act(() => vi.advanceTimersByTime(TOAST_ACTION_MS * 10));
    expect(screen.queryByRole('status')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('status')).toBeNull();
  });
});
