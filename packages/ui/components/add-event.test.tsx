// Spec 041: the add sheet's pieces: time-of-day and day tiles, the Who picker, the Undo toast,
// checklist rows and the date grid.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ChecklistRow } from './ChecklistRow';
import { DateGrid } from './DateGrid';
import { DayChip } from './DayChip';
import { MemberPickerChip } from './MemberChip';
import { SlotChip } from './SlotChip';
import { UndoToast } from './Toast';

afterEach(cleanup);

describe('SlotChip and DayChip', () => {
  it('show their two lines, say whether they are picked, and report taps', () => {
    const onPress = vi.fn();
    render(
      <>
        <SlotChip label="Evening" hours="18–22" selected onPress={onPress} />
        <DayChip label="Today" sub="Sun 25" selected={false} onPress={onPress} />
      </>,
    );
    const slot = screen.getByRole('button', { name: 'Evening, 18–22' });
    expect(slot.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Today, Sun 25' }).getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(slot);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('MemberPickerChip', () => {
  it('is a toggle named after the person', () => {
    const onPress = vi.fn();
    render(<MemberPickerChip name="Others" initial="" color="others" selected onPress={onPress} />);
    fireEvent.click(screen.getByRole('button', { name: 'Others' }));
    expect(screen.getByRole('button', { name: 'Others' }).getAttribute('aria-pressed')).toBe('true');
    expect(onPress).toHaveBeenCalled();
  });
});

describe('UndoToast', () => {
  it('is a status with its text and an Undo button', () => {
    const onUndo = vi.fn();
    render(<UndoToast text="Poker night added for tonight, 18:00–22:00." undoLabel="Undo" onUndo={onUndo} />);
    expect(screen.getByRole('status').textContent).toContain('Poker night added for tonight, 18:00–22:00.');
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(onUndo).toHaveBeenCalled();
  });
});

describe('ChecklistRow', () => {
  it('ticks as a checkbox on the event page', () => {
    const onToggle = vi.fn();
    render(<ChecklistRow label="Chips and dip" done onToggle={onToggle} />);
    const box = screen.getByRole('checkbox');
    expect(box.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(box);
    expect(onToggle).toHaveBeenCalled();
  });

  it('lists an item with a remove button in the add sheet', () => {
    const onPress = vi.fn();
    render(<ChecklistRow label="Chips and dip" done={false} remove={{ label: 'Remove Chips and dip', onPress }} last />);
    expect(screen.queryByRole('checkbox')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Remove Chips and dip' }));
    expect(onPress).toHaveBeenCalled();
  });
});

describe('DateGrid', () => {
  const day = (n: number, extra = {}) => ({ date: `2026-10-${String(n).padStart(2, '0')}`, day: n, label: `Oct ${n}`, today: n === 28, ...extra });

  it('picks a day, marks today and the pick, and pages months', () => {
    const onSelect = vi.fn();
    const previous = vi.fn();
    const next = vi.fn();
    render(
      <DateGrid
        title="October 2026"
        weekdays={['S', 'M', 'T', 'W', 'T', 'F', 'S']}
        weeks={[[null, null, null, null, day(1), day(2), day(3)], [day(25, { disabled: true }), day(26), day(27), day(28), day(29), day(30), day(31)]]}
        selected="2026-10-31"
        onSelect={onSelect}
        previous={{ label: 'Previous month', onPress: previous }}
        next={{ label: 'Next month', onPress: next }}
      />,
    );
    expect(screen.getByRole('button', { name: 'Oct 31' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Oct 28' }).getAttribute('aria-current')).toBe('date');
    fireEvent.click(screen.getByRole('button', { name: 'Oct 29' }));
    expect(onSelect).toHaveBeenCalledWith('2026-10-29');
    fireEvent.click(screen.getByRole('button', { name: 'Oct 25' }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    expect(previous).toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });
});
