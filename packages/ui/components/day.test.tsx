// Spec 039: the day view's pieces: a band with its rows or its add row, an All day row, and the
// busy count chip.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemberCount } from './MemberChip';
import { AllDayRow, SlotBand, type DayBand } from './SlotBand';
import { FloatingAdd } from './Toast';

afterEach(cleanup);

const band = (over: Partial<DayBand> = {}): DayBand => ({
  key: 'afternoon',
  title: 'Afternoon',
  hours: '14:00–18:00',
  events: [],
  addText: '+ Add in the afternoon',
  addLabel: 'Add event in the afternoon, Sunday October 25',
  ...over,
});

describe('SlotBand', () => {
  it('shows its title and hours, and an add row when empty', () => {
    const onAdd = vi.fn();
    render(<SlotBand band={band()} onEventPress={vi.fn()} onAdd={onAdd} />);
    expect(screen.getByRole('heading').textContent).toBe('Afternoon14:00–18:00');
    fireEvent.click(screen.getByRole('button', { name: 'Add event in the afternoon, Sunday October 25' }));
    expect(screen.getByText('+ Add in the afternoon')).toBeTruthy();
    expect(onAdd).toHaveBeenCalled();
  });

  it('shows each event with its time, who takes whom and Now, and no add row', () => {
    const onEventPress = vi.fn();
    const swim = { key: 'swim', title: 'Baby swim class', time: '14:30 · Aquatic Center', driver: 'Gabriel takes James', nowText: 'Now', initials: 'J', colors: ['mint' as const], label: 'Baby swim class, 14:30 · Aquatic Center, Gabriel takes James, happening now' };
    render(<SlotBand band={band({ events: [swim] })} onEventPress={onEventPress} onAdd={vi.fn()} />);
    for (const text of ['Baby swim class', '14:30 · Aquatic Center', 'Gabriel takes James', 'Now', 'J']) expect(screen.getByText(text)).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
    fireEvent.click(screen.getByRole('link', { name: swim.label }));
    expect(onEventPress).toHaveBeenCalledWith('swim');
  });
});

describe('AllDayRow', () => {
  it('shows the title and its tag, and opens the event', () => {
    const onPress = vi.fn();
    render(<AllDayRow item={{ key: 'lyon', title: 'Lyon trip', tag: 'Day 2 of 3', colors: ['rose'], label: 'Lyon trip, all day, Day 2 of 3' }} onPress={onPress} />);
    expect(screen.getByText('Day 2 of 3')).toBeTruthy();
    fireEvent.click(screen.getByRole('link', { name: 'Lyon trip, all day, Day 2 of 3' }));
    expect(onPress).toHaveBeenCalled();
  });
});

describe('MemberCount', () => {
  it('shows the initial and "{name} {count}", and is not a control', () => {
    render(<MemberCount text="Gabriel 2" initial="G" color="honey" />);
    expect(screen.getByText('Gabriel 2')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('FloatingAdd', () => {
  it('hides while a toast shows', () => {
    render(<FloatingAdd label="Add event" onPress={vi.fn()} hidden />);
    expect(screen.queryByRole('button', { name: 'Add event' })).toBeNull();
  });
});
