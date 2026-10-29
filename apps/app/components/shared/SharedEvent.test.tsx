// Spec 042 FR-005: the public shared event page `/e/[token]` (OC-CalEvent.md › Shared event page).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SharedEvent } from './SharedEvent';

afterEach(cleanup);

describe('Shared event page', () => {
  it('shows the title, who, day, time and place, view only', () => {
    render(
      <SharedEvent
        load={{ kind: 'shared', event: { title: 'Baby music class', when: { title: 'Saturday, Oct 31', sub: 'Morning · about 09:00–12:00' }, place: 'Little Notes studio', with: 'With James' } }}
        onRetry={vi.fn()}
      />,
    );
    expect(screen.getByText('View only')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Baby music class' })).toBeTruthy();
    for (const text of ['With James', 'Saturday, Oct 31', 'Morning · about 09:00–12:00', 'Little Notes studio']) expect(screen.getByText(text)).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('says when the link no longer works', () => {
    render(<SharedEvent load={{ kind: 'not_shared' }} onRetry={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'This event is no longer shared.' })).toBeTruthy();
    expect(screen.getByText('Ask the person who sent it for a new link.')).toBeTruthy();
  });

  it('offers Try again when it could not load', () => {
    const onRetry = vi.fn();
    render(<SharedEvent load="failed" onRetry={onRetry} />);
    expect(screen.getByRole('heading', { name: "We couldn't open this event." })).toBeTruthy();
    expect(screen.getByText('Check your connection and try again.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('shows a placeholder while loading', () => {
    render(<SharedEvent load={undefined} onRetry={vi.fn()} />);
    expect(screen.getByRole('progressbar', { name: 'Loading the event' })).toBeTruthy();
  });
});
