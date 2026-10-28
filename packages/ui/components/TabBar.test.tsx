import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { TabBar, TAB_LABEL_MIN_SCALE } from './TabBar';
import { TimerPill } from './TimerPill';

afterEach(cleanup);

const items = [
  { key: 'home', label: 'Home', icon: 'home' },
  { key: 'calendar', label: 'Calendar', icon: 'calendar' },
  { key: 'recipes', label: 'Recipes', icon: 'recipes' },
  { key: 'groceries', label: 'Groceries', icon: 'groceries' },
  { key: 'menu', label: 'Menu', icon: 'menu' },
] as const;

describe('TabBar', () => {
  it('is the main navigation with five labelled links, the active one marked as the current page', () => {
    render(<TabBar label="Main" items={[...items]} active="recipes" onSelect={() => undefined} />);
    const nav = screen.getByRole('navigation', { name: 'Main' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((l) => l.getAttribute('aria-label'))).toEqual(['Home', 'Calendar', 'Recipes', 'Groceries', 'Menu']);
    expect(links.map((l) => l.getAttribute('aria-current'))).toEqual([null, null, 'page', null, null]);
  });

  it('shows the label on the active tab only', () => {
    render(<TabBar label="Main" items={[...items]} active="home" onSelect={() => undefined} />);
    expect(screen.getByText('Home')).toBeTruthy();
    expect(screen.queryByText('Groceries')).toBeNull();
  });

  it('keeps the active label on one line, shrinking to 13 px at most', () => {
    render(<TabBar label="Main" items={[...items]} active="groceries" onSelect={() => undefined} />);
    const label = screen.getByText('Groceries');
    expect(getComputedStyle(label).whiteSpace).toBe('nowrap');
    expect(15 * TAB_LABEL_MIN_SCALE).toBe(13);
  });

  it('spec 036 FR-001: the selected tab is a fixed 132 px and never grows; the others share the rest', () => {
    render(<TabBar label="Main" items={[...items]} active="calendar" onSelect={() => undefined} />);
    const style = (name: string) => screen.getByRole('link', { name }).style;
    expect(style('Calendar')).toMatchObject({ flexBasis: '132px', minWidth: '132px', flexGrow: '0', flexShrink: '0' });
    expect(style('Home')).toMatchObject({ flexGrow: '1', minWidth: '44px' });
  });

  it('a tab that was selected goes back to sharing the rest (the iPhone kept it 132 wide)', () => {
    const { rerender } = render(<TabBar label="Main" items={[...items]} active="home" onSelect={() => undefined} />);
    rerender(<TabBar label="Main" items={[...items]} active="calendar" onSelect={() => undefined} />);
    expect(screen.getByRole('link', { name: 'Home' }).style).toMatchObject({ flexBasis: '0px', flexGrow: '1', minWidth: '44px', paddingLeft: '0px' });
  });

  it('reports which tab was tapped', () => {
    const onSelect = vi.fn();
    render(<TabBar label="Main" items={[...items]} active="home" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('link', { name: 'Menu' }));
    expect(onSelect).toHaveBeenCalledWith('menu');
  });

  it('reserves 100 px, or 160 px with the timer pill above the bar (FR-005)', () => {
    const { container, rerender } = render(<TabBar label="Main" items={[...items]} active="home" onSelect={() => undefined} />);
    const box = () => container.firstElementChild as HTMLElement;
    expect(box().style.height).toBe('100px');
    rerender(
      <TabBar
        label="Main"
        items={[...items]}
        active="home"
        onSelect={() => undefined}
        timerPill={<TimerPill name="Blind bake" clock="11:42" more="+1" label="2 timers running. Open timers" onPress={() => undefined} />}
      />,
    );
    expect(box().style.height).toBe('160px');
    expect(screen.getByRole('link', { name: '2 timers running. Open timers' })).toBeTruthy();
  });
});
