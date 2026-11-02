// Spec 029 US1 and SC-001 (design/ui/OC-Menu.md): the Menu's Apps and Settings, and where each goes.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { fakeTracker } from '../../test/fakes';
import { MenuScreen, type MenuScreenProps } from './MenuScreen';

afterEach(cleanup);

function setup(over: Partial<MenuScreenProps> = {}) {
  const props: MenuScreenProps = {
    details: { calendar: '3 today', recipes: '48 recipes', groceries: '7 to buy', timers: 'None running' },
    memberNames: ['Gabriel', 'Eva', 'James'],
    connected: 2,
    deleted: 1,
    tracker: fakeTracker(),
    onNavigate: vi.fn(),
    ...over,
  };
  render(<MenuScreen {...props} />);
  return props;
}

describe('Menu (OC-Menu)', () => {
  it('US1: the title, then Apps, then Settings, as drawn', () => {
    setup();
    expect(screen.getAllByRole('heading').map((h) => h.textContent)).toEqual(['Menu', 'Apps', 'Settings']);
    const apps = screen.getByRole('navigation', { name: 'Apps' });
    expect(within(apps).getAllByRole('link').map((l) => l.getAttribute('aria-label'))).toEqual([
      'Calendar, 3 today',
      'Recipes, 48 recipes',
      'Groceries, 7 to buy',
      'Timers, None running',
    ]);
    const rows = screen.getAllByRole('link').filter((l) => !apps.contains(l)).map((l) => l.textContent);
    expect(rows).toEqual([
      'FamilyGabriel, Eva, James · your account',
      'AI assistants2 connected',
      'CalendarYour view, times of day',
      'RecipesCooking defaults, units',
      'GroceriesWhere you shop, store sizes',
      'Recently deleted1 item',
    ]);
  });

  it('SC-001: every tile and row opens its screen, and says which', () => {
    const { onNavigate, tracker } = setup();
    const go = (name: RegExp) => {
      fireEvent.click(screen.getByRole('link', { name }));
      return (onNavigate as ReturnType<typeof vi.fn>).mock.lastCall?.[0];
    };
    expect(go(/^Calendar, 3 today/)).toBe('/calendar');
    expect(tracker.track).toHaveBeenLastCalledWith('menu_app_opened', { app: 'calendar' });
    expect(go(/^Recipes, 48/)).toBe('/recipes');
    expect(go(/^Groceries, 7/)).toBe('/groceries');
    expect(go(/^Timers/)).toBe('/timers');
    expect(tracker.track).toHaveBeenLastCalledWith('menu_app_opened', { app: 'timers' });
    expect(go(/^Family/)).toBe('/settings/family');
    expect(tracker.track).toHaveBeenLastCalledWith('settings_row_opened', { row: 'family' });
    expect(go(/^AI assistants/)).toBe('/settings/ai');
    expect(go(/Your view, times of day/)).toBe('/settings/calendar');
    expect(go(/Cooking defaults/)).toBe('/settings/recipes');
    expect(go(/Where you shop/)).toBe('/settings/groceries');
    expect(go(/^Recently deleted/)).toBe('/settings/deleted');
    expect(tracker.track).toHaveBeenLastCalledWith('settings_row_opened', { row: 'deleted' });
  });

  it('States: nothing yet, all done, paused timers, no assistants, empty bin', () => {
    setup({ details: { calendar: 'Nothing today', recipes: 'No recipes yet', groceries: 'All done', timers: '2 paused' }, connected: 0, deleted: 0 });
    expect(screen.getByRole('link', { name: 'Timers, 2 paused' })).toBeTruthy();
    expect(screen.getByText('Not connected')).toBeTruthy();
    expect(screen.getByText('Empty')).toBeTruthy();
  });
});
