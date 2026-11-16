// Spec 057 FR-003 and FR-004: the Reminders screen.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { render } from '../../test/render';
import { expectAccessible } from '../../test/axe';
import { gabriel, placedReminder } from '../../test/fakes';
import { RemindersScreen, type RemindersScreenProps } from './RemindersScreen';

afterEach(cleanup);

const plants = placedReminder({
  title: 'Water the plants',
  notes: 'Big fern: 1 jug.',
  has_time: false,
  due_at: '2026-11-08T23:00:00.000Z',
  due_on: '2026-11-09',
  section: 'overdue',
  late_days: 2,
  late_hours: 48,
  repeat_rule: { freq: 'weekly', weekdays: [1], ends: { type: 'never' } },
});
const bins = placedReminder({ title: 'Take the bins out', assignee_id: null, due_at: '2026-11-11T19:00:00.000Z', rollover: 'day' });
const filter = placedReminder({ title: 'Change the water filter', has_time: false, due_at: '2026-11-13T23:00:00.000Z', due_on: '2026-11-14', section: 'later' });
const permit = placedReminder({ title: 'Renew the parking permit', section: 'snoozed', snoozed_until: '2026-11-11T23:00:00.000Z' });

function setup(over: Partial<RemindersScreenProps> = {}) {
  const props: RemindersScreenProps = {
    sections: [
      { key: 'overdue', label: 'Overdue', rows: [{ row: plants, done: false }], canMore: false },
      { key: 'today', label: 'Today · Wed, Nov 11', rows: [{ row: bins, done: false }], canMore: false },
      { key: 'later', label: 'Later', rows: [{ row: filter, done: false }], canMore: true },
    ],
    snoozed: { rows: [permit], canMore: false },
    snoozedOpen: false,
    onToggleSnoozed: vi.fn(),
    mine: false,
    onMine: vi.fn(),
    members: [gabriel],
    today: '2026-11-11',
    tz: 'Europe/Paris',
    use24h: true,
    onToggle: vi.fn(),
    onOpen: vi.fn(),
    onMore: vi.fn(),
    onAdd: vi.fn(),
    onBack: vi.fn(),
    ...over,
  };
  const view = render(<RemindersScreen {...props} />);
  return { props, view };
}

describe('RemindersScreen', () => {
  it('lists the sections with their rows, icons and badges', async () => {
    const { view } = setup();
    expect(screen.getByRole('heading', { name: 'Reminders' })).toBeTruthy();
    const overdue = screen.getByRole('region', { name: 'Overdue' });
    expect(within(overdue).getByText('Water the plants')).toBeTruthy();
    expect(within(overdue).getByRole('img', { name: 'Repeats' })).toBeTruthy();
    expect(within(overdue).getByRole('img', { name: 'Has notes' })).toBeTruthy();
    expect(within(overdue).getByText('2d late')).toBeTruthy();
    const today = screen.getByRole('region', { name: 'Today · Wed, Nov 11' });
    expect(within(today).getByText('20:00')).toBeTruthy();
    expect(within(today).getByRole('img', { name: 'Everyone' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: /Tomorrow/ })).toBeNull();
    await expectAccessible(view.container);
  });

  it('opens the drawer from a row and from its ⋮', () => {
    const { props } = setup();
    fireEvent.click(screen.getAllByRole('button', { name: 'Open Water the plants' })[0] as HTMLElement);
    fireEvent.click(screen.getAllByRole('button', { name: 'Open Water the plants' })[1] as HTMLElement);
    expect(props.onOpen).toHaveBeenCalledTimes(2);
    expect(props.onOpen).toHaveBeenCalledWith(plants);
  });

  it('ticks a row', () => {
    const { props } = setup();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Mark done: Take the bins out' }));
    expect(props.onToggle).toHaveBeenCalledWith(bins, false);
  });

  it('loads more of a section', () => {
    const { props } = setup();
    const later = screen.getByRole('region', { name: 'Later' });
    fireEvent.click(within(later).getByRole('button', { name: 'Show more' }));
    expect(props.onMore).toHaveBeenCalledWith('later');
    expect(within(screen.getByRole('region', { name: 'Overdue' })).queryByRole('button', { name: 'Show more' })).toBeNull();
  });

  it('switches Mine and Everyone’s', () => {
    const { props } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Mine' }));
    expect(props.onMine).toHaveBeenCalledWith(true);
  });

  it('folds snoozed reminders away, and shows when they come back', () => {
    const { props } = setup();
    const row = screen.getByRole('button', { name: 'Snoozed' });
    expect(row.getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByText('1 hidden until later')).toBeTruthy();
    expect(screen.queryByText('Renew the parking permit')).toBeNull();
    fireEvent.click(row);
    expect(props.onToggleSnoozed).toHaveBeenCalled();
    cleanup();
    setup({ snoozedOpen: true });
    expect(screen.getByText('Hide')).toBeTruthy();
    expect(screen.getByText('Renew the parking permit')).toBeTruthy();
    expect(screen.getByText('Back tomorrow, Thu, Nov 12')).toBeTruthy();
    expect(screen.queryByRole('checkbox', { name: /Renew/ })).toBeNull();
  });

  it('says there is nothing to remember, with New reminder', () => {
    const { props } = setup({ sections: [], snoozed: { rows: [], canMore: false } });
    expect(screen.getByText('Nothing to remember. Nice.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Snoozed' })).toBeNull();
    const add = screen.getAllByRole('button', { name: 'New reminder' });
    expect(add).toHaveLength(2);
    add.forEach((b) => fireEvent.click(b));
    expect(props.onAdd).toHaveBeenCalledTimes(2);
  });
});
