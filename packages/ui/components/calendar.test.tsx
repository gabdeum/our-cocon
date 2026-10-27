// Spec 036: the calendar header (title, ‹ ›, Today, view switcher) and its member filter chips.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
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
    chips: [
      { key: 'g', name: 'Gabriel', initial: 'G', color: 'honey', pressed: true },
      { key: 'e', name: 'Eva', initial: 'E', color: 'rose', pressed: false },
      { key: 'everyone', name: 'Everyone', initial: 'All', color: 'everyone', pressed: true },
      { key: 'others', name: 'Others', initial: '', color: 'others', pressed: true },
    ],
    onToggle: vi.fn(),
    chipsLabel: 'Show events for',
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

  it('switches views with links, the current one marked as the page', () => {
    const p = setup({ view: 'week' });
    const nav = screen.getByRole('navigation', { name: 'Calendar view' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual(['Month', 'Week', 'Day', 'Agenda']);
    expect(links.map((l) => l.getAttribute('aria-current'))).toEqual([null, 'page', null, null]);
    fireEvent.click(within(nav).getByRole('link', { name: 'Agenda' }));
    expect(p.onView).toHaveBeenCalledWith('agenda');
  });

  it('lists the member chips in order, pressed = shown, and reports a toggle', () => {
    const p = setup();
    const group = screen.getByRole('group', { name: 'Show events for' });
    const chips = within(group).getAllByRole('button');
    expect(chips.map((c) => c.textContent)).toEqual(['GGabriel', 'EEva', 'AllEveryone', 'Others']);
    expect(chips.map((c) => c.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'true', 'true']);
    fireEvent.click(within(group).getByRole('button', { name: /Eva/ }));
    expect(p.onToggle).toHaveBeenCalledWith('e');
  });
});
