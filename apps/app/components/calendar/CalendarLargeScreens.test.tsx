// Spec 070: the calendar from 600 wide. The header shows the views and people directly, Month keeps
// the selected day open in a panel, Week and Day grow, and Day gets a mini month and "Coming up" from 960.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { StoredEvent } from '@cocon/data';
import type { ChoiceStorage } from '../../lib/recipe-choices';
import { CalendarScreen, type CalendarScreenProps } from './CalendarScreen';
import { fakeTracker, gabriel, mia, storedEvent } from '../../test/fakes';
import { expectAccessible } from '../../test/axe';

vi.mock('../../lib/use-now', () => ({ useNow: () => '03:00' }));
const dims = vi.hoisted(() => ({ width: 820, height: 1180 }));
vi.mock('react-native', async (actual) => ({ ...(await actual<typeof import('react-native')>()), useWindowDimensions: () => ({ ...dims, scale: 2, fontScale: 1 }) }));

afterEach(() => {
  cleanup();
  dims.width = 820;
  dims.height = 1180;
});

const eva = { ...mia, id: 'u-eva', user_id: 'u-eva', display_name: 'Eva', color: 'rose' as const };
const on = (date: string, title: string, fields: Partial<StoredEvent> = {}) => storedEvent({ title, starts_on: date, ends_on: date, ...fields });
const events = [
  on('2026-10-28', 'Baby swim', { time_type: 'custom', slots: [], start_time: '14:30', end_time: '16:30' }),
  on('2026-10-28', 'Yoga', { members: [eva.id], slots: ['evening'] }),
  on('2026-10-29', 'Dentist'),
];

function memoryStorage(): ChoiceStorage {
  const data = new Map<string, string>();
  return { getItem: async (k) => data.get(k) ?? null, setItem: async (k, v) => void data.set(k, v) };
}

async function setup(over: Partial<CalendarScreenProps> = {}, width = 820) {
  dims.width = width;
  const props: CalendarScreenProps = {
    userId: 'u-gabriel',
    members: [gabriel, eva],
    view: 'month',
    anchor: '2026-10-27',
    today: '2026-10-27',
    width,
    weekStartsOn: 0,
    onNavigate: vi.fn(),
    onAddEvent: vi.fn(),
    tracker: fakeTracker(),
    storage: memoryStorage(),
    events,
    ...over,
  };
  const view = render(<CalendarScreen {...props} />);
  await act(async () => undefined);
  return { ...props, rerender: (p: Partial<CalendarScreenProps>) => view.rerender(<CalendarScreen {...props} {...p} />), unmount: view.unmount };
}

const chips = () => screen.getByRole('group', { name: 'Show events for' });
const panel = (title: string) => screen.getByRole('region', { name: title });

describe('header from 600 (spec 070 FR-002)', () => {
  it('shows the views and people directly, and "+ Event" in place of the floating button', async () => {
    const { onNavigate, onAddEvent } = await setup();
    expect(screen.getAllByRole('heading')[0]?.textContent).toBe('October');
    expect(screen.queryByRole('button', { name: /^View: / })).toBeNull();
    expect(within(screen.getByRole('group', { name: 'Calendar view' })).getByRole('button', { name: 'Month' }).getAttribute('aria-pressed')).toBe('true');
    expect(within(chips()).getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(['Gabriel', 'Eva', 'Everyone', 'Others']);
    // One add button: the header's.
    expect(screen.getAllByRole('button', { name: 'Add event' })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Add event' }));
    expect(onAddEvent).toHaveBeenCalledWith('2026-10-27');

    fireEvent.click(within(screen.getByRole('group', { name: 'Calendar view' })).getByRole('button', { name: 'Week' }));
    expect(onNavigate).toHaveBeenCalledWith({ view: 'week', date: '2026-10-27' });
    await expectAccessible();
  });

  it('titles Week and Day in full, and "+ Event" adds on the week\'s first day or the day shown', async () => {
    const { onAddEvent, rerender } = await setup({ view: 'week', anchor: '2026-11-04' });
    expect(screen.getAllByRole('heading')[0]?.textContent).toBe('November 1 – 7');
    fireEvent.click(screen.getByRole('button', { name: 'Add event' }));
    expect(onAddEvent).toHaveBeenLastCalledWith('2026-11-01');
    rerender({ view: 'day', anchor: '2026-10-28' });
    expect(screen.getAllByRole('heading')[0]?.textContent).toBe('Wednesday, October 28');
    fireEvent.click(screen.getByRole('button', { name: 'Add event' }));
    expect(onAddEvent).toHaveBeenLastCalledWith('2026-10-28');
  });

  it('SC-002: hiding Eva with her chip hides her events in every view, remembered like the phone filter', async () => {
    const storage = memoryStorage();
    const first = await setup({ storage });
    expect(screen.getByRole('button', { name: /^October 28: .*Yoga/ })).toBeTruthy();
    fireEvent.click(within(chips()).getByRole('button', { name: 'Eva' }));
    await act(async () => undefined);
    expect(within(chips()).getByRole('button', { name: 'Eva' }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.queryByRole('button', { name: /^October 28: .*Yoga/ })).toBeNull();
    expect(first.tracker.track).toHaveBeenCalledWith('calendar_member_filter_changed', { members_visible: 3, source: 'chips' });

    first.rerender({ view: 'week', anchor: '2026-10-28' });
    expect(screen.queryByText('Yoga')).toBeNull();
    first.rerender({ view: 'day', anchor: '2026-10-28' });
    expect(screen.queryByText('Yoga')).toBeNull();
    expect(screen.getByText('Baby swim')).toBeTruthy();
    first.unmount();

    // A new visit on this device: still hidden.
    await setup({ storage });
    expect(within(chips()).getByRole('button', { name: 'Eva' }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.queryByRole('button', { name: /^October 28: .*Yoga/ })).toBeNull();
  });
});

describe('Month from 600 (spec 070 FR-003/FR-004)', () => {
  it('SC-001: at 820, tapping a day shows it in the panel under the grid, without a sheet', async () => {
    const { tracker, onAddEvent, onNavigate } = await setup();
    // Opens on today.
    expect(panel('Tuesday, October 27').textContent).toContain('Nothing planned yet.');
    expect(screen.getByRole('button', { name: /^October 27: / }).getAttribute('aria-pressed')).toBe('true');

    const grid = screen.getByRole('button', { name: /^October 1: / }).parentElement?.parentElement?.parentElement;
    fireEvent.click(screen.getByRole('button', { name: /^October 28: / }));
    expect(screen.queryByRole('dialog')).toBeNull();
    // The grid stays as it was: same month, same element, nothing paged or scrolled away.
    expect(screen.getAllByRole('heading')[0]?.textContent).toBe('October');
    expect(screen.getByRole('button', { name: /^October 1: / }).parentElement?.parentElement?.parentElement).toBe(grid);
    const day = panel('Wednesday, October 28');
    expect(day.textContent).toContain('2 events');
    expect(within(day).getAllByRole('link').map((r) => r.getAttribute('aria-label'))).toEqual(['Baby swim, Gabriel, 14:30', 'Yoga, Eva, Evening']);
    expect(screen.getByRole('button', { name: /^October 28: / }).getAttribute('aria-pressed')).toBe('true');
    expect(tracker.track).toHaveBeenCalledWith('calendar_day_selected', { view: 'month', source: 'grid' });
    expect(tracker.track).not.toHaveBeenCalledWith('calendar_day_sheet_opened', expect.anything());
    expect(onNavigate).not.toHaveBeenCalled();

    fireEvent.click(within(day).getByRole('button', { name: 'Add event on Wednesday, October 28' }));
    expect(onAddEvent).toHaveBeenCalledWith('2026-10-28');
    expect(within(day).getByText('+ Add on Wed 28')).toBeTruthy();
    // FR-003: weekday names over the grid, one month at a time.
    expect(screen.getByText('Sun')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^November 8: / })).toBeNull();
  });

  it('‹ › page a month and select its 1st; switching view opens on the selected day', async () => {
    const { onNavigate } = await setup();
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    expect(screen.getAllByRole('heading')[0]?.textContent).toBe('November');
    expect(panel('Sunday, November 1')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^November 12: / }));
    fireEvent.click(within(screen.getByRole('group', { name: 'Calendar view' })).getByRole('button', { name: 'Day' }));
    expect(onNavigate).toHaveBeenCalledWith({ view: 'day', date: '2026-11-12' });
    fireEvent.click(screen.getByRole('button', { name: 'Today' }));
    expect(panel('Tuesday, October 27')).toBeTruthy();
  });

  it('FR-004: at 1180 the panel is beside the grid, and the first-visit hint waits for the phone', async () => {
    await setup({ monthHint: { show: true, onDismiss: vi.fn() } }, 1180);
    fireEvent.click(screen.getByRole('button', { name: /^October 29: / }));
    expect(panel('Thursday, October 29').textContent).toContain('1 event');
    expect(screen.queryByText('Got it')).toBeNull();
  });
});

describe('event detail and add from 600 (spec 070 FR-008)', () => {
  it("the panel's rows open the event, and its add button Add event, both pages that show as 065's centred cards", async () => {
    const onOpenEvent = vi.fn();
    const { onAddEvent } = await setup({ onOpenEvent });
    fireEvent.click(screen.getByRole('button', { name: /^October 28: / }));
    fireEvent.click(within(panel('Wednesday, October 28')).getByRole('link', { name: 'Baby swim, Gabriel, 14:30' }));
    expect(onOpenEvent).toHaveBeenCalledWith(events[0]?.id, '2026-10-28');
    fireEvent.click(screen.getByRole('button', { name: 'Add event on Wednesday, October 28' }));
    expect(onAddEvent).toHaveBeenCalledWith('2026-10-28');
  });
});

describe('Week from 600 (spec 070 FR-005)', () => {
  it('shows "Sun 25" heads; tapping a day opens its card, never Day view', async () => {
    const { onNavigate, tracker } = await setup({ view: 'week', anchor: '2026-10-28' });
    expect(screen.getByText('Wed')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('link', { name: 'Wednesday October 28' })[0] as HTMLElement);
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(onNavigate).not.toHaveBeenCalled();
    expect(tracker.track).toHaveBeenCalledWith('calendar_day_sheet_opened', { events: 2, presentation: 'card' });
  });
});

describe('Day from 600 (spec 070 FR-006/FR-007)', () => {
  it('FR-006: at 820 the bands sit in two columns read by column, and there is no side column', async () => {
    await setup({ view: 'day', anchor: '2026-10-28' });
    const bands = ['Early morning', 'Morning', 'Lunch', 'Afternoon', 'Evening'].map((t) => screen.getByRole('heading', { name: new RegExp(`^${t}\\d`) }));
    // Read by column: the DOM keeps the bands in order.
    expect(bands.every((b, i) => i === 0 || (bands[i - 1] as HTMLElement).compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    const column = (el: HTMLElement) => el.closest('[data-testid^="band-column"]')?.getAttribute('data-testid');
    expect(column(bands[0] as HTMLElement)).toBe('band-column-0');
    expect(column(bands[4] as HTMLElement)).toBe('band-column-1');
    expect(screen.queryByText('Coming up')).toBeNull();
  });

  it('FR-007: at 1180 a mini month and the next three days open other days', async () => {
    const { onNavigate, tracker } = await setup({ view: 'day', anchor: '2026-10-27' }, 1180);
    expect(screen.getByRole('heading', { name: 'October' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'October 28, has events' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'October 30' }));
    expect(onNavigate).toHaveBeenLastCalledWith({ date: '2026-10-30' });
    expect(tracker.track).toHaveBeenLastCalledWith('calendar_day_selected', { view: 'day', source: 'mini_month' });

    expect(screen.getByText('Coming up')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Wednesday October 28: Baby swim · Yoga' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Friday October 30: Nothing planned' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Thursday October 29: Dentist' }));
    expect(onNavigate).toHaveBeenLastCalledWith({ date: '2026-10-29' });
    expect(tracker.track).toHaveBeenLastCalledWith('calendar_day_selected', { view: 'day', source: 'coming_up' });
    await expectAccessible();
  });
});

describe('phone (spec 070 FR-001)', () => {
  it('keeps the view and people buttons and the floating add button', async () => {
    await setup({}, 390);
    expect(screen.getByRole('button', { name: /^View: / })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Show events for:/ })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Add event' })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: /^October 28: / }));
    expect(screen.getByRole('dialog')).toBeTruthy();
  });
});
