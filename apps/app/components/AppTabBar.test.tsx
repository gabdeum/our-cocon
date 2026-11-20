// Spec 002, User Story 2 › scenario 1: tapping a tab shows that screen, its tab expands with a
// honey fill and its label, and `tab_selected` is sent.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { createTracker, type AnalyticsTransport } from '@cocon/schemas';
import { AppTabBar, type TabNavigationProps } from './AppTabBar';
import { createTimerStore, TimersContext } from '../lib/timer-store';
import type { ChoiceStorage } from '../lib/recipe-choices';
import { fakeTracker } from '../test/fakes';

const dims = vi.hoisted(() => ({ width: 390, height: 844, scale: 3, fontScale: 1 }));
vi.mock('react-native', async (actual) => ({ ...(await actual<typeof import('react-native')>()), useWindowDimensions: () => ({ ...dims }) }));

afterEach(() => {
  cleanup();
  dims.width = 390;
});

const routes = ['index', 'calendar', 'recipes', 'groceries', 'menu'].map((name) => ({ key: `${name}-key`, name }));

const noStorage: ChoiceStorage = { getItem: async () => null, setItem: async () => undefined };

function Harness({
  transport,
  emitPrevented = false,
  store = createTimerStore({ storage: noStorage, userId: '', tracker: fakeTracker() }),
  onOpenTimers = vi.fn(),
  onOpenPage = vi.fn(),
}: {
  transport: AnalyticsTransport;
  emitPrevented?: boolean;
  store?: ReturnType<typeof createTimerStore>;
  onOpenTimers?: () => void;
  onOpenPage?: (key: 'reminders' | 'timers') => void;
}) {
  const [index, setIndex] = useState(0);
  const emitter: TabNavigationProps['emitter'] = { emit: () => ({ defaultPrevented: emitPrevented }) };
  const navigateToTab = (key: string) => setIndex(routes.findIndex((r) => r.key === key));
  return (
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <TimersContext.Provider value={store}>
        <AppTabBar state={{ index, routes }} emitter={emitter} navigateToTab={navigateToTab} tracker={createTracker(transport)} onOpenTimers={onOpenTimers} onOpenPage={onOpenPage} />
      </TimersContext.Provider>
    </SafeAreaProvider>
  );
}

const transport = () => ({ capture: vi.fn(), identify: vi.fn(), group: vi.fn(), reset: vi.fn() });

describe('AppTabBar', () => {
  it('opens the tapped tab, expands it with its label and sends tab_selected', () => {
    const t = transport();
    render(<Harness transport={t} />);
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Home' }).getAttribute('aria-current')).toBe('page');

    fireEvent.click(within(nav).getByRole('link', { name: 'Groceries' }));

    expect(within(nav).getByRole('link', { name: 'Groceries' }).getAttribute('aria-current')).toBe('page');
    expect(within(nav).getByRole('link', { name: 'Home' }).getAttribute('aria-current')).toBeNull();
    expect(screen.getByText('Groceries')).toBeTruthy();
    expect(screen.queryByText('Home')).toBeNull();
    expect(t.capture).toHaveBeenCalledExactlyOnceWith('tab_selected', { tab: 'groceries', nav: 'bar' });
  });

  it('spec 036 US1: Home · Calendar · Recipes · Groceries · Menu; Calendar and Menu open their screens', () => {
    const t = transport();
    render(<Harness transport={t} />);
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getAllByRole('link').map((l) => l.getAttribute('aria-label'))).toEqual(['Home', 'Calendar', 'Recipes', 'Groceries', 'Menu']);

    fireEvent.click(within(nav).getByRole('link', { name: 'Calendar' }));
    expect(within(nav).getByRole('link', { name: 'Calendar' }).getAttribute('aria-current')).toBe('page');
    expect(t.capture).toHaveBeenLastCalledWith('tab_selected', { tab: 'calendar', nav: 'bar' });

    // Menu is /menu (spec 029).
    fireEvent.click(within(nav).getByRole('link', { name: 'Menu' }));
    expect(within(nav).getByRole('link', { name: 'Menu' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByText('Menu')).toBeTruthy();
    expect(t.capture).toHaveBeenLastCalledWith('tab_selected', { tab: 'menu', nav: 'bar' });
  });

  it('sends nothing when the current tab is tapped again', () => {
    const t = transport();
    render(<Harness transport={t} />);
    fireEvent.click(screen.getByRole('link', { name: 'Home' }));
    expect(t.capture).not.toHaveBeenCalled();
  });

  it('respects a screen that handles the tap itself', () => {
    const t = transport();
    render(<Harness transport={t} emitPrevented />);
    fireEvent.click(screen.getByRole('link', { name: 'Recipes' }));
    expect(screen.getByRole('link', { name: 'Home' }).getAttribute('aria-current')).toBe('page');
    expect(t.capture).not.toHaveBeenCalled();
  });

  it('spec 011 US1: the TimerPill sits above the bar while a timer exists, with "+N" for the others', () => {
    const t = transport();
    const store = createTimerStore({ storage: noStorage, userId: '', tracker: fakeTracker() });
    const onOpenTimers = vi.fn();
    render(<Harness transport={t} store={store} onOpenTimers={onOpenTimers} />);
    expect(screen.queryByRole('link', { name: /Open timers/ })).toBeNull();

    act(() => void store.start('Blind bake', 12 * 60, 'step'));
    expect(screen.getByRole('link', { name: '1 timer running. Open timers' }).textContent).toBe('Blind bake12:00');
    act(() => void store.quick());
    const pill = screen.getByRole('link', { name: '2 timers running. Open timers' });
    expect(pill.textContent).toBe('Kitchen timer05:00+1');

    fireEvent.click(pill);
    expect(onOpenTimers).toHaveBeenCalledOnce();
    expect(t.capture).toHaveBeenCalledWith('timer_pill_tapped', { timer_count: 2 });
    store.destroy();
  });

  // Spec 064: the bar below 960, the side rail from 960, from the same tabs.
  describe('on larger windows', () => {
    it('SC-001: swaps bar and rail at 960 and keeps the current tab', () => {
      const t = transport();
      dims.width = 959;
      const { rerender } = render(<Harness transport={t} />);
      fireEvent.click(screen.getByRole('link', { name: 'Recipes' }));
      // The bar: only the current tab shows its label.
      expect(screen.queryByText('Home')).toBeNull();

      dims.width = 960;
      rerender(<Harness transport={t} />);
      const rail = screen.getByRole('navigation', { name: 'Main' });
      expect(within(rail).getByRole('link', { name: 'Recipes' }).getAttribute('aria-current')).toBe('page');
      // The rail: every label, in the TabBar's order (SC-002), with Reminders and Timers before Menu.
      expect(within(rail).getAllByRole('link').map((l) => l.textContent)).toEqual(['Home', 'Calendar', 'Recipes', 'Groceries', 'Reminders', 'Timers', 'Menu']);

      dims.width = 959;
      rerender(<Harness transport={t} />);
      expect(screen.getByRole('link', { name: 'Recipes' }).getAttribute('aria-current')).toBe('page');
      expect(screen.queryByText('Home')).toBeNull();
    });

    it('sends tab_selected with nav: rail from the rail', () => {
      const t = transport();
      dims.width = 1180;
      render(<Harness transport={t} />);
      fireEvent.click(screen.getByRole('link', { name: 'Groceries' }));
      expect(screen.getByRole('link', { name: 'Groceries' }).getAttribute('aria-current')).toBe('page');
      expect(t.capture).toHaveBeenCalledExactlyOnceWith('tab_selected', { tab: 'groceries', nav: 'rail' });
    });

    it('opens Reminders and Timers from the rail, over the current tab', () => {
      const t = transport();
      const onOpenPage = vi.fn();
      dims.width = 1180;
      render(<Harness transport={t} onOpenPage={onOpenPage} />);
      fireEvent.click(screen.getByRole('link', { name: 'Reminders' }));
      expect(onOpenPage).toHaveBeenCalledExactlyOnceWith('reminders');
      expect(screen.getByRole('link', { name: 'Home' }).getAttribute('aria-current')).toBe('page');
      fireEvent.click(screen.getByRole('link', { name: 'Timers' }));
      expect(onOpenPage).toHaveBeenLastCalledWith('timers');
      expect(t.capture.mock.calls).toEqual([
        ['tab_selected', { tab: 'reminders', nav: 'rail' }],
        ['tab_selected', { tab: 'timers', nav: 'rail' }],
      ]);
    });

    it('FR-002: shows the running timer at the bottom of the rail, time and "+N" only, and opens Timers', () => {
      const t = transport();
      const store = createTimerStore({ storage: noStorage, userId: '', tracker: fakeTracker() });
      const onOpenTimers = vi.fn();
      dims.width = 1180;
      render(<Harness transport={t} store={store} onOpenTimers={onOpenTimers} />);
      expect(screen.queryByRole('link', { name: /Open timers/ })).toBeNull();

      act(() => void store.start('Blind bake', 12 * 60, 'step'));
      act(() => void store.quick());
      const rail = screen.getByRole('navigation', { name: 'Main' });
      const pill = within(rail).getByRole('link', { name: '2 timers running. Kitchen timer 05:00. Open timers' });
      expect(pill.textContent).toBe('05:00+1');
      expect(within(rail).queryByRole('button', { name: 'Hide the timer pill. Timers keep running' })).toBeNull();

      fireEvent.click(pill);
      expect(onOpenTimers).toHaveBeenCalledOnce();
      expect(t.capture).toHaveBeenCalledWith('timer_pill_tapped', { timer_count: 2 });
      store.destroy();
    });
  });
});
