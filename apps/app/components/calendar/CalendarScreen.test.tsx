// Spec 036 User Story 2: tapping a person in the filter row hides their events (chip unpressed),
// and the choice is remembered for that person on this device. Plus the header's paging and views.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PanResponder, type GestureResponderEvent, type PanResponderCallbacks, type PanResponderGestureState } from 'react-native';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ChoiceStorage } from '../../lib/recipe-choices';
import { monthRange, weekIndexOf } from '../../lib/calendar-month';
import { CalendarScreen, type CalendarScreenProps } from './CalendarScreen';
import { fakeTracker, gabriel, mia } from '../../test/fakes';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

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

function captureSwipes() {
  const configs: PanResponderCallbacks[] = [];
  vi.spyOn(PanResponder, 'create').mockImplementation((config) => {
    configs.push(config);
    return { panHandlers: {} } as ReturnType<typeof PanResponder.create>;
  });
  return (dx: number) => {
    const g = { dx, dy: 0 } as PanResponderGestureState;
    act(() => configs.at(-1)?.onPanResponderRelease?.({} as GestureResponderEvent, g));
  };
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

describe('Week view (spec 038)', () => {
  const event = (title: string, start: string, end: string, members: string[]) => ({
    id: `00000000-0000-4000-8000-00000000000${title.length % 10}`,
    title,
    category: null,
    location: null,
    notes: null,
    reminder: null,
    starts_on: '2026-10-25',
    ends_on: '2026-10-25',
    time_type: 'custom' as const,
    slots: [],
    start_time: start,
    end_time: end,
    recurrence: null,
    members,
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
  });
  const events = [event('Baby swim', '14:30', '16:30', ['u-eva']), event('Coffee', '16:00', '17:00', [gabriel.id])];

  it('US1: overlapping events show side by side, each at its time', async () => {
    const onEventWindow = vi.fn();
    await setup({ view: 'week', anchor: '2026-10-25', today: '2026-10-25', events, onEventWindow });
    const swim = screen.getByRole('link', { name: 'Baby swim, Sunday, 14:30 to 16:30' }).parentElement;
    const coffee = screen.getByRole('link', { name: 'Coffee, Sunday, 16:00 to 17:00' }).parentElement;
    expect([swim?.style.top, swim?.style.width, coffee?.style.top, coffee?.style.left]).toEqual(['307px', '50%', '361px', '50%']);
    expect(onEventWindow).toHaveBeenCalledWith({ from: '2026-04-01', to: '2027-06-30' });
  });

  it('US2: swiping left moves to Nov. 1 – 7; right goes back; a short drag stays', async () => {
    const release = captureSwipes();
    const { onNavigate, tracker } = await setup({ view: 'week', anchor: '2026-10-25', today: '2026-10-25' });
    expect(screen.getByRole('heading').textContent).toBe('Oct. 25 – 31');
    release(-80);
    expect(onNavigate).toHaveBeenLastCalledWith({ date: '2026-11-01' });
    expect(tracker.track).toHaveBeenCalledWith('calendar_week_swiped', { direction: 'next' });
    release(80);
    expect(onNavigate).toHaveBeenLastCalledWith({ date: '2026-10-18' });
    expect(tracker.track).toHaveBeenCalledWith('calendar_week_swiped', { direction: 'previous' });
    vi.mocked(onNavigate).mockClear();
    release(-40);
    expect(onNavigate).not.toHaveBeenCalled();
    cleanup();

    await setup({ view: 'week', anchor: '2026-11-01', today: '2026-10-25' });
    expect(screen.getByRole('heading').textContent).toBe('Nov. 1 – 7');
    expect(screen.getByRole('link', { name: 'Sunday November 1' })).toBeTruthy();
  });

  it('FR-001: tapping a day opens Day view; FR-005: a block opens the event, + and an empty day add one', async () => {
    const onOpenEvent = vi.fn();
    const onAddEvent = vi.fn();
    const { onNavigate, tracker } = await setup({ view: 'week', anchor: '2026-10-25', today: '2026-10-27', events, onOpenEvent, onAddEvent });
    fireEvent.click(screen.getByRole('link', { name: 'Thursday October 29' }));
    expect(onNavigate).toHaveBeenCalledWith({ view: 'day', date: '2026-10-29' });
    expect(tracker.track).toHaveBeenCalledWith('calendar_day_opened', { from_view: 'week' });

    fireEvent.click(screen.getByRole('link', { name: 'Coffee, Sunday, 16:00 to 17:00' }));
    expect(onOpenEvent).toHaveBeenCalledWith(events[1]?.id, '2026-10-25');

    fireEvent.click(screen.getByRole('button', { name: 'Add event' }));
    expect(onAddEvent).toHaveBeenLastCalledWith('2026-10-27');
    fireEvent.click(screen.getByRole('button', { name: 'Add event, Friday October 30' }));
    expect(onAddEvent).toHaveBeenLastCalledWith('2026-10-30', expect.toSatisfy((p?: { time: string }) => p === undefined || /^\d\d:00$/.test(p.time)));
  });

  it('the add button opens on the week’s first day when today is another week', async () => {
    const onAddEvent = vi.fn();
    await setup({ view: 'week', anchor: '2026-11-04', today: '2026-10-27', onAddEvent });
    fireEvent.click(screen.getByRole('button', { name: 'Add event' }));
    expect(onAddEvent).toHaveBeenCalledWith('2026-11-01');
  });
});

describe('Day view (spec 039)', () => {
  const base = {
    category: null,
    notes: null,
    reminder: null,
    starts_on: '2026-10-25',
    ends_on: '2026-10-25',
    recurrence: null,
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
  const events = [
    { ...base, id: '00000000-0000-4000-8000-000000000001', title: 'Brunch', location: 'Grandma’s house', time_type: 'slot' as const, slots: ['lunch' as const], start_time: null, end_time: null, members: ['everyone'] },
    { ...base, id: '00000000-0000-4000-8000-000000000002', title: 'Coffee', location: null, time_type: 'custom' as const, slots: [], start_time: '16:00', end_time: '17:00', members: [gabriel.id] },
  ];
  const headerTitle = () => screen.getAllByRole('heading')[0]?.textContent;

  it('US1: who’s busy, then the bands with their events or an add row', async () => {
    await setup({ view: 'day', anchor: '2026-10-25', today: '2026-10-25', events });
    expect(headerTitle()).toBe('Sun, Oct. 25');
    expect(within(screen.getByRole('group', { name: 'Who’s busy this day' })).getByText('Gabriel 1')).toBeTruthy();
    expect(screen.getByText('Everyone 1')).toBeTruthy();
    expect(screen.getAllByRole('heading').map((h) => h.textContent)).toEqual([
      'Sun, Oct. 25',
      'Early morning06:00–09:00',
      'Morning09:00–12:00',
      'Lunch12:00–14:00',
      'Afternoon14:00–18:00',
      'Evening18:00–22:00',
    ]);
    expect(screen.getByRole('link', { name: /^Brunch, Lunch · Grandma’s house/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add event in the lunch slot, Sunday October 25' })).toBeNull();
    expect(screen.getByText('+ Add in the early morning')).toBeTruthy();
  });

  it('US2: swiping left shows Mon, Oct. 26; right goes back; the arrows don’t count as swipes', async () => {
    const release = captureSwipes();
    const { onNavigate, tracker } = await setup({ view: 'day', anchor: '2026-10-25', today: '2026-10-25' });
    release(-80);
    expect(onNavigate).toHaveBeenLastCalledWith({ date: '2026-10-26' });
    expect(tracker.track).toHaveBeenCalledWith('calendar_day_swiped', { direction: 'next' });
    release(80);
    expect(onNavigate).toHaveBeenLastCalledWith({ date: '2026-10-24' });
    expect(tracker.track).toHaveBeenCalledWith('calendar_day_swiped', { direction: 'previous' });
    vi.mocked(onNavigate).mockClear();
    release(-40);
    expect(onNavigate).not.toHaveBeenCalled();
    vi.mocked(tracker.track).mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Next day' }));
    expect(onNavigate).toHaveBeenLastCalledWith({ date: '2026-10-26' });
    expect(tracker.track).not.toHaveBeenCalledWith('calendar_day_swiped', expect.anything());
    cleanup();

    await setup({ view: 'day', anchor: '2026-10-26', today: '2026-10-25' });
    expect(headerTitle()).toBe('Mon, Oct. 26');
  });

  it('FR-004: an empty band adds in its slot; a row opens its event; + adds on the day shown', async () => {
    const onAddEvent = vi.fn();
    const onOpenEvent = vi.fn();
    const { tracker } = await setup({ view: 'day', anchor: '2026-10-25', today: '2026-10-27', events, onAddEvent, onOpenEvent });
    fireEvent.click(screen.getByRole('button', { name: 'Add event in the morning, Sunday October 25' }));
    expect(onAddEvent).toHaveBeenLastCalledWith('2026-10-25', { slot: 'morning' });
    expect(tracker.track).toHaveBeenCalledWith('calendar_slot_add_tapped', { slot: 'morning' });
    expect(screen.getByText('+ Add in the morning')).toBeTruthy();
    fireEvent.click(screen.getByRole('link', { name: 'Coffee, 16:00' }));
    expect(onOpenEvent).toHaveBeenCalledWith(events[1]?.id, '2026-10-25');
    fireEvent.click(screen.getByRole('button', { name: 'Add event' }));
    expect(onAddEvent).toHaveBeenLastCalledWith('2026-10-25');
  });
});
