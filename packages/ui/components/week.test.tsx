// Spec 038: the week grid (days, all-day bars, blocks at their times, today, taps) and the swipe.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AccessibilityInfo, Animated, PanResponder, Text, type GestureResponderEvent, type PanResponderCallbacks, type PanResponderGestureState } from 'react-native';
import { HourGrid, hourAt, type HourGridProps, type WeekColumn } from './HourGrid';
import { Swipeable } from './Swipeable';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const dates = ['2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31'];
const columns: WeekColumn[] = dates.map((date, i) => ({
  date,
  label: `Column ${date}`,
  addLabel: `Add event, day ${i}`,
  today: i === 0,
  blocks:
    i === 0
      ? [
          { key: 'swim|', top: 'J', title: 'Baby swim', label: 'Baby swim, Sunday, 14:30 to 16:30', colors: ['sky'], kind: 'custom', y: 307, height: 70, lane: 0, lanes: 2 },
          { key: 'coffee|', top: 'G', title: 'Coffee', label: 'Coffee, Sunday, 16:00 to 17:00', colors: ['honey'], kind: 'custom', y: 361, height: 34, lane: 1, lanes: 2 },
          { key: 'brunch|', top: 'All Lunch', title: 'Brunch', label: 'Brunch, Sunday, Lunch', colors: ['everyone'], kind: 'slot', y: 217, height: 70, lane: 0, lanes: 1 },
        ]
      : [],
}));

function grid(over: Partial<HourGridProps> = {}) {
  const props: HourGridProps = {
    days: dates.map((date, i) => ({ date, letter: 'SMTWTFS'[i] ?? '', num: date.slice(8).replace(/^0/, ''), label: `Day ${date}`, today: i === 0 })),
    allDayLabel: 'All day',
    bars: [{ key: 'trip|', text: 'E Lyon trip', label: 'Lyon trip, October 28 to October 30', colors: ['rose'], column: 3, days: 3, lane: 0, startsHere: true, endsHere: true }],
    columns,
    hourLabels: Array.from({ length: 18 }, (_, i) => `${String(i + 6).padStart(2, '0')}:00`),
    nowY: 264,
    onDayPress: vi.fn(),
    onBlockPress: vi.fn(),
    onEmptyLongPress: vi.fn(),
    ...over,
  };
  render(<HourGrid {...props} />);
  return props;
}

const px = (el: HTMLElement | null | undefined, prop: 'top' | 'height' | 'left' | 'width') => el?.style[prop];

describe('HourGrid (spec 038)', () => {
  it('US1: overlapping events sit side by side at their exact times', () => {
    grid();
    const swim = screen.getByRole('link', { name: 'Baby swim, Sunday, 14:30 to 16:30' }).parentElement;
    const coffee = screen.getByRole('link', { name: 'Coffee, Sunday, 16:00 to 17:00' }).parentElement;
    expect([px(swim, 'top'), px(swim, 'height'), px(swim, 'left'), px(swim, 'width')]).toEqual(['307px', '70px', '0%', '50%']);
    expect([px(coffee, 'top'), px(coffee, 'height'), px(coffee, 'left'), px(coffee, 'width')]).toEqual(['361px', '34px', '50%', '50%']);
    expect(screen.getByRole('link', { name: 'Brunch, Sunday, Lunch' }).textContent).toBe('All LunchBrunch');
    expect(screen.getByRole('link', { name: 'Lyon trip, October 28 to October 30' }).textContent).toBe('E Lyon trip');
    expect(screen.getByText('All day')).toBeTruthy();
    expect(screen.getByText('06:00')).toBeTruthy();
    expect(screen.getByText('23:00')).toBeTruthy();
  });

  it('a day opens Day view, from its head or an empty part of it; a block opens the event; a long press adds one', () => {
    const p = grid();
    fireEvent.click(screen.getByRole('link', { name: 'Day 2026-10-27' }));
    expect(p.onDayPress).toHaveBeenCalledWith('2026-10-27');
    fireEvent.click(screen.getByRole('link', { name: 'Coffee, Sunday, 16:00 to 17:00' }));
    expect(p.onBlockPress).toHaveBeenCalledWith('coffee|');
    fireEvent.click(screen.getByRole('link', { name: 'Lyon trip, October 28 to October 30' }));
    expect(p.onBlockPress).toHaveBeenCalledWith('trip|');
    fireEvent.click(screen.getByRole('link', { name: 'Column 2026-10-28' }));
    expect(p.onDayPress).toHaveBeenLastCalledWith('2026-10-28');
    expect(p.onEmptyLongPress).not.toHaveBeenCalled();
    vi.useFakeTimers();
    const column = screen.getByRole('link', { name: 'Column 2026-10-29' });
    fireEvent.mouseDown(column, { button: 0, buttons: 1 });
    vi.advanceTimersByTime(600);
    fireEvent.mouseUp(column, { button: 0 });
    vi.useRealTimers();
    expect(p.onEmptyLongPress).toHaveBeenCalledWith('2026-10-29', expect.toSatisfy((h: number | null) => h === null || (h >= 6 && h <= 23)));
  });

  it('FR-005: the hour under a tap, kept inside 06:00–23:00', () => {
    expect(hourAt(0)).toBe(6);
    expect(hourAt(324)).toBe(15);
    expect(hourAt(647)).toBe(23);
    expect(hourAt(900)).toBe(23);
    expect(hourAt(-5)).toBe(6);
    expect(hourAt(undefined)).toBeNull();
  });

  it('FR-003: the now line is drawn in today’s column only, and not at all when nowY is null', () => {
    const { container } = render(<HourGrid {...grid()} />);
    const lines = () => [...container.querySelectorAll<HTMLElement>('[aria-hidden="true"]')].filter((el) => el.style.top === '264px' && el.style.left === '-2px');
    expect(lines()).toHaveLength(1);
    cleanup();
    const again = render(<HourGrid {...grid({ nowY: null })} />);
    expect([...again.container.querySelectorAll<HTMLElement>('[aria-hidden="true"]')].some((el) => el.style.left === '-2px')).toBe(false);
  });
});

function swipeable(reduce = false) {
  const configs: PanResponderCallbacks[] = [];
  vi.spyOn(PanResponder, 'create').mockImplementation((config) => {
    configs.push(config);
    return { panHandlers: {} } as ReturnType<typeof PanResponder.create>;
  });
  vi.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(reduce);
  const onSwipe = vi.fn();
  const view = render(
    <Swipeable page="2026-10-25" onSwipe={onSwipe}>
      <Text>Week</Text>
    </Swipeable>,
  );
  const release = (dx: number) => {
    const config = configs.at(-1);
    const g = { dx, dy: 0 } as PanResponderGestureState;
    act(() => config?.onPanResponderMove?.({} as GestureResponderEvent, g));
    act(() => config?.onPanResponderRelease?.({} as GestureResponderEvent, g));
  };
  const box = () => screen.getByText('Week').parentElement as HTMLElement;
  return { onSwipe, release, box, rerender: view.rerender, claims: (dx: number, dy: number) => configs.at(-1)?.onMoveShouldSetPanResponderCapture?.({} as GestureResponderEvent, { dx, dy } as PanResponderGestureState) };
}

describe('Swipeable (spec 038 FR-004)', () => {
  it('US2: a swipe of 60 px or more moves a week; less snaps back', async () => {
    const s = swipeable();
    await act(async () => undefined);
    s.release(-80);
    expect(s.onSwipe).toHaveBeenLastCalledWith(1);
    s.release(80);
    expect(s.onSwipe).toHaveBeenLastCalledWith(-1);
    s.onSwipe.mockClear();
    s.release(-40);
    s.release(59);
    expect(s.onSwipe).not.toHaveBeenCalled();
  });

  it('claims sideways drags only, so vertical scrolling still works', async () => {
    const s = swipeable();
    await act(async () => undefined);
    expect(s.claims(30, 5)).toBe(true);
    expect(s.claims(5, 30)).toBe(false);
    expect(s.claims(4, 0)).toBe(false);
  });

  it('a new page slides in (220 ms) from its side; with Reduce Motion it appears in place', async () => {
    const s = swipeable();
    await act(async () => undefined);
    const timing = vi.spyOn(Animated, 'timing');
    s.rerender(
      <Swipeable page="2026-11-01" onSwipe={s.onSwipe}>
        <Text>Week</Text>
      </Swipeable>,
    );
    expect(timing).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ toValue: 0, duration: 220 }));
    cleanup();
    vi.restoreAllMocks();

    const r = swipeable(true);
    await act(async () => undefined);
    const still = vi.spyOn(Animated, 'timing');
    r.rerender(
      <Swipeable page="2026-10-18" onSwipe={r.onSwipe}>
        <Text>Week</Text>
      </Swipeable>,
    );
    expect(still).not.toHaveBeenCalled();
    expect(r.box().style.transform).toContain('translateX(0px)');
  });
});
