// Spec 057 FR-001 and FR-002: Home's Reminders card, its rows, footer and ⋮ menu.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { render } from '../../test/render';
import { expectAccessible } from '../../test/axe';
import { alex, gabriel, placedReminder } from '../../test/fakes';
import { RemindersCard, type RemindersCardProps } from './RemindersCard';

afterEach(cleanup);

const tz = 'Europe/Paris';
// Wednesday, Nov 11 at 15:00 Paris.
const plants = placedReminder({
  title: 'Water the plants',
  has_time: false,
  due_at: '2026-11-08T23:00:00.000Z',
  due_on: '2026-11-09',
  section: 'overdue',
  late_days: 2,
  late_hours: 48,
  repeat_rule: { freq: 'weekly', weekdays: [1], ends: { type: 'never' } },
});
const insurance = placedReminder({ title: 'Call the car insurance', assignee_id: alex.id, has_time: false, due_at: '2026-11-09T23:00:00.000Z', due_on: '2026-11-10', section: 'overdue', late_days: 1, late_hours: 24 });
const checkup = placedReminder({ title: 'Book James’s check-up', due_at: '2026-11-11T16:00:00.000Z' });

function setup(over: Partial<RemindersCardProps> = {}) {
  const props: RemindersCardProps = {
    rows: [plants, insurance, checkup].map((row) => ({ row, done: false })),
    moreToday: 2,
    snoozed: 1,
    members: [gabriel, alex],
    today: '2026-11-11',
    tz,
    use24h: true,
    onToggle: vi.fn(),
    onOpen: vi.fn(),
    onAdd: vi.fn(),
    onSeeAll: vi.fn(),
    ...over,
  };
  render(<RemindersCard {...props} />);
  return props;
}

describe('RemindersCard', () => {
  it('shows its rows with who, when and how late, and opens a new reminder', async () => {
    const p = setup();
    const card = screen.getByRole('region', { name: 'Reminders' });
    expect(within(card).getByRole('heading', { name: 'Reminders' })).toBeTruthy();
    expect(within(card).getByText('Water the plants')).toBeTruthy();
    expect(within(card).getByText('Was due Mon')).toBeTruthy();
    expect(within(card).getByText('2d late')).toBeTruthy();
    expect(within(card).getByText('Was due yesterday')).toBeTruthy();
    expect(within(card).getByRole('img', { name: 'Alex' })).toBeTruthy();
    expect(within(card).getByText('17:00 · nudges hourly')).toBeTruthy();
    fireEvent.click(within(card).getByRole('button', { name: 'New reminder' }));
    expect(p.onAdd).toHaveBeenCalledOnce();
    await expectAccessible(card);
  });

  it.each([
    [2, 1, '2 more today · 1 snoozed'],
    [0, 3, '3 snoozed'],
  ])('reads the footer: %i more today, %i snoozed', (moreToday, snoozed, hint) => {
    const p = setup({ moreToday, snoozed });
    const footer = screen.getByRole('link');
    expect(footer.textContent).toBe(`See all reminders${hint}`);
    fireEvent.click(footer);
    expect(p.onSeeAll).toHaveBeenCalledOnce();
  });

  it('reads just "See all reminders" when nothing else is waiting', () => {
    setup({ moreToday: 0, snoozed: 0 });
    expect(screen.getByRole('link').textContent).toBe('See all reminders');
  });

  it('ticks a row, and shows a ticked one struck through with Undo by ticking again', () => {
    const p = setup({ rows: [{ row: plants, done: false }, { row: checkup, done: true }] });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Mark done: Water the plants' }));
    expect(p.onToggle).toHaveBeenCalledWith(plants, false);
    const ticked = screen.getByRole('checkbox', { name: 'Mark not done: Book James’s check-up' });
    expect(ticked.getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText('Done just now')).toBeTruthy();
    fireEvent.click(ticked);
    expect(p.onToggle).toHaveBeenCalledWith(checkup, true);
  });

  it('opens a row’s drawer from anywhere right of its dot, with no ⋮ menu (spec 058)', () => {
    const p = setup();
    // Spec 058: no ⋮ menu; the whole row right of the dot opens the drawer (snooze, edit, delete live there).
    expect(screen.queryByRole('button', { name: /^More options/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open Book James’s check-up' }));
    expect(p.onOpen).toHaveBeenCalledWith(checkup);
    fireEvent.click(screen.getByText('2d late'));
    expect(p.onOpen).toHaveBeenLastCalledWith(plants);
  });

  it('a ticked row stays, struck through, and opens nothing', () => {
    const p = setup({ rows: [{ row: checkup, done: true }] });
    expect(screen.getByText('Done just now')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Open Book James’s check-up' })).toBeNull();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Mark not done: Book James’s check-up' }));
    expect(p.onToggle).toHaveBeenCalledWith(checkup, true);
  });

  it("can't change anything offline", () => {
    const p = setup({ readOnly: true });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Mark done: Water the plants' }));
    fireEvent.click(screen.getByRole('button', { name: 'New reminder' }));
    expect(p.onToggle).not.toHaveBeenCalled();
    expect(p.onAdd).not.toHaveBeenCalled();
  });
});
