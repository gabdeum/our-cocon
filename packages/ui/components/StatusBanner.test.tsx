import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { StatusBanner } from './StatusBanner';

afterEach(cleanup);

describe('StatusBanner', () => {
  it('is a live status with its trailing action', () => {
    const onAction = vi.fn();
    render(<StatusBanner message="Alex just changed this recipe" actionLabel="Reload" onAction={onAction} />);
    expect(screen.getByRole('status').textContent).toContain('Alex just changed this recipe');
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(onAction).toHaveBeenCalledOnce();
  });

  it('shows the offline tone without a button', () => {
    render(<StatusBanner tone="warn" message="You're offline." />);
    expect(screen.getByRole('status').textContent).toBe("You're offline.");
    expect(screen.queryByRole('button')).toBeNull();
  });
});
