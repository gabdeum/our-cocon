// Spec 070: the calendar's parts from 600 wide: the header's segmented views and people chips, the
// month page with its selected day, and the Day view's mini month and "Coming up" rows.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { CalendarHeader } from './CalendarHeader';
import { MemberFilterChip } from './MemberChip';
import { ComingUpRow, MiniMonth, type MiniMonthDay } from './MiniMonth';
import { MonthPage } from './MonthGrid';

const dims = vi.hoisted(() => ({ width: 820, height: 1180 }));
vi.mock('react-native', async (actual) => ({ ...(await actual<typeof import('react-native')>()), useWindowDimensions: () => ({ ...dims, scale: 2, fontScale: 1 }) }));

afterEach(cleanup);

describe('CalendarHeader from 600', () => {
  it('shows the views as a segmented control, the people as chips, ‹ Today › and "+ Event"', () => {
    const onView = vi.fn();
    const onToggle = vi.fn();
    const onToggleChip = vi.fn();
    const onAdd = vi.fn();
    render(
      <CalendarHeader
        title="Sunday, October 25"
        prevLabel="Previous day"
        nextLabel="Next day"
        onPrev={vi.fn()}
        onNext={vi.fn()}
        todayLabel="Today"
        onToday={vi.fn()}
        views={[
          { key: 'month', label: 'Month' },
          { key: 'day', label: 'Day' },
        ]}
        view="day"
        onView={onView}
        viewsLabel="Calendar view"
        viewButtonLabel="View: Day"
        chips={[
          { key: 'g', name: 'Gabriel', initial: 'G', color: 'honey', pressed: true },
          { key: 'e', name: 'Eva', initial: 'E', color: 'rose', pressed: false },
        ]}
        onToggle={onToggle}
        onToggleChip={onToggleChip}
        onShowAll={vi.fn()}
        peopleLabel="1 of 2"
        peopleButtonLabel="Show events for: Gabriel"
        filterLabel="Show events for"
        showAllLabel="Show all"
        closeLabel="Close"
        toggle={{ label: 'Reminders', icon: 'alarm', pressed: true, onPress: vi.fn() }}
        arrows={false}
        add={{ label: 'Event', a11yLabel: 'Add event', onPress: onAdd }}
      />,
    );
    expect(screen.getByRole('heading').textContent).toBe('Sunday, October 25');
    // From 600 the arrows always show, beside Today.
    expect(screen.getByRole('button', { name: 'Previous day' })).toBeTruthy();
    fireEvent.click(within(screen.getByRole('group', { name: 'Calendar view' })).getByRole('button', { name: 'Month' }));
    expect(onView).toHaveBeenCalledWith('month');
    const eva = within(screen.getByRole('group', { name: 'Show events for' })).getByRole('button', { name: 'Eva' });
    expect(eva.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(eva);
    expect(onToggleChip).toHaveBeenCalledWith('e');
    expect(onToggle).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Add event' }));
    expect(onAdd).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Reminders' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^View: / })).toBeNull();
  });
});

describe('MemberFilterChip', () => {
  it('a hidden person reads not pressed, with the name struck through', () => {
    render(<MemberFilterChip name="Eva" initial="E" color="rose" pressed={false} onPress={vi.fn()} />);
    const chip = screen.getByRole('button', { name: 'Eva' });
    expect(chip.getAttribute('aria-pressed')).toBe('false');
    expect((within(chip).getByText('Eva') as HTMLElement).style.textDecorationLine || (within(chip).getByText('Eva') as HTMLElement).style.textDecoration).toContain('line-through');
  });
});

describe('MonthPage', () => {
  const cell = (date: string) => ({ date, label: `${date}: nothing planned`, dateText: String(Number(date.slice(8))), first: date.endsWith('-01'), today: date === '2026-10-27', past: false, items: [], more: null });
  it('marks the selected day pressed and taps select a day', () => {
    const onDayPress = vi.fn();
    const days = ['2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31'];
    render(
      <MonthPage
        weekdays={['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']}
        weeks={[{ key: 'w', cells: days.map(cell), bars: [] }]}
        month="2026-10-01"
        rowHeight={124}
        selected="2026-10-28"
        onDayPress={onDayPress}
        onDayLongPress={vi.fn()}
        addLabel="Add event"
      />,
    );
    expect(screen.getByRole('button', { name: '2026-10-28: nothing planned' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: '2026-10-27: nothing planned' }).getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(screen.getByRole('button', { name: '2026-10-30: nothing planned' }));
    expect(onDayPress).toHaveBeenCalledWith('2026-10-30');
  });
});

describe('MiniMonth and ComingUpRow', () => {
  it('names each day, marks the one shown as the current date, and opens a day', () => {
    const onPress = vi.fn();
    const day = (d: string, over: Partial<MiniMonthDay> = {}): MiniMonthDay => ({ date: d, num: String(Number(d.slice(8))), label: `October ${Number(d.slice(8))}`, selected: false, today: false, outside: false, hasEvents: false, ...over });
    render(
      <MiniMonth
        title="October"
        weekdays={['S', 'M', 'T', 'W', 'T', 'F', 'S']}
        days={[day('2026-10-25'), day('2026-10-26', { label: 'October 26, has events', hasEvents: true }), day('2026-10-27', { selected: true }), day('2026-10-28'), day('2026-10-29'), day('2026-10-30'), day('2026-10-31')]}
        onPress={onPress}
      />,
    );
    expect(screen.getByRole('heading', { name: 'October' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'October 27' }).getAttribute('aria-current')).toBe('date');
    fireEvent.click(screen.getByRole('button', { name: 'October 26, has events' }));
    expect(onPress).toHaveBeenCalledWith('2026-10-26');
  });

  it('a Coming up row reads as one button', () => {
    const onPress = vi.fn();
    render(<ComingUpRow weekday="Mon" num="26" text="Run · Baby yoga" label="Monday October 26: Run · Baby yoga" onPress={onPress} />);
    fireEvent.click(screen.getByRole('button', { name: 'Monday October 26: Run · Baby yoga' }));
    expect(onPress).toHaveBeenCalled();
  });
});
