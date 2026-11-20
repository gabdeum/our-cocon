// Spec 028 (OC-Home, CalCard): what's on today (US1), this week or nothing (US2), the latest
// recipe (US3), the tiles (US4), and the edge cases: no recipes, a new family, Busy. Spec 068: the
// two columns from 600.
import { View } from 'react-native';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ActivityEntry } from '@cocon/schemas';
import type { HomeHero, StoredEvent } from '@cocon/data';
import { ToastProvider } from '../../lib/toast';
import { fakeTracker, gabriel, groceryItem, james, mia, storedEvent } from '../../test/fakes';
import { HomeScreen, type HomeScreenProps } from './HomeScreen';
import { expectAccessible } from '../../test/axe';

const dims = vi.hoisted(() => ({ width: 390, height: 844 }));
vi.mock('react-native', async (actual) => ({ ...(await actual<typeof import('react-native')>()), useWindowDimensions: () => ({ ...dims, scale: 2, fontScale: 1 }) }));

afterEach(() => {
  cleanup();
  dims.width = 390;
  dims.height = 844;
});

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

  it('Spec 057 FR-001: the Reminders card goes under the greeting, above the calendar card', () => {
    setup({ reminders: <View role="region" aria-label="Reminders" /> });
    const greeting = screen.getByRole('heading', { name: 'Hi Gabriel' });
    const reminders = screen.getByRole('region', { name: 'Reminders' });
    const calendar = screen.getByRole('region', { name: 'Family calendar' });
    expect(greeting.compareDocumentPosition(reminders) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(reminders.compareDocumentPosition(calendar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('US1: today’s events under a Today · This week toggle, the birthday banner, "Now" and Open calendar', async () => {
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
    expect(card().getByRole('button', { name: /^Today, October 25: \S/ })).toBeTruthy();
    // Spec 030 SC-001.
    await expectAccessible();
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
    const wed = () => card().getByRole('button', { name: 'October 28: Pediatrician' });
    fireEvent.click(wed());
    expect(wed().getAttribute('aria-pressed')).toBe('true');
    expect(tracker.track).toHaveBeenCalledWith('homepage_calendar_day_picked', { day_offset: 3 });
    expect(card().getByRole('heading', { name: 'Wednesday, Oct. 28' })).toBeTruthy();
    expect(card().getByRole('link', { name: /^Pediatrician, James, 10:00/ })).toBeTruthy();
    expect(card().queryByRole('link', { name: /Morning run/ })).toBeNull();
    // "+" adds on the picked day.
    fireEvent.click(card().getByRole('button', { name: 'Add event on Wednesday' }));
    expect(navigate.addEvent).toHaveBeenCalledWith('2026-10-28');
    // Tapping it again: the whole week.
    fireEvent.click(wed());
    expect(card().getByRole('link', { name: 'Mon, Morning run, 06:30 · Gabriel' })).toBeTruthy();
    // An empty day, then "Whole week".
    fireEvent.click(card().getByRole('button', { name: 'October 29: nothing planned' }));
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

describe('Home › cooking now (spec 051 on 028)', () => {
  const cook = (id: string, step: number, servings = 6) => ({
    id,
    recipe_id: `r-${id}`,
    started_by: gabriel.user_id,
    started_at: '2026-11-12T18:40:00Z',
    last_active_at: '2026-11-12T18:50:00Z',
    current_step: step,
    variant_id: null,
    servings,
    status: 'in_progress' as const,
  });
  const quicheCook = { cook: cook('quiche', 2, 8), name: 'Leek & bacon quiche', stepCount: 6 };
  const soupCook = { cook: cook('soup', 0), name: 'Pumpkin soup', stepCount: 4 };

  it('replaces the latest recipe with what is cooking: "Cooking now: step 3/6", no chips', () => {
    setup({ cooking: [quicheCook] });
    expect(screen.getByText('Cooking now: step 3/6')).toBeTruthy();
    expect(screen.queryByText('Latest recipe')).toBeNull();
    expect(screen.queryByText('Serves 8')).toBeNull();
    expect(screen.queryByText('1 h 10')).toBeNull();
    expect(screen.queryByText('2 to buy')).toBeNull();
    // One cook: no dots.
    expect(screen.queryByRole('button', { name: 'Show Leek & bacon quiche' })).toBeNull();
  });

  it('tapping the card resumes; Cancel, Done and Resume name the recipe', () => {
    const onCookResume = vi.fn();
    const onCookDone = vi.fn();
    const onCookCancel = vi.fn();
    setup({ cooking: [quicheCook], onCookResume, onCookDone, onCookCancel });
    fireEvent.click(screen.getByRole('link', { name: 'Resume Leek & bacon quiche, step 3 of 6' }));
    expect(onCookResume).toHaveBeenCalledWith(quicheCook.cook);
    fireEvent.click(screen.getByRole('button', { name: 'Resume Leek & bacon quiche, step 3 of 6' }));
    expect(onCookResume).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole('button', { name: 'Done cooking Leek & bacon quiche' }));
    expect(onCookDone).toHaveBeenCalledWith(quicheCook.cook, 'Leek & bacon quiche');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel cooking Leek & bacon quiche' }));
    expect(onCookCancel).toHaveBeenCalledWith(quicheCook.cook);
  });

  it('several cooks swipe side by side, with a dot for each', async () => {
    setup({ cooking: [quicheCook, soupCook] });
    const region = screen.getByRole('region', { name: '2 recipes cooking' });
    expect(within(region).getByText('Leek & bacon quiche')).toBeTruthy();
    expect(within(region).getByText('Pumpkin soup')).toBeTruthy();
    expect(within(region).getByRole('button', { name: 'Show Leek & bacon quiche' }).getAttribute('aria-current')).toBe('true');
    fireEvent.click(within(region).getByRole('button', { name: 'Show Pumpkin soup' }));
    expect(within(region).getByRole('button', { name: 'Show Pumpkin soup' }).getAttribute('aria-current')).toBe('true');
    expect(within(region).getByRole('button', { name: 'Show Leek & bacon quiche' }).getAttribute('aria-current')).toBeNull();
    await expectAccessible();
  });

  it('offline: the card still resumes, the buttons are off', () => {
    const onCookResume = vi.fn();
    setup({ cooking: [quicheCook], onCookResume, readOnly: true });
    expect(screen.getByRole('button', { name: 'Done cooking Leek & bacon quiche' }).getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(screen.getByRole('link', { name: 'Resume Leek & bacon quiche, step 3 of 6' }));
    expect(onCookResume).toHaveBeenCalled();
  });
});

describe('Home on larger screens (spec 068)', () => {
  const entry = (n: number): ActivityEntry => ({
    key: `${n}1111111-1111-4111-8111-111111111111`,
    actor_id: gabriel.user_id,
    source: 'app',
    kind: 'recipe_created',
    created_at: `2026-10-25T1${n}:00:00Z`,
    count: 1,
    names: [],
    recipe_id: null,
    recipe_name: `Soup ${n}`,
    from_recipe_name: null,
    event_id: null,
    event_name: null,
    event_when: null,
    event_secret: false,
    reminder_id: null,
    reminder_name: null,
    undone_by: null,
    undone_at: null,
    undo_action: null,
    can_undo: false,
    can_restore: false,
  });
  const activity = [1, 2, 3, 4, 5].map(entry);
  const size = (width: number, height: number) => {
    dims.width = width;
    dims.height = height;
  };
  const items = (id: string) => Array.from(screen.getByTestId(id).children);
  const holds = (item: Element | undefined, node: HTMLElement) => item?.contains(node) ?? false;
  const reminders = <View role="region" aria-label="Reminders" />;

  it('FR-001: on the phone, one column in the same order, with 4 activity rows', () => {
    setup({ activity, reminders });
    expect(screen.queryByTestId('home-left')).toBeNull();
    expect(screen.getAllByText(/Soup \d/)).toHaveLength(4);
    expect(screen.getByTestId('hero-photo').style.height).toBe('170px');
    const after = (a: HTMLElement, b: HTMLElement) => a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING;
    expect(after(screen.getByRole('region', { name: 'Reminders' }), screen.getByRole('region', { name: 'Family calendar' }))).toBeTruthy();
    expect(after(screen.getByText('to buy'), screen.getByText('Latest recipe'))).toBeTruthy();
    expect(after(screen.getByText('Latest recipe'), screen.getByText('Latest activity'))).toBeTruthy();
  });

  it('FR-002, SC-001: at 820, reminders, calendar and the latest recipe on the left; the tiles, then 5 activity rows, on the right', () => {
    size(820, 1180);
    setup({ activity, reminders });
    const left = items('home-left');
    expect(left).toHaveLength(3);
    expect(holds(left[0], screen.getByRole('region', { name: 'Reminders' }))).toBe(true);
    expect(holds(left[1], screen.getByRole('region', { name: 'Family calendar' }))).toBe(true);
    expect(holds(left[2], screen.getByText('Latest recipe'))).toBe(true);
    expect(screen.getByTestId('hero-photo').style.height).toBe('200px');
    const right = items('home-right');
    expect(holds(right[0], screen.getByText('to buy'))).toBe(true);
    // Only the tiles sit above Latest activity.
    expect(holds(right[1], screen.getByText('Latest activity'))).toBe(true);
    expect(within(right[1] as HTMLElement).getAllByText(/Soup \d/)).toHaveLength(5);
    // Below 960 the logo row stays, the greeting under it.
    expect(screen.getByText('Our Cocon')).toBeTruthy();
    expect(within(screen.getByTestId('tab-pinned')).queryByRole('heading', { name: 'Hi Gabriel' })).toBeNull();
  });

  it('FR-003: at 1180, no logo row: the date and greeting sit left of the family, photo 160', async () => {
    size(1180, 820);
    setup({ activity });
    expect(screen.queryByText('Our Cocon')).toBeNull();
    const pinned = within(screen.getByTestId('tab-pinned'));
    expect(pinned.getByText('Sunday, Oct 25')).toBeTruthy();
    expect(pinned.getByRole('heading', { name: 'Hi Gabriel' })).toBeTruthy();
    expect(pinned.getByRole('link', { name: 'Family: Gabriel, Eva, James' })).toBeTruthy();
    expect(screen.getAllByRole('heading', { name: 'Hi Gabriel' })).toHaveLength(1);
    expect(screen.getByTestId('hero-photo').style.height).toBe('160px');
    expect(holds(items('home-right')[1], screen.getByText('Latest activity'))).toBe(true);
    await expectAccessible();
  });

  it.each([
    [599, null, '170px', null],
    [600, '18px', '200px', 'Our Cocon'],
    [959, '18px', '200px', 'Our Cocon'],
    [960, '14px', '160px', null],
  ])('FR-002: at %i wide, columns 1.1 / 1 %s apart, photo %s', (width, gap, photo, brand) => {
    size(width, 820);
    setup({ activity });
    expect(screen.getByTestId('hero-photo').style.height).toBe(photo);
    if (width === 599) {
      expect(screen.queryByTestId('home-left')).toBeNull();
      expect(screen.getByText('Our Cocon')).toBeTruthy();
      return;
    }
    const left = screen.getByTestId('home-left');
    const right = screen.getByTestId('home-right');
    expect(left.style.flexGrow).toBe('1.1');
    expect(right.style.flexGrow).toBe('1');
    expect([left.style.gap, right.style.gap, (left.parentElement as HTMLElement).style.gap]).toEqual([gap, gap, gap]);
    expect(screen.queryByText('Our Cocon')?.textContent ?? null).toBe(brand);
  });

  it('FR-004: hidden cards leave no gap: no reminders, no recipes yet', () => {
    size(820, 1180);
    setup({ hero: null, recipeCount: 0 });
    const left = items('home-left');
    expect(left).toHaveLength(2);
    expect(holds(left[0], screen.getByRole('region', { name: 'Family calendar' }))).toBe(true);
    expect(holds(left[1], screen.getByText("What's for dinner?"))).toBe(true);
    // No activity yet: the right column is just the tiles.
    expect(items('home-right')).toHaveLength(1);
  });

  it('a cook in progress takes the latest recipe’s place in the left column', () => {
    size(820, 1180);
    setup({ cooking: [{ cook: { id: 'c', recipe_id: 'r-quiche', started_by: gabriel.user_id, started_at: '2026-10-25T10:00:00Z', last_active_at: '2026-10-25T10:10:00Z', current_step: 2, variant_id: null, servings: 6, status: 'in_progress' }, name: 'Leek & bacon quiche', stepCount: 6 }] });
    expect(holds(items('home-left')[1], screen.getByText('Cooking now: step 3/6'))).toBe(true);
    expect(screen.getByTestId('hero-photo').style.height).toBe('200px');
  });

  it('a new family’s invite card goes under the activity, on the right', () => {
    size(820, 1180);
    setup({ members: [gabriel], activity });
    expect(holds(items('home-right')[2], screen.getByText('Invite your family'))).toBe(true);
  });
});
