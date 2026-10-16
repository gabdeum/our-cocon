import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { TabBar, TAB_LABEL_MIN_SCALE } from './TabBar';
import { TimerPill } from './TimerPill';

afterEach(cleanup);

const items = [
  { key: 'home', label: 'Home', icon: 'home' },
  { key: 'recipes', label: 'Recipes', icon: 'recipes' },
  { key: 'groceries', label: 'Groceries', icon: 'groceries' },
  { key: 'settings', label: 'Settings', icon: 'settings' },
] as const;

describe('TabBar', () => {
  it('is the main navigation with four labelled links, the active one marked as the current page', () => {
    render(<TabBar label="Main" items={[...items]} active="recipes" onSelect={() => undefined} />);
    const nav = screen.getByRole('navigation', { name: 'Main' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((l) => l.getAttribute('aria-label'))).toEqual(['Home', 'Recipes', 'Groceries', 'Settings']);
    expect(links.map((l) => l.getAttribute('aria-current'))).toEqual([null, 'page', null, null]);
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

  it('reports which tab was tapped', () => {
    const onSelect = vi.fn();
    render(<TabBar label="Main" items={[...items]} active="home" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('link', { name: 'Settings' }));
    expect(onSelect).toHaveBeenCalledWith('settings');
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
