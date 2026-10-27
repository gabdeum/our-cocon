// Spec 036 User Story 2: tapping a person in the filter row hides their events (chip unpressed),
// and the choice is remembered for that person on this device. Plus the header's paging and views.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ChoiceStorage } from '../../lib/recipe-choices';
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
    expect(onNavigate).toHaveBeenCalledWith({ view: 'day' });
    expect(tracker.track).toHaveBeenCalledWith('calendar_view_changed', { from: 'month', to: 'day' });
    fireEvent.click(within(nav).getByRole('link', { name: 'Month' }));
    expect(onNavigate).toHaveBeenCalledOnce();
  });
});
