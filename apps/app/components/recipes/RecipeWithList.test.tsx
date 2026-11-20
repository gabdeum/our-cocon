import { afterEach, describe, expect, it, vi } from 'vitest';
import { Text } from 'react-native';
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { render } from '../../test/render';
import type { RecipeListItem } from '../../lib/recipes';
import { recipeLayout } from '../../lib/recipe-layout';
import { fakeTracker, gabriel } from '../../test/fakes';
import { RecipeWithList } from './RecipeWithList';

afterEach(cleanup);

const recipe = (id: string, name: string): RecipeListItem => ({
  id,
  name,
  description: null,
  serves: 6,
  total_minutes: 70,
  cuisine: null,
  best_months: [],
  photo_path: null,
  created_by: gabriel.user_id,
  source: 'app',
  source_text: null,
  stepCount: 6,
  created_at: '2026-10-20T10:00:00Z',
  ingredientNames: [],
  variantCount: 0,
});
const recipes = [recipe('q', 'Leek & bacon quiche'), recipe('s', 'Pumpkin soup'), recipe('t', "Grandma's apple tart")];

function setup(width: number) {
  const tracker = fakeTracker();
  const onPick = vi.fn();
  const layout = recipeLayout(width >= 960 ? 'expanded' : width >= 600 ? 'medium' : 'compact', width);
  const ui = (id: string) => (
    <RecipeWithList layout={layout} list={{ recipes, members: [gabriel], tracker, onNew: vi.fn() }} rail={<Text>Rail</Text>} currentId={id} onPick={onPick}>
      {/* Keyed like the route: a new recipe is a new page. */}
      <Text key={id} testID="page">
        {id}
      </Text>
    </RecipeWithList>
  );
  const utils = render(ui('q'));
  return { ...utils, tracker, onPick, rerenderAt: (id: string) => utils.rerender(ui(id)) };
}

describe('the recipe beside the Recipes list (spec 067)', () => {
  it('FR-005: from 960 the rail, the list with the open recipe marked, and the recipe in its panel', () => {
    setup(1180);
    expect(screen.getByText('Rail')).toBeTruthy();
    const list = screen.getByTestId('split-list');
    expect(within(list).getByRole('heading', { name: 'Recipes' })).toBeTruthy();
    expect(within(list).getByRole('link', { name: /Leek & bacon quiche/ }).getAttribute('aria-current')).toBe('page');
    expect(within(list).getByRole('link', { name: /Pumpkin soup/ }).getAttribute('aria-current')).toBeNull();
    expect(within(screen.getByTestId('split-detail')).getByTestId('page').textContent).toBe('q');
  });

  it('SC-002: picking another recipe swaps the panel and keeps the list as it was', () => {
    const { tracker, onPick, rerenderAt } = setup(1180);
    const search = screen.getByRole('searchbox', { name: 'Search recipes' });
    fireEvent.change(search, { target: { value: 'soup' } });
    fireEvent.click(screen.getByRole('link', { name: /Pumpkin soup/ }));
    expect(onPick).toHaveBeenCalledWith('s');
    expect(tracker.track).toHaveBeenCalledWith('recipe_opened', { from: 'split_list' });
    rerenderAt('s');
    // Same list (its search is still typed), new recipe in the panel.
    expect(screen.getByRole('searchbox', { name: 'Search recipes' })).toBe(search);
    expect((search as HTMLInputElement).value).toBe('soup');
    expect(screen.getByTestId('page').textContent).toBe('s');
    expect(screen.getByRole('link', { name: /Pumpkin soup/ }).getAttribute('aria-current')).toBe('page');
  });

  it('picking the open recipe again does nothing', () => {
    const { tracker, onPick } = setup(1180);
    fireEvent.click(screen.getByRole('link', { name: /Leek & bacon quiche/ }));
    expect(onPick).not.toHaveBeenCalled();
    expect(tracker.track).not.toHaveBeenCalledWith('recipe_opened', expect.anything());
  });

  it('below 960 the recipe stands alone', () => {
    setup(744);
    expect(screen.queryByText('Rail')).toBeNull();
    expect(screen.queryByTestId('split-list')).toBeNull();
    expect(screen.getByTestId('page').textContent).toBe('q');
  });
});
