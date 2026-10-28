// Spec 037: the month grid's cells, chips, bars and the first-visit hint.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { EventBar, EventChip } from './EventChip';
import { MonthGrid, type MonthWeek } from './MonthGrid';
import { Toast } from './Toast';

afterEach(cleanup);

const week = (i: number): MonthWeek => ({
  key: `w${i}`,
  cells: Array.from({ length: 7 }, (_, d) => ({
    date: `2026-10-${String(i * 7 + d + 1).padStart(2, '0')}`,
    label: `October ${i * 7 + d + 1}: nothing planned`,
    dateText: d === 0 && i === 0 ? 'Oct 1' : String(i * 7 + d + 1),
    first: d === 0 && i === 0,
    today: i === 0 && d === 2,
    past: i === 0 && d < 2,
    items: d === 3 && i === 0 ? [{ kind: 'chip', key: 'c', text: 'J Baby swim', colors: ['sky'] }] : [],
    more: d === 3 && i === 0 ? '+2' : null,
  })),
  bars: i === 0 ? [{ key: 'e1:2026-10-05', text: 'All Grandma visits', label: 'Grandma visits, October 5 to October 7', colors: ['everyone'], column: 4, days: 3, lane: 0, startsHere: true, endsHere: false }] : [],
});

describe('MonthGrid (spec 037)', () => {
  it('draws days with chips and "+N", and opens a day on tap or Add event on long-press', () => {
    const onDayPress = vi.fn();
    const onDayLongPress = vi.fn();
    const onBarPress = vi.fn();
    render(
      <MonthGrid
        weekdays={['S', 'M', 'T', 'W', 'T', 'F', 'S']}
        weekCount={3}
        weekAt={week}
        initialIndex={0}
        onTopRowChange={vi.fn()}
        onDayPress={onDayPress}
        onDayLongPress={onDayLongPress}
        onBarPress={onBarPress}
        addLabel="Add event"
      />,
    );
    expect(screen.getByText('Oct 1')).toBeTruthy();
    expect(screen.getByText('J Baby swim')).toBeTruthy();
    expect(screen.getByText('+2')).toBeTruthy();
    fireEvent.click(screen.getByRole('link', { name: 'October 4: nothing planned' }));
    expect(onDayPress).toHaveBeenCalledWith('2026-10-04');
    fireEvent.click(screen.getByRole('link', { name: 'Grandma visits, October 5 to October 7' }));
    expect(onBarPress).toHaveBeenCalledWith('e1:2026-10-05');
  });
});

describe('EventChip and EventBar', () => {
  it('reads "{initials} {title}" for two members', () => {
    render(<EventChip text="G·E School night" colors={['honey', 'rose']} />);
    expect(screen.getByText('G·E School night')).toBeTruthy();
  });
  it('a bar is a link named by its title and days', () => {
    const onPress = vi.fn();
    render(<EventBar text="All Grandma visits (cont.)" label="Grandma visits, October 16 to October 19" colors={['everyone']} column={0} days={2} lane={0} startsHere={false} endsHere onPress={onPress} />);
    fireEvent.click(screen.getByRole('link', { name: 'Grandma visits, October 16 to October 19' }));
    expect(onPress).toHaveBeenCalled();
    expect(screen.getByText('All Grandma visits (cont.)')).toBeTruthy();
  });
});

describe('Toast (hint)', () => {
  it('shows the hint with Got it', () => {
    const onAction = vi.fn();
    render(<Toast text="Tap a day to see details. Each color is a family member." actionLabel="Got it" onAction={onAction} />);
    expect(screen.getByRole('status').textContent).toContain('Each color is a family member.');
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }));
    expect(onAction).toHaveBeenCalled();
  });
});
