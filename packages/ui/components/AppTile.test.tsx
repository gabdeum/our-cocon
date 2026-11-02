// AppTile (spec 029, OC-Menu): a part of the app in the Menu's Apps, in a grid of two that wraps.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { AppGrid } from './AppTile';

afterEach(cleanup);

describe('AppGrid', () => {
  it('is a navigation of links named by app and detail, two per row', () => {
    const onPress = vi.fn();
    const app = (key: string, name: string, detail: string) => ({ key, icon: 'calendar' as const, name, detail, onPress: () => onPress(key) });
    render(<AppGrid label="Apps" apps={[app('calendar', 'Calendar', '3 today'), app('recipes', 'Recipes', '48 recipes'), app('timers', 'Timers', 'None running')]} />);
    const nav = screen.getByRole('navigation', { name: 'Apps' });
    expect(within(nav).getAllByRole('link').map((l) => l.getAttribute('aria-label'))).toEqual(['Calendar, 3 today', 'Recipes, 48 recipes', 'Timers, None running']);
    fireEvent.click(screen.getByRole('link', { name: 'Timers, None running' }));
    expect(onPress).toHaveBeenCalledWith('timers');
    // A third app starts a new row; it keeps half the width.
    expect(nav.children).toHaveLength(2);
  });
});
