// Spec 057 FR-005: the reminder drawer.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import type { ReminderOccurrence } from '@cocon/data';
import { render } from '../../test/render';
import { expectAccessible } from '../../test/axe';
import { gabriel, last, placedReminder } from '../../test/fakes';
import { ReminderDrawer, type ReminderDrawerProps } from './ReminderDrawer';

afterEach(cleanup);

const tz = 'Europe/Paris';
const now = new Date('2026-11-11T14:00:00.000Z');
const plants = placedReminder({
  title: 'Water the plants',
  notes: 'Big fern by the window: 1 jug.\nBasil in the kitchen: a splash, not more.',
  has_time: false,
  due_at: '2026-11-08T23:00:00.000Z',
  due_on: '2026-11-09',
  section: 'overdue',
  rollover: 'day',
  late_days: 2,
  late_hours: 48,
  repeat_rule: { freq: 'weekly', weekdays: [1], ends: { type: 'never' } },
  repeat_from: '2026-10-05',
});
const missedLastWeek: ReminderOccurrence[] = [
  { due_at: '2026-11-01T23:00:00.000Z', status: 'missed', closed_at: '2026-11-08T23:00:00.000Z', closed_by: null },
  { due_at: '2026-10-25T23:00:00.000Z', status: 'done', closed_at: '2026-10-26T10:00:00.000Z', closed_by: null },
];

function setup(over: Partial<ReminderDrawerProps> = {}) {
  const props: ReminderDrawerProps = {
    reminder: plants,
    members: [gabriel],
    history: missedLastWeek,
    today: '2026-11-11',
    tz,
    use24h: true,
    weekStartsOn: 1,
    now,
    onClose: vi.fn(),
    onEdit: vi.fn(),
    onDone: vi.fn(async () => ({ repeating: true, nextDueAt: '2026-11-15T23:00:00.000Z', undo: {} as never })),
    onUndoDone: vi.fn(async () => true),
    onSnooze: vi.fn(async () => ({ until: '2026-11-11T23:00:00.000Z', previous: null })),
    onUndoSnooze: vi.fn(async () => true),
    onDelete: vi.fn(async () => true),
    ...over,
  };
  render(<ReminderDrawer {...props} />);
  return props;
}

describe('ReminderDrawer', () => {
  it('shows who, when, how late with what was missed, the notes and the snooze times', async () => {
    setup();
    const drawer = screen.getByRole('dialog', { name: 'Water the plants' });
    expect(within(drawer).getByText('Gabriel')).toBeTruthy();
    expect(within(drawer).getByText('Every Monday · was due Mon, Nov 9')).toBeTruthy();
    expect(within(drawer).getByText('2 days late. Last week’s (Mon, Nov 2) was missed too.')).toBeTruthy();
    expect(within(drawer).getByText(/Big fern by the window/)).toBeTruthy();
    expect(within(drawer).queryByRole('button', { name: '+ Add a note' })).toBeNull();
    // No time: no "In 1 hour".
    expect(within(drawer).getAllByRole('button', { name: /, (Thu|Wed|Fri|Calendar)/ }).map((b) => b.getAttribute('aria-label'))).toEqual([
      'Tomorrow, Thu, Nov 12',
      'Next week, Wed, Nov 18',
      'Next month, Fri, Dec 11',
      'Pick a date, Calendar',
    ]);
    await expectAccessible(drawer);
  });

  it('has no late callout when on time, and offers a note when there is none', () => {
    const p = setup({ reminder: placedReminder({ title: 'Book the check-up' }), history: [] });
    expect(screen.getByText('Today at 15:00 · nudges every hour until done')).toBeTruthy();
    expect(screen.queryByText(/late\./)).toBeNull();
    expect(screen.getByRole('button', { name: 'In 1 hour, 16:00' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '+ Add a note' }));
    expect(p.onEdit).toHaveBeenCalledWith('notes');
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(p.onEdit).toHaveBeenLastCalledWith();
  });

  it('marks it done, says when the next one is, and undoes', async () => {
    const p = setup();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Mark as done' })));
    expect(p.onDone).toHaveBeenCalledOnce();
    expect(screen.getByText('Done. Nice one.')).toBeTruthy();
    expect(screen.getByText('Next one: Mon, Nov 16. The missed weeks stay in its history.')).toBeTruthy();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Undo' })));
    expect(p.onUndoDone).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Mark as done' })).toBeTruthy();
  });

  it('snoozes, says until when, and closes', async () => {
    const p = setup();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Tomorrow, Thu, Nov 12' })));
    expect(p.onSnooze).toHaveBeenCalledWith('tomorrow', undefined);
    expect(screen.getByText('Snoozed until Thu, Nov 12')).toBeTruthy();
    expect(screen.getByText('It’s hidden until then and comes back without a late badge.')).toBeTruthy();
    // The last "Close": the scrim is named so too.
    fireEvent.click(last(screen.getAllByRole('button', { name: 'Close' })));
    expect(p.onClose).toHaveBeenCalled();
  });

  it('confirms before deleting all future dates of a repeating reminder', async () => {
    const p = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Delete reminder' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Delete all future reminders?' });
    await act(async () => fireEvent.click(within(dialog).getByRole('button', { name: 'Delete reminder' })));
    expect(p.onDelete).toHaveBeenCalledOnce();
    expect(p.onClose).toHaveBeenCalled();
  });

  it('deletes a one-off at once', async () => {
    const p = setup({ reminder: placedReminder({ title: 'Book the check-up' }), history: [] });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Delete reminder' })));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(p.onDelete).toHaveBeenCalledOnce();
  });
});
