// Spec 064 FR-002 / FR-004: the side rail from 960 wide.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { NavRail } from './NavRail';
import { TimerPill } from './TimerPill';

afterEach(cleanup);

const items = [
  { key: 'home', label: 'Home', icon: 'home' },
  { key: 'calendar', label: 'Calendar', icon: 'calendar' },
  { key: 'recipes', label: 'Recipes', icon: 'recipes' },
  { key: 'groceries', label: 'Groceries', icon: 'groceries' },
  { key: 'menu', label: 'Menu', icon: 'menu' },
] as const;

describe('NavRail', () => {
  it('is the "Main" nav landmark with the five tabs in order, the active one the current page', () => {
    render(<NavRail label="Main" items={[...items]} active="recipes" onSelect={() => undefined} />);
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(nav.tagName).toBe('NAV');
    const links = within(nav).getAllByRole('link');
    expect(links.map((l) => l.getAttribute('aria-label'))).toEqual(['Home', 'Calendar', 'Recipes', 'Groceries', 'Menu']);
    expect(links.map((l) => l.getAttribute('aria-current'))).toEqual([null, null, 'page', null, null]);
  });

  it('always shows every label', () => {
    render(<NavRail label="Main" items={[...items]} active="home" onSelect={() => undefined} />);
    for (const { label } of items) expect(screen.getByText(label)).toBeTruthy();
  });

  it('reports which tab was tapped', () => {
    const onSelect = vi.fn();
    render(<NavRail label="Main" items={[...items]} active="home" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('link', { name: 'Groceries' }));
    expect(onSelect).toHaveBeenCalledWith('groceries');
  });

  it('floats in the 104 slot, 12 from the edges, 12 under the top safe area', () => {
    const { container } = render(<NavRail label="Main" items={[...items]} active="home" onSelect={() => undefined} insets={{ top: 24, bottom: 0 }} />);
    const slot = container.firstElementChild as HTMLElement;
    expect(slot.style).toMatchObject({ width: '104px', paddingLeft: '12px', paddingTop: '36px', paddingBottom: '12px' });
  });

  it('shows the timer at the bottom only when given one', () => {
    const { rerender } = render(<NavRail label="Main" items={[...items]} active="home" onSelect={() => undefined} />);
    expect(screen.queryByText('11:42')).toBeNull();
    rerender(
      <NavRail
        label="Main"
        items={[...items]}
        active="home"
        onSelect={() => undefined}
        timer={<TimerPill vertical name="Blind bake" clock="11:42" more="+1" label="2 timers running. Blind bake 11:42. Open timers" onPress={() => undefined} />}
      />,
    );
    const nav = screen.getByRole('navigation', { name: 'Main' });
    const links = within(nav).getAllByRole('link');
    expect(links.at(-1)?.getAttribute('aria-label')).toBe('2 timers running. Blind bake 11:42. Open timers');
  });
});

describe('TimerPill, vertical', () => {
  it('shows the clock and "+N", not the name or the ✕, and opens timers', () => {
    const onPress = vi.fn();
    render(<TimerPill vertical name="Blind bake" clock="11:42" more="+1" label="2 timers running. Blind bake 11:42. Open timers" onPress={onPress} onHide={() => undefined} hideLabel="Hide" />);
    expect(screen.getByText('11:42')).toBeTruthy();
    expect(screen.getByText('+1')).toBeTruthy();
    expect(screen.queryByText('Blind bake')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Hide' })).toBeNull();
    fireEvent.click(screen.getByRole('link', { name: '2 timers running. Blind bake 11:42. Open timers' }));
    expect(onPress).toHaveBeenCalledOnce();
  });
});
