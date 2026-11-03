// Spec 028 (OC-Home, CalCard): what's on today (US1), this week or nothing (US2), the latest
// recipe (US3), the tiles (US4), and the edge cases: no recipes, a new family, Busy.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { HomeHero, StoredEvent } from '@cocon/data';
import { ToastProvider } from '../../lib/toast';
import { fakeTracker, gabriel, groceryItem, james, mia, storedEvent } from '../../test/fakes';
import { HomeScreen, type HomeScreenProps } from './HomeScreen';

afterEach(cleanup);

const eva = { ...mia, id: 'm-eva', display_name: 'Eva', color: 'rose' as const };
const TODAY = '2026-10-25';
const ev = (fields: Partial<StoredEvent>) => storedEvent({ starts_on: TODAY, ends_on: TODAY, ...fields });
const on = (date: string, title: string, fields: Partial<StoredEvent> = {}) => ev({ title, starts_on: date, ends_on: date, ...fields });
const quiche: HomeHero = {
  id: 'r-quiche',
  name: 'Leek & bacon quiche',
  serves: 6,
  total_minutes: 70,
  photo_path: null,
  ingredients: [
    { name: 'Leeks', catalog_key: 'leek' },
    { name: 'Onion', catalog_key: 'onion' },
    { name: 'Bacon', catalog_key: 'bacon' },
  ],
};

function setup(over: Partial<HomeScreenProps> = {}) {
  const navigate = {
    recipe: vi.fn(),
    newRecipe: vi.fn(),
    groceries: vi.fn(),
    recipes: vi.fn(),
    family: vi.fn(),
    activity: vi.fn(),
    event: vi.fn(),
    agenda: vi.fn(),
    calendar: vi.fn(),
    addEvent: vi.fn(),
  };
  const props: HomeScreenProps = {
    me: gabriel,
    members: [gabriel, eva, james],
    today: TODAY,
    now: '12:30',
    events: [],
    hero: quiche,
    groceries: [groceryItem({ name: 'Leek', catalog_key: 'leek' })],
    recipeCount: 32,
    activity: [],
    activityShow: 'all' as const,
    onActivityShow: vi.fn(),
    onUndo: vi.fn(),
    tracker: fakeTracker(),
    navigate,
    ...over,
  };
  render(<HomeScreen {...props} />, { wrapper: ToastProvider });
  return { ...props, navigate };
}
const card = () => within(screen.getByRole('region', { name: 'Family calendar' }));

describe('Home', () => {
  it('FR-001, FR-007: brand row, the family, the date and greeting', () => {
    const { navigate } = setup();
    expect(screen.getByText('Our Cocon')).toBeTruthy();
    expect(screen.getByText('Sunday, Oct 25')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Hi Gabriel' })).toBeTruthy();
    fireEvent.click(screen.getByRole('link', { name: 'Family: Gabriel, Eva, James' }));
    expect(navigate.family).toHaveBeenCalled();
  });

  it('US1: today’s events under a Today · This week toggle, the birthday banner, "Now" and Open calendar', () => {
    const { navigate, tracker } = setup({
      events: [
        ev({ title: 'Movie night', slots: ['evening'], members: ['everyone'] }),
        ev({ title: 'Brunch at Grandma’s', slots: ['lunch'], location: 'Grandma’s house', members: ['everyone'] }),
        ev({ title: 'Baby swim class', slots: ['afternoon'], members: [james.id], responsible_member_id: gabriel.id }),
        on('2026-10-27', 'Eva’s birthday', { category: 'birthday', time_type: 'all_day', slots: [], recurrence: { freq: 'yearly', ends: { type: 'never' } }, members: [eva.id] }),
      ],
    });
    expect(card().getByRole('button', { name: 'Today' }).getAttribute('aria-pressed')).toBe('true');
    expect(card().getByText('Eva’s birthday is on Tuesday')).toBeTruthy();
    const rows = card()
      .getAllByRole('link')
      .map((l) => l.getAttribute('aria-label'))
      .filter(Boolean);
    expect(rows).toEqual(['Brunch at Grandma’s, Lunch · Grandma’s house, Now', 'Baby swim class, Afternoon · Gabriel takes James', 'Movie night, Evening']);
    fireEvent.click(card().getByRole('link', { name: 'Brunch at Grandma’s, Lunch · Grandma’s house, Now' }));
    expect(navigate.event).toHaveBeenCalledWith(expect.any(String), TODAY);
    expect(tracker.track).toHaveBeenCalledWith('homepage_calendar_event_tapped', { section: 'today', card_state: 'today' });
    fireEvent.click(card().getByText('Open calendar'));
    expect(navigate.calendar).toHaveBeenCalled();
    fireEvent.click(card().getByRole('button', { name: 'Add event' }));
    expect(navigate.addEvent).toHaveBeenCalledWith(TODAY);
    expect(tracker.track).toHaveBeenCalledWith('homepage_calendar_add_tapped', { card_state: 'today' });
    // The toggle shows the week, and isn't remembered.
    fireEvent.click(card().getByRole('button', { name: 'This week' }));
    expect(tracker.track).toHaveBeenCalledWith('homepage_calendar_toggled', { to: 'week' });
    expect(card().getByRole('button', { name: 'Today, October 25, 2 people busy' })).toBeTruthy();
  });

  it('US2.1: nothing today: "This week", the strip, five rows and See all', () => {
    const { navigate, tracker } = setup({
      events: [
        on('2026-10-26', 'Morning run', { time_type: 'custom', slots: [], start_time: '06:30', end_time: '07:00' }),
        on('2026-10-27', 'Yoga', { slots: ['evening'], members: [eva.id] }),
        on('2026-10-28', 'Pediatrician', { time_type: 'custom', slots: [], start_time: '10:00', end_time: '11:00', members: [james.id] }),
        on('2026-10-29', 'Piano', { members: [james.id] }),
        on('2026-10-30', 'Market', { members: ['everyone'] }),
        on('2026-10-31', 'Football', { slots: ['afternoon'] }),
        on('2026-10-31', 'Dinner out', { slots: ['evening'] }),
      ],
    });
    expect(card().getByRole('heading', { name: 'This week' })).toBeTruthy();
    expect(card().queryByRole('button', { name: 'Today' })).toBeNull();
    expect(card().getByRole('link', { name: 'Tue, Yoga, Evening · Eva' })).toBeTruthy();
    expect(card().queryByRole('link', { name: /Football/ })).toBeNull();
    fireEvent.click(card().getByRole('button', { name: 'See all (2 more)' }));
    expect(navigate.agenda).toHaveBeenCalled();
    fireEvent.click(card().getByRole('link', { name: 'Tue, Yoga, Evening · Eva' }));
    expect(tracker.track).toHaveBeenCalledWith('homepage_calendar_event_tapped', { section: 'week', card_state: 'week' });
    fireEvent.click(card().getByRole('button', { name: 'Add event' }));
    // The next free day: today.
    expect(navigate.addEvent).toHaveBeenCalledWith(TODAY);
  });

  it('US2.3: a strip day shows only that day; tapping it again or "Whole week" goes back', () => {
    const { navigate, tracker } = setup({
      events: [
        on('2026-10-26', 'Morning run', { time_type: 'custom', slots: [], start_time: '06:30', end_time: '07:00' }),
        on('2026-10-28', 'Pediatrician', { time_type: 'custom', slots: [], start_time: '10:00', end_time: '11:00', members: [james.id] }),
      ],
    });
    const wed = () => card().getByRole('button', { name: 'October 28, 1 person busy' });
    fireEvent.click(wed());
    expect(wed().getAttribute('aria-pressed')).toBe('true');
    expect(tracker.track).toHaveBeenCalledWith('homepage_calendar_day_picked', { day_offset: 3 });
    expect(card().getByRole('heading', { name: 'Wednesday, Oct. 28' })).toBeTruthy();
    expect(card().getByRole('link', { name: /^Pediatrician, 10:00/ })).toBeTruthy();
    expect(card().queryByRole('link', { name: /Morning run/ })).toBeNull();
    // "+" adds on the picked day.
    fireEvent.click(card().getByRole('button', { name: 'Add event on Wednesday' }));
    expect(navigate.addEvent).toHaveBeenCalledWith('2026-10-28');
    // Tapping it again: the whole week.
    fireEvent.click(wed());
    expect(card().getByRole('link', { name: 'Mon, Morning run, 06:30 · Gabriel' })).toBeTruthy();
    // An empty day, then "Whole week".
    fireEvent.click(card().getByRole('button', { name: 'October 29, nothing planned' }));
    expect(card().getByText('Nothing planned on Thursday.')).toBeTruthy();
    fireEvent.click(card().getByRole('button', { name: 'Whole week' }));
    expect(card().getByRole('link', { name: 'Mon, Morning run, 06:30 · Gabriel' })).toBeTruthy();
  });

  it('US2.2: nothing in the next 7 days asks to add one, with no footer', () => {
    const { navigate, tracker } = setup();
    expect(card().getByRole('heading', { name: 'Calendar' })).toBeTruthy();
    expect(card().getByText('No events in the next 7 days. Add one?')).toBeTruthy();
    expect(card().queryByText('Open calendar')).toBeNull();
    fireEvent.click(card().getByRole('button', { name: '+ Add event' }));
    expect(navigate.addEvent).toHaveBeenCalledWith(TODAY);
    expect(tracker.track).toHaveBeenCalledWith('homepage_calendar_add_tapped', { card_state: 'empty' });
  });

  it('someone else’s private event reads "Busy" in their color and opens the Busy sheet', () => {
    const { navigate } = setup({ events: [ev({ title: 'Therapy', visibility: 'private', creator_member_id: eva.id, members: [eva.id] })] });
    expect(screen.queryByText('Therapy')).toBeNull();
    fireEvent.click(card().getByRole('link', { name: 'Busy, Morning' }));
    expect(navigate.event).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('US3: the latest recipe with its time, servings and what’s left to buy; opens the recipe', () => {
    const { navigate, tracker } = setup();
    expect(screen.getByText('Latest recipe')).toBeTruthy();
    expect(screen.getByText('Leek & bacon quiche')).toBeTruthy();
    expect(screen.getByText('1 h 10')).toBeTruthy();
    expect(screen.getByText('Serves 6')).toBeTruthy();
    expect(screen.getByText('2 to buy')).toBeTruthy();
    fireEvent.click(screen.getByText('Leek & bacon quiche'));
    expect(navigate.recipe).toHaveBeenCalledWith('r-quiche');
    expect(tracker.track).toHaveBeenCalledWith('home_hero_opened', {});
  });

  it('US3: no time chip without a total time, no "to buy" when everything is on the list', () => {
    setup({ hero: { ...quiche, total_minutes: null, ingredients: [{ name: 'Leeks', catalog_key: 'leek' }] } });
    expect(screen.queryByText('1 h 10')).toBeNull();
    expect(screen.queryByText(/^\d+ to buy$/)).toBeNull();
  });

  it('US4: the tiles count the list and the recipes, and open their tabs', () => {
    const { navigate, tracker } = setup({
      groceries: [groceryItem({ id: 'a', name: 'Leek', catalog_key: 'leek' }), groceryItem({ id: 'b', name: 'Leek', catalog_key: 'leek' }), groceryItem({ id: 'c', name: 'Milk', catalog_key: 'milk' }), groceryItem({ id: 'd', name: 'Eggs', catalog_key: 'egg', checked: true })],
    });
    // As Groceries counts them: one row per thing still to buy.
    fireEvent.click(screen.getByRole('link', { name: '2 to buy' }));
    expect(navigate.groceries).toHaveBeenCalled();
    expect(tracker.track).toHaveBeenCalledWith('home_tile_tapped', { tile: 'groceries' });
    fireEvent.click(screen.getByRole('link', { name: '32 family recipes' }));
    expect(navigate.recipes).toHaveBeenCalled();
    expect(tracker.track).toHaveBeenCalledWith('home_tile_tapped', { tile: 'recipes' });
  });

  it('no recipes yet: "What’s for dinner?" opens the form', () => {
    const { navigate, tracker } = setup({ hero: null, recipeCount: 0 });
    expect(screen.getByText("What's for dinner?")).toBeTruthy();
    expect(screen.getByRole('link', { name: '0 family recipes' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add your first recipe' }));
    expect(navigate.newRecipe).toHaveBeenCalled();
    expect(tracker.track).toHaveBeenCalledWith('first_recipe_cta_tapped', {});
  });

  it('a new family: Invite your family, and no activity card', () => {
    const { navigate } = setup({ members: [gabriel], hero: null, groceries: [], recipeCount: 0 });
    expect(screen.getByText('Invite your family')).toBeTruthy();
    expect(screen.queryByText('See all')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Invite' }));
    expect(navigate.family).toHaveBeenCalled();
  });

  it('offline: Add event is off', () => {
    setup({ readOnly: true });
    expect(card().getByRole('button', { name: 'Add event' }).getAttribute('aria-disabled')).toBe('true');
  });
});
