// Spec 036: the calendar header (title, Today, ‹ ›) and its two popovers, the view menu and the people filter.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { CalendarHeader, type CalendarHeaderProps } from './CalendarHeader';

afterEach(cleanup);

type View = 'month' | 'week' | 'day' | 'agenda';

function setup(over: Partial<CalendarHeaderProps<View>> = {}) {
  const props: CalendarHeaderProps<View> = {
    title: 'October',
    prevLabel: 'Previous month',
    nextLabel: 'Next month',
    onPrev: vi.fn(),
    onNext: vi.fn(),
    todayLabel: 'Today',
    onToday: vi.fn(),
    views: [
      { key: 'month', label: 'Month' },
      { key: 'week', label: 'Week' },
      { key: 'day', label: 'Day' },
      { key: 'agenda', label: 'Agenda' },
    ],
    view: 'month',
    onView: vi.fn(),
    viewsLabel: 'Calendar view',
    viewButtonLabel: 'View: Month',
    chips: [
      { key: 'g', name: 'Gabriel', initial: 'G', color: 'honey', pressed: true },
      { key: 'e', name: 'Eva', initial: 'E', color: 'rose', pressed: false },
      { key: 'everyone', name: 'Everyone', initial: 'All', color: 'everyone', pressed: true },
      { key: 'others', name: 'Others', initial: '', color: 'others', pressed: true },
    ],
    onToggle: vi.fn(),
    onShowAll: vi.fn(),
    peopleLabel: '3 of 4',
    peopleButtonLabel: 'Show events for: Gabriel, Everyone, Others',
    filterLabel: 'Show events for',
    showAllLabel: 'Show all',
    closeLabel: 'Close',
    ...over,
  };
  render(<CalendarHeader {...props} />);
  return props;
}

describe('CalendarHeader', () => {
  it('shows the title as the heading, with named ‹ › and Today', () => {
    const p = setup();
    expect(screen.getByRole('heading', { name: 'October' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    fireEvent.click(screen.getByRole('button', { name: 'Today' }));
    expect(p.onPrev).toHaveBeenCalledOnce();
    expect(p.onNext).toHaveBeenCalledOnce();
    expect(p.onToday).toHaveBeenCalledOnce();
  });

  it('opens the view menu: links, the current one marked as the page; picking one closes it', () => {
    const p = setup({ view: 'week', viewButtonLabel: 'View: Week' });
    const button = screen.getByRole('button', { name: 'View: Week' });
    expect(button.textContent).toBe('Week');
    expect(button.getAttribute('aria-haspopup')).toBe('true');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('navigation', { name: 'Calendar view' })).toBeNull();
    fireEvent.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    const nav = screen.getByRole('navigation', { name: 'Calendar view' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual(['Month', 'Week', 'Day', 'Agenda']);
    expect(links.map((l) => l.getAttribute('aria-current'))).toEqual([null, 'page', null, null]);
    fireEvent.click(within(nav).getByRole('link', { name: 'Agenda' }));
    expect(p.onView).toHaveBeenCalledWith('agenda');
    expect(screen.queryByRole('navigation', { name: 'Calendar view' })).toBeNull();
  });

  it('shows who is shown on the people button, and lists everyone in the filter; ticking keeps it open', () => {
    const p = setup();
    const button = screen.getByRole('button', { name: 'Show events for: Gabriel, Everyone, Others' });
    expect(button.textContent).toContain('3 of 4');
    expect(button.getAttribute('aria-haspopup')).toBe('true');
    fireEvent.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    const group = screen.getByRole('group', { name: 'Show events for' });
    const rows = within(group).getAllByRole('button').filter((b) => b.hasAttribute('aria-pressed'));
    expect(rows.map((c) => c.textContent)).toEqual(['GGabriel', 'EEva', 'AllEveryone', 'Others']);
    expect(rows.map((c) => c.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'true', 'true']);
    fireEvent.click(within(group).getByRole('button', { name: /Eva/ }));
    expect(p.onToggle).toHaveBeenCalledWith('e');
    expect(screen.getByRole('group', { name: 'Show events for' })).toBeTruthy();
    fireEvent.click(within(group).getByRole('button', { name: 'Show all' }));
    expect(p.onShowAll).toHaveBeenCalledOnce();
  });

  it('closes a popover on an outside tap and on Escape', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /^Show events for:/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('group', { name: 'Show events for' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'View: Month' }));
    expect(screen.getByRole('navigation', { name: 'Calendar view' })).toBeTruthy();
    act(() => {
      fireEvent.keyUp(document, { key: 'Escape' });
    });
    expect(screen.queryByRole('navigation', { name: 'Calendar view' })).toBeNull();
  });
});
