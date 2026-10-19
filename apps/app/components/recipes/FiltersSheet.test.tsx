// Spec 007: the Filters sheet. US2.1 (pick Oct + Under 30 min + Alex, live count), FR-004 (the
// Cuisine group) and the edge cases.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { emptyFilters, type RecipeFilters } from '@cocon/schemas';
import { FiltersSheet, type FiltersSheetProps } from './FiltersSheet';
import type { RecipeListItem } from '../../lib/recipes';
import { alex, fakeTracker, gabriel, mia } from '../../test/fakes';

afterEach(cleanup);

let seq = 0;
function recipe(fields: Partial<RecipeListItem> = {}): RecipeListItem {
  seq += 1;
  return {
    id: `r-${seq}`,
    name: `Dish ${seq}`,
    description: null,
    serves: 4,
    total_minutes: null,
    cuisine: null,
    best_months: [],
    photo_path: null,
    created_by: mia.user_id,
    source: 'app',
    created_at: '2026-10-01T10:00:00Z',
    ingredientNames: [],
    variantCount: 0,
    ...fields,
  };
}

// 12 recipes: 2 quick October ones by Alex, and the rest that don't fit all three filters.
const recipes = [
  recipe({ best_months: [10], total_minutes: 20, created_by: alex.user_id, cuisine: 'french' }),
  recipe({ best_months: [], total_minutes: 25, created_by: alex.user_id, cuisine: 'french' }),
  recipe({ best_months: [10], total_minutes: 90, created_by: alex.user_id, cuisine: 'italian' }),
  recipe({ best_months: [6], total_minutes: 20, created_by: alex.user_id, cuisine: 'thai' }),
  recipe({ best_months: [10], total_minutes: 20, created_by: gabriel.user_id }),
  ...Array.from({ length: 7 }, () => recipe({ best_months: [3], total_minutes: 45 })),
];

function setup(props: Partial<FiltersSheetProps> = {}) {
  const tracker = fakeTracker();
  const onApply = vi.fn();
  const onClose = vi.fn();
  render(<FiltersSheet recipes={recipes} members={[gabriel, alex, mia]} query="" filters={emptyFilters} tracker={tracker} onApply={onApply} onClose={onClose} {...props} />);
  return { tracker, onApply, onClose };
}

const press = (name: string) => fireEvent.click(screen.getByRole('button', { name }));
const pressed = (name: string) => screen.getByRole('button', { name }).getAttribute('aria-pressed');

describe('layout (OC-Filters)', () => {
  it('shows the groups and copy as drawn', () => {
    setup();
    expect(screen.getByRole('dialog', { name: 'Filters' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Clear all' })).toBeTruthy();
    for (const heading of ['Best months', 'Total time', 'Cuisine', 'Added by']) expect(screen.getByRole('heading', { name: heading })).toBeTruthy();
    expect(screen.getByText('Shows recipes that are best this time of year.')).toBeTruthy();
    const months = within(screen.getByRole('group', { name: 'Best months' })).getAllByRole('button');
    expect(months.map((m) => m.textContent)).toEqual(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']);
    for (const time of ['Under 30 min', '30–60 min', 'Over 1 hour']) expect(screen.getByRole('button', { name: time })).toBeTruthy();
    for (const person of ['Gabriel', 'Alex', 'Mia']) expect(screen.getByRole('button', { name: new RegExp(person) })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Show 12 recipes' })).toBeTruthy();
  });
});

describe('combining filters (US2.1, FR-002)', () => {
  it('Oct + Under 30 min + Alex counts live, and Show applies', () => {
    const { onApply, tracker } = setup();
    press('Oct');
    // Oct or no months: 3 October + 1 all year.
    expect(screen.getByRole('button', { name: 'Show 4 recipes' })).toBeTruthy();
    press('Under 30 min');
    expect(screen.getByRole('button', { name: 'Show 3 recipes' })).toBeTruthy();
    press('Alex');
    expect(screen.getByRole('button', { name: 'Show 2 recipes' })).toBeTruthy();
    press('Show 2 recipes');
    const applied: RecipeFilters = { months: [10], time: 'under_30', cuisines: [], addedBy: [alex.user_id] };
    expect(onApply).toHaveBeenCalledWith(applied);
    expect(tracker.track).toHaveBeenCalledWith('recipe_filters_applied', { filter_keys: ['months', 'time', 'added_by'], result_count: 2 });
  });

  it('total time is a single choice', () => {
    setup();
    press('Under 30 min');
    press('Over 1 hour');
    expect(pressed('Under 30 min')).toBe('false');
    expect(pressed('Over 1 hour')).toBe('true');
    press('Over 1 hour');
    expect(pressed('Over 1 hour')).toBe('false');
  });

  it('says "Show 1 recipe" for one', () => {
    setup();
    press('Gabriel');
    expect(screen.getByRole('button', { name: 'Show 1 recipe' })).toBeTruthy();
  });

  it('counts within the current search', () => {
    setup({ recipes: [recipe({ name: 'Leek soup' }), recipe({ name: 'Apple tart' })], query: 'leek' });
    expect(screen.getByRole('button', { name: 'Show 1 recipe' })).toBeTruthy();
  });
});

describe('edge cases', () => {
  it('with no match, the button is disabled and says to remove a filter', () => {
    const { onApply } = setup();
    press('Mia');
    press('Under 30 min');
    const button = screen.getByRole('button', { name: 'No recipes match' });
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByText('Try removing a filter')).toBeTruthy();
    fireEvent.click(button);
    expect(onApply).not.toHaveBeenCalled();
  });

  it('Clear all resets every group', () => {
    setup({ filters: { months: [10], time: 'under_30', cuisines: ['french'], addedBy: [alex.user_id] } });
    expect(pressed('Oct')).toBe('true');
    press('Clear all');
    for (const name of ['Oct', 'Under 30 min', 'French', 'Alex']) expect(pressed(name)).toBe('false');
    expect(screen.getByRole('button', { name: 'Show 12 recipes' })).toBeTruthy();
  });

  it('closing without Show applies nothing', () => {
    const { onApply, onClose } = setup();
    press('Oct');
    press('Close');
    expect(onClose).toHaveBeenCalled();
    expect(onApply).not.toHaveBeenCalled();
  });

  it('hides Cuisine when no recipe has one', () => {
    setup({ recipes: [recipe(), recipe()] });
    expect(screen.queryByRole('heading', { name: 'Cuisine' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Other' })).toBeNull();
  });
});

describe('the Cuisine group (FR-004)', () => {
  const keys = ['american', 'british', 'chinese', 'french', 'german', 'greek', 'indian', 'italian', 'japanese', 'korean', 'thai', 'mexican'] as const;
  // French on 3 recipes, Thai on 2, the rest on 1; one recipe with no cuisine.
  const many = [
    ...keys.map((cuisine) => recipe({ cuisine })),
    recipe({ cuisine: 'french' }),
    recipe({ cuisine: 'french' }),
    recipe({ cuisine: 'thai' }),
    recipe({ cuisine: null }),
  ];
  const cuisinePills = () =>
    within(screen.getByRole('heading', { name: 'Cuisine' }).parentElement as HTMLElement)
      .getAllByRole('button')
      .map((b) => b.textContent);

  it('lists most used first, then alphabetical; 10, then "Show 2 more", then Other', () => {
    setup({ recipes: many });
    expect(cuisinePills()).toEqual(['French', 'Thai', 'American', 'British', 'Chinese', 'German', 'Greek', 'Indian', 'Italian', 'Japanese', 'Show 2 more', 'Other']);
    expect(screen.getByRole('button', { name: 'Show 2 more' }).getAttribute('aria-pressed')).toBeNull();
    press('Show 2 more');
    expect(cuisinePills()).toEqual(['French', 'Thai', 'American', 'British', 'Chinese', 'German', 'Greek', 'Indian', 'Italian', 'Japanese', 'Korean', 'Mexican', 'Other']);
  });

  it('Other matches recipes with no cuisine', () => {
    setup({ recipes: many });
    press('Other');
    expect(screen.getByRole('button', { name: 'Show 1 recipe' })).toBeTruthy();
  });

  it('keeps a chosen cuisine beyond the first 10 visible on reopen', () => {
    setup({ recipes: many, filters: { ...emptyFilters, cuisines: ['mexican'] } });
    expect(cuisinePills()).toEqual(['French', 'Thai', 'American', 'British', 'Chinese', 'German', 'Greek', 'Indian', 'Italian', 'Japanese', 'Mexican', 'Show 1 more', 'Other']);
    expect(pressed('Mexican')).toBe('true');
  });
});
