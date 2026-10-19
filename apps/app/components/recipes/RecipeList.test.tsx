// Specs 006 and 007: the Recipes tab. US1 (search by name or ingredient, no match), US2 (a recipe added
// through ChatGPT shows at the top), FR-005 to FR-008 and the edge cases.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { onlineManager } from '@tanstack/react-query';
import { emptyFilters, type RecipeFilters } from '@cocon/schemas';
import { RecipeList, SEARCH_DEBOUNCE_MS, type RecipeListProps } from './RecipeList';
import type { RecipeListItem } from '../../lib/recipes';
import { alex, fakeTracker, gabriel, mia } from '../../test/fakes';

beforeEach(() => {
  vi.useFakeTimers();
  onlineManager.setOnline(true);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const october = new Date('2026-10-19T12:00:00');
let seq = 0;

function recipe(name: string, fields: Partial<RecipeListItem> = {}): RecipeListItem {
  seq += 1;
  return {
    id: `r-${seq}`,
    name,
    description: null,
    serves: 4,
    total_minutes: null,
    cuisine: null,
    best_months: [],
    photo_path: null,
    created_by: mia.user_id,
    source: 'app',
    created_at: `2026-10-${String(30 - (seq % 28)).padStart(2, '0')}T10:00:00Z`,
    ingredientNames: [],
    variantCount: 0,
    ...fields,
  };
}

const quiche = recipe('Quiche Lorraine', {
  serves: 6,
  total_minutes: 70,
  cuisine: 'french',
  best_months: [10, 11],
  created_by: gabriel.user_id,
  source: 'claude',
  ingredientNames: ['Shortcrust pastry', 'Leeks', 'Gruyère'],
  variantCount: 2,
});
const tart = recipe("Grandma's apple tart", { serves: 8, total_minutes: 90, ingredientNames: ['Apples', 'Butter'] });
// 32 recipes in all (US1): the quiche, the tart and 30 others with no leeks.
const others = Array.from({ length: 30 }, (_, i) => recipe(`Dish ${i + 1}`, { ingredientNames: ['Onion', 'Salt'], best_months: i < 3 ? [10] : [] }));
const all = [quiche, tart, ...others];

function setup(props: Partial<RecipeListProps> = {}) {
  const tracker = fakeTracker();
  const onOpen = vi.fn();
  const onNew = vi.fn();
  const view = render(<RecipeList recipes={all} members={[gabriel, alex, mia]} tracker={tracker} onOpen={onOpen} onNew={onNew} now={october} {...props} />);
  return { tracker, onOpen, onNew, view };
}

const search = () => screen.getByRole('searchbox', { name: 'Search recipes' });
function type(text: string) {
  fireEvent.change(search(), { target: { value: text } });
}
const settle = () => act(() => vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS));
const names = () => screen.getAllByRole('link').map((l) => l.textContent ?? '');

describe('the list (FR-001, FR-005 to FR-007)', () => {
  it('shows the header, search, hint and pills as drawn', () => {
    setup();
    expect(screen.getByRole('heading', { name: 'Recipes' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'New' })).toBeTruthy();
    expect(search().getAttribute('placeholder')).toBe('Search recipes or ingredients');
    expect(screen.getByText('Try “leek” or “quick”')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Filters' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'In season' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Under 30 min' })).toBeTruthy();
  });

  it('groups In season this month first, then All recipes, with counts', () => {
    setup();
    expect(screen.getByText('In season in October · 4')).toBeTruthy();
    expect(screen.getByText('All recipes · 28')).toBeTruthy();
    const order = names();
    // Each group keeps the list's order: most recently added first.
    ['Quiche Lorraine', 'Dish 1', 'Dish 2', 'Dish 3', "Grandma's apple tart", 'Dish 4'].forEach((name, i) => expect(order[i]).toMatch(new RegExp(`^${name}[A-Z0-9]`)));
  });

  it('shows the meta and author lines', () => {
    setup();
    const item = screen.getByRole('link', { name: /Quiche Lorraine/ });
    expect(within(item).getByText('1 h 10 · Serves 6 · French · 2 variants')).toBeTruthy();
    expect(within(item).getByText('Gabriel · via Claude')).toBeTruthy();
    const tartItem = screen.getByRole('link', { name: /apple tart/ });
    expect(within(tartItem).getByText('1 h 30 · Serves 8')).toBeTruthy();
    expect(within(tartItem).getByText('Mia')).toBeTruthy();
  });

  it('opens a recipe and the create form (FR-008)', () => {
    const { onOpen, onNew, tracker } = setup();
    fireEvent.click(screen.getByRole('link', { name: /Quiche Lorraine/ }));
    expect(onOpen).toHaveBeenCalledWith(quiche.id);
    expect(tracker.track).toHaveBeenCalledWith('recipe_opened', { from: 'list' });
    fireEvent.click(screen.getByRole('button', { name: 'New' }));
    expect(onNew).toHaveBeenCalled();
  });
});

describe('search (US1, FR-004)', () => {
  it('finds the quiche by its leeks, and updates as I type', () => {
    const { tracker } = setup();
    type('le');
    expect(screen.queryByText('Try “leek” or “quick”')).toBeNull();
    settle();
    type('leek');
    // Not yet: the list still shows what "le" found until typing pauses.
    expect(names()).toHaveLength(2);
    settle();
    expect(names()).toHaveLength(1);
    expect(names()[0]).toContain('Quiche Lorraine');
    expect(screen.getByText('In season in October · 1')).toBeTruthy();
    expect(tracker.track).toHaveBeenLastCalledWith('recipes_searched', { query_length: 4, result_count: 1 });

    type('leek apple');
    settle();
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });

  it('ignores accents and case', () => {
    setup();
    type('GRUYERE');
    settle();
    expect(names()).toEqual([expect.stringContaining('Quiche Lorraine')]);
  });

  it('tracks an opened search result as from search', () => {
    const { tracker } = setup();
    type('apple');
    settle();
    fireEvent.click(screen.getByRole('link', { name: /apple tart/ }));
    expect(tracker.track).toHaveBeenLastCalledWith('recipe_opened', { from: 'search' });
  });

  it('says when nothing matches, and Clear search brings the list back', () => {
    const { tracker } = setup();
    type('xyz');
    settle();
    expect(screen.getByText('No recipes match “xyz”.')).toBeTruthy();
    expect(screen.getByText('Try another word, or add it as a new recipe.')).toBeTruthy();
    expect(tracker.track).toHaveBeenLastCalledWith('recipes_searched', { query_length: 3, result_count: 0 });
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(names()).toHaveLength(32);
    expect((search() as HTMLInputElement).value).toBe('');
  });
});

describe("what's new (US2)", () => {
  it('shows a recipe Alex added through ChatGPT at the top of my open list', () => {
    const { view, tracker } = setup();
    const soup = recipe('Pumpkin soup', { created_by: alex.user_id, source: 'chatgpt', total_minutes: 40, cuisine: 'thai', best_months: [10] });
    view.rerender(<RecipeList recipes={[soup, ...all]} members={[gabriel, alex, mia]} tracker={tracker} onOpen={vi.fn()} onNew={vi.fn()} now={october} />);
    const first = screen.getAllByRole('link')[0];
    expect(first?.textContent).toContain('Pumpkin soup');
    expect(within(first as HTMLElement).getByText('40 min · Serves 4 · Thai')).toBeTruthy();
    expect(within(first as HTMLElement).getByText('Alex · via ChatGPT')).toBeTruthy();
    expect(screen.getByText('In season in October · 5')).toBeTruthy();
  });
});

describe('states', () => {
  it('shows 3 skeletons while loading', () => {
    setup({ recipes: undefined });
    expect(screen.getByRole('progressbar', { name: 'Loading recipes' })).toBeTruthy();
    expect(screen.getAllByTestId('recipe-item-skeleton')).toHaveLength(3);
  });

  it('invites a first recipe when there are none', () => {
    const { onNew } = setup({ recipes: [] });
    expect(screen.getByRole('heading', { name: "Your family's recipes will live here." })).toBeTruthy();
    expect(screen.getByText('Add one yourself, or ask your AI assistant to save one.')).toBeTruthy();
    expect(screen.getByText("Try: “Save my mum's ratatouille to Our Cocon”")).toBeTruthy();
    expect(screen.queryByRole('searchbox')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'New recipe' }));
    expect(onNew).toHaveBeenCalled();
  });

  it('says what to do when the first load fails', () => {
    const onRetry = vi.fn();
    setup({ recipes: undefined, failed: true, onRetry });
    expect(screen.getByText("Couldn't load your recipes. Check your connection and try again.")).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('keeps the list readable offline, with New disabled', () => {
    act(() => onlineManager.setOnline(false));
    setup();
    expect(screen.getByRole('status').textContent).toContain("You're offline");
    expect(screen.getByRole('button', { name: 'New' }).getAttribute('aria-disabled')).toBe('true');
    expect(names()).toHaveLength(32);
  });

  it('disables New recipe offline when there are no recipes', () => {
    act(() => onlineManager.setOnline(false));
    setup({ recipes: [] });
    expect(screen.getByRole('button', { name: 'New recipe' }).getAttribute('aria-disabled')).toBe('true');
  });
});

describe('filters (spec 007)', () => {
  // The route keeps filters in the session store; here a parent's state stands in for it.
  function Filterable(props: Partial<RecipeListProps> & { tracker: RecipeListProps['tracker']; initial?: RecipeFilters }) {
    const [filters, setFilters] = useState(props.initial ?? emptyFilters);
    return <RecipeList recipes={all} members={[gabriel, alex, mia]} onOpen={vi.fn()} onNew={vi.fn()} now={october} {...props} filters={filters} onFiltersChange={setFilters} />;
  }
  const quickSetup = (props: Partial<RecipeListProps> & { initial?: RecipeFilters } = {}) => {
    const tracker = fakeTracker();
    render(<Filterable tracker={tracker} {...props} />);
    return { tracker };
  };
  const pressed = (name: string) => screen.getByRole('button', { name }).getAttribute('aria-pressed');

  it('"In season" shows only recipes best this month or all year (US1)', () => {
    const { tracker } = quickSetup({ recipes: [quiche, tart, recipe('Summer salad', { best_months: [7] })] });
    fireEvent.click(screen.getByRole('button', { name: 'In season' }));
    expect(pressed('In season')).toBe('true');
    expect(screen.queryByRole('link', { name: /Summer salad/ })).toBeNull();
    expect(names()).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Filters · 1' })).toBeTruthy();
    expect(tracker.track).toHaveBeenLastCalledWith('recipe_filters_applied', { filter_keys: ['months'], result_count: 2 });
    fireEvent.click(screen.getByRole('button', { name: 'In season' }));
    expect(pressed('In season')).toBe('false');
    expect(names()).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'Filters' })).toBeTruthy();
  });

  it('shows "Filters · 3" and mirrors the sheet\'s choices on the quick pills (US2.2, FR-003)', () => {
    quickSetup({ initial: { months: [10], time: 'under_30', cuisines: [], addedBy: [alex.user_id] } });
    expect(screen.getByRole('button', { name: 'Filters · 3' })).toBeTruthy();
    expect(pressed('In season')).toBe('true');
    expect(pressed('Under 30 min')).toBe('true');
  });

  it('"In season" stays off when the sheet picked other months', () => {
    quickSetup({ initial: { ...emptyFilters, months: [6] } });
    expect(pressed('In season')).toBe('false');
    fireEvent.click(screen.getByRole('button', { name: 'In season' }));
    // June and October now; one group still.
    expect(screen.getByRole('button', { name: 'Filters · 1' })).toBeTruthy();
  });

  it('opens the sheet with the current search', () => {
    const onOpenFilters = vi.fn();
    quickSetup({ onOpenFilters });
    type('leek');
    settle();
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    expect(onOpenFilters).toHaveBeenCalledWith('leek');
  });

  it('says when no recipe matches the filters, and Clear filters brings the list back', () => {
    quickSetup({ recipes: [quiche, tart] });
    fireEvent.click(screen.getByRole('button', { name: 'Under 30 min' }));
    expect(screen.getByRole('heading', { name: 'No recipes match these filters.' })).toBeTruthy();
    expect(screen.getByText('Try removing a filter.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(names()).toHaveLength(2);
    expect(pressed('Under 30 min')).toBe('false');
  });

  it('with a search too, shows the search no-match state with Clear filters', () => {
    quickSetup({ recipes: [quiche, tart], initial: { ...emptyFilters, time: 'under_30' } });
    type('quiche');
    settle();
    expect(screen.getByText('No recipes match “quiche”.')).toBeTruthy();
    // Filters are on too, so they can be cleared from here.
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(names()).toEqual([expect.stringContaining('Quiche Lorraine')]);
  });
});
