// Spec 036 User Story 2: tapping a person in the filter row hides their events (chip unpressed),
// and the choice is remembered for that person on this device. Plus the header's paging and views.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ChoiceStorage } from '../../lib/recipe-choices';
import { monthRange, weekIndexOf } from '../../lib/calendar-month';
import { CalendarScreen, type CalendarScreenProps } from './CalendarScreen';
import { fakeTracker, gabriel, mia } from '../../test/fakes';

afterEach(cleanup);

const eva = { ...mia, id: 'u-eva', user_id: 'u-eva', display_name: 'Eva', color: 'rose' as const };

function memoryStorage(): ChoiceStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: async (k) => data.get(k) ?? null, setItem: async (k, v) => void data.set(k, v) };
}

async function setup(over: Partial<CalendarScreenProps> = {}) {
  const props: CalendarScreenProps = {
    userId: 'u-gabriel',
    members: [gabriel, eva],
    view: 'month',
    anchor: '2026-10-27',
    today: '2026-10-27',
    width: 390,
    weekStartsOn: 0,
    onNavigate: vi.fn(),
    tracker: fakeTracker(),
    storage: memoryStorage(),
    ...over,
  };
  const view = render(<CalendarScreen {...props} />);
  await act(async () => undefined);
  return { ...props, unmount: view.unmount };
}

const chip = (name: string) => within(screen.getByRole('group', { name: 'Show events for' })).getByRole('button', { name: new RegExp(name) });

describe('Calendar header (spec 036)', () => {
  it('US2: tapping Eva hides her events, and the choice is kept for Gabriel on this device', async () => {
    const storage = memoryStorage();
    const first = await setup({ storage });
    const chips = within(screen.getByRole('group', { name: 'Show events for' })).getAllByRole('button');
    expect(chips.map((c) => c.textContent)).toEqual(['GGabriel', 'EEva', 'AllEveryone', 'Others']);
    expect(chips.every((c) => c.getAttribute('aria-pressed') === 'true')).toBe(true);

    fireEvent.click(chip('Eva'));
    expect(chip('Eva').getAttribute('aria-pressed')).toBe('false');
    expect(first.tracker.track).toHaveBeenCalledWith('calendar_member_filter_changed', { members_visible: 3 });
    await act(async () => undefined);
    expect(JSON.parse(storage.data.get('cocon.calendar.filter.u-gabriel') ?? '')).toEqual({ hidden: ['u-eva'] });
    first.unmount();

    // Back on the calendar later: still hidden.
    await setup({ storage });
    expect(chip('Eva').getAttribute('aria-pressed')).toBe('false');
    cleanup();

    // Someone else signed in on the same device starts with everyone shown.
    await setup({ storage, userId: 'u-eva' });
    expect(chip('Eva').getAttribute('aria-pressed')).toBe('true');
  });

  it('pages with ‹ › and Today, named by the view', async () => {
    const { onNavigate } = await setup({ view: 'week', anchor: '2026-11-03' });
    expect(screen.getByRole('heading').textContent).toBe('Nov. 1 – 7');
    fireEvent.click(screen.getByRole('button', { name: 'Previous week' }));
    expect(onNavigate).toHaveBeenLastCalledWith({ date: '2026-10-27' });
    fireEvent.click(screen.getByRole('button', { name: 'Next week' }));
    expect(onNavigate).toHaveBeenLastCalledWith({ date: '2026-11-10' });
    fireEvent.click(screen.getByRole('button', { name: 'Today' }));
    expect(onNavigate).toHaveBeenLastCalledWith({ date: '2026-10-27' });
  });

  it('switches view keeping the day, and tracks the change', async () => {
    const { onNavigate, tracker } = await setup();
    const nav = screen.getByRole('navigation', { name: 'Calendar view' });
    expect(within(nav).getByRole('link', { name: 'Month' }).getAttribute('aria-current')).toBe('page');
    fireEvent.click(within(nav).getByRole('link', { name: 'Day' }));
    // From Month, the other views open on the month in view (today, when it's this month; spec 037).
    expect(onNavigate).toHaveBeenCalledWith({ view: 'day', date: '2026-10-27' });
    expect(tracker.track).toHaveBeenCalledWith('calendar_view_changed', { from: 'month', to: 'day' });
    fireEvent.click(within(nav).getByRole('link', { name: 'Month' }));
    expect(onNavigate).toHaveBeenCalledOnce();
  });
});

// Spec 037: the Month view under the header.
describe('Month view (spec 037)', () => {
  const swim = {
    id: '00000000-0000-4000-8000-000000000001',
    title: 'Baby swim',
    category: null,
    location: null,
    notes: null,
    reminder: null,
    starts_on: '2026-10-28',
    ends_on: '2026-10-28',
    time_type: 'slot' as const,
    slots: ['afternoon' as const],
    start_time: null,
    end_time: null,
    recurrence: null,
    members: ['u-eva'],
    responsible_member_id: null,
    visibility: 'family' as const,
    creator_member_id: gabriel.id,
    surprise: null,
    removed_members: [],
    exceptions: [],
    checklist: [],
    created_by: null,
    updated_by: null,
    source: 'app',
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
    deleted_at: null,
  };

  it('US1: shows each day with its chips, and asks for the events around the month', async () => {
    const onEventWindow = vi.fn();
    await setup({ events: [swim], onEventWindow });
    expect(screen.getByText('E Baby swim')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'October 28: Baby swim' })).toBeTruthy();
    expect(onEventWindow).toHaveBeenCalledWith({ from: '2026-04-01', to: '2027-06-30' });
  });

  it('US2: scrolling into November changes the title once November fills the grid', async () => {
    await setup();
    const cell = screen.getByRole('link', { name: 'October 28: nothing planned' });
    let scroller: HTMLElement | null = cell.parentElement;
    while (scroller && getComputedStyle(scroller).overflowY !== 'auto' && getComputedStyle(scroller).overflowY !== 'scroll') scroller = scroller.parentElement;
    if (!scroller) throw new Error('no scrolling grid');
    // Rows are 96 tall; with Oct 25 – 31 at the top, the second row is Nov 1 – 7.
    const range = monthRange('2026-10-27', 0);
    const top = weekIndexOf(range, '2026-09-27') * 96;
    act(() => {
      scroller.scrollTop = top + 4 * 96;
      fireEvent.scroll(scroller);
    });
    expect(screen.getByRole('heading').textContent).toBe('November');
    // Scroll events are throttled to one per 16 ms.
    await act(() => new Promise((r) => setTimeout(r, 30)));
    act(() => {
      scroller.scrollTop = top + 3 * 96;
      fireEvent.scroll(scroller);
    });
    expect(screen.getByRole('heading').textContent).toBe('October');
  });

  it('US2: ‹ › move a month at a time and the title follows', async () => {
    await setup();
    expect(screen.getByRole('heading').textContent).toBe('October');
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    expect(screen.getByRole('heading').textContent).toBe('November');
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    expect(screen.getByRole('heading').textContent).toBe('Jan. 2027');
    fireEvent.click(screen.getByRole('button', { name: 'Today' }));
    expect(screen.getByRole('heading').textContent).toBe('October');
  });

  it('US3: tapping a day opens Day view on it; long-press and + open Add event', async () => {
    vi.useFakeTimers();
    try {
      const onAddEvent = vi.fn();
      const { onNavigate, tracker } = await setup({ onAddEvent });
      fireEvent.click(screen.getByRole('link', { name: 'October 30: nothing planned' }));
      expect(onNavigate).toHaveBeenCalledWith({ view: 'day', date: '2026-10-30' });
      expect(tracker.track).toHaveBeenCalledWith('calendar_day_opened', { from_view: 'month' });

      const day = screen.getByRole('link', { name: 'October 29: nothing planned' });
      fireEvent.mouseDown(day, { button: 0, buttons: 1 });
      act(() => void vi.advanceTimersByTime(800));
      fireEvent.mouseUp(day, { button: 0 });
      expect(onAddEvent).toHaveBeenCalledWith('2026-10-29');

      fireEvent.click(screen.getByRole('button', { name: 'Add event' }));
      expect(onAddEvent).toHaveBeenLastCalledWith('2026-10-27');
    } finally {
      vi.useRealTimers();
    }
  });

  it('FR-006: the hint shows on the first visit only', async () => {
    const storage = memoryStorage();
    const first = await setup({ storage });
    expect(screen.getByRole('status').textContent).toContain('Tap a day to see details. Each color is a family member.');
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }));
    expect(screen.queryByRole('status')).toBeNull();
    expect(first.tracker.track).toHaveBeenCalledWith('calendar_first_hint_dismissed', {});
    await act(async () => undefined);
    first.unmount();

    await setup({ storage });
    expect(screen.queryByText('Got it')).toBeNull();
  });

  it('switching to Week from Month opens on the month in view', async () => {
    const { onNavigate } = await setup();
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Calendar view' })).getByRole('link', { name: 'Week' }));
    expect(onNavigate).toHaveBeenCalledWith({ view: 'week', date: '2026-11-01' });
  });
});
