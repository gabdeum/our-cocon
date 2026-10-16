// Spec 002, User Story 2 › scenario 1: tapping a tab shows that screen, its tab expands with a
// honey fill and its label, and `tab_selected` is sent.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { createTracker, type AnalyticsTransport } from '@cocon/schemas';
import { AppTabBar, type TabNavigationProps } from './AppTabBar';

afterEach(cleanup);

const routes = ['index', 'recipes', 'groceries', 'settings'].map((name) => ({ key: `${name}-key`, name }));

function Harness({ transport, emitPrevented = false }: { transport: AnalyticsTransport; emitPrevented?: boolean }) {
  const [index, setIndex] = useState(0);
  const navigation: TabNavigationProps['navigation'] = {
    navigate: (name) => setIndex(routes.findIndex((r) => r.name === name)),
    emit: () => ({ defaultPrevented: emitPrevented }),
  };
  return (
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <AppTabBar state={{ index, routes }} navigation={navigation} tracker={createTracker(transport)} />
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
    expect(t.capture).toHaveBeenCalledExactlyOnceWith('tab_selected', { tab: 'groceries' });
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
});
