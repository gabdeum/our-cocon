import { describe, expect, it } from 'vitest';
import { activeFilterKeys, cuisineFacets, emptyFilters, filterRecipes, RecipeFilters, recipePassesFilters, type FilterableRecipe } from './recipe-filters';

const alex = '0b7c6a52-6d0f-4c55-9b0e-3c7e8a1f2d44';
const mia = '5f3e2d1c-0b9a-4876-9543-210fedcba987';

function recipe(fields: Partial<FilterableRecipe> = {}): FilterableRecipe {
  return { best_months: [], total_minutes: null, cuisine: null, created_by: mia, ...fields };
}
const pass = (r: FilterableRecipe, f: Partial<RecipeFilters>) => recipePassesFilters(r, { ...emptyFilters, ...f });

describe('best months (US1)', () => {
  it('in October, keeps recipes best in October and those good all year', () => {
    expect(pass(recipe({ best_months: [10, 11] }), { months: [10] })).toBe(true);
    expect(pass(recipe({ best_months: [] }), { months: [10] })).toBe(true);
    expect(pass(recipe({ best_months: [6, 7] }), { months: [10] })).toBe(false);
  });

  it('matches any of the chosen months (OR)', () => {
    expect(pass(recipe({ best_months: [6] }), { months: [6, 10] })).toBe(true);
  });
});

describe('total time', () => {
  it.each([
    [29, 'under_30', true],
    [30, 'under_30', false],
    [30, '30_60', true],
    [60, '30_60', true],
    [61, '30_60', false],
    [60, 'over_60', false],
    [61, 'over_60', true],
  ] as const)('%i min against %s is %s', (minutes, time, expected) => {
    expect(pass(recipe({ total_minutes: minutes }), { time })).toBe(expected);
  });

  it('a recipe with no total time matches every option', () => {
    for (const time of ['under_30', '30_60', 'over_60'] as const) expect(pass(recipe(), { time })).toBe(true);
  });
});

describe('cuisine', () => {
  it('matches any chosen cuisine', () => {
    expect(pass(recipe({ cuisine: 'thai' }), { cuisines: ['french', 'thai'] })).toBe(true);
    expect(pass(recipe({ cuisine: 'italian' }), { cuisines: ['french'] })).toBe(false);
  });

  it('Other matches no cuisine and unknown values', () => {
    expect(pass(recipe({ cuisine: null }), { cuisines: ['other'] })).toBe(true);
    expect(pass(recipe({ cuisine: 'martian' }), { cuisines: ['other'] })).toBe(true);
    expect(pass(recipe({ cuisine: 'french' }), { cuisines: ['other'] })).toBe(false);
  });
});

describe('combining groups (FR-002)', () => {
  const quick = recipe({ best_months: [10], total_minutes: 20, created_by: alex });
  const slow = recipe({ best_months: [10], total_minutes: 90, created_by: alex });
  const mias = recipe({ best_months: [10], total_minutes: 20, created_by: mia });

  it('needs every group with a choice to match (AND)', () => {
    const f: RecipeFilters = { months: [10], time: 'under_30', cuisines: [], addedBy: [alex] };
    expect(filterRecipes([quick, slow, mias], f)).toEqual([quick]);
  });

  it('no filters keep everything, in order', () => {
    expect(filterRecipes([slow, quick], emptyFilters)).toEqual([slow, quick]);
  });

  it('a recipe whose author is unknown never matches Added by', () => {
    expect(pass(recipe({ created_by: null }), { addedBy: [alex] })).toBe(false);
  });
});

describe('activeFilterKeys', () => {
  it('lists the groups with a choice, in sheet order', () => {
    expect(activeFilterKeys(emptyFilters)).toEqual([]);
    expect(activeFilterKeys({ months: [10, 11], time: 'under_30', cuisines: [], addedBy: [alex] })).toEqual(['months', 'time', 'added_by']);
    expect(activeFilterKeys({ ...emptyFilters, cuisines: ['other'] })).toEqual(['cuisine']);
  });
});

describe('cuisineFacets (FR-004)', () => {
  const label = (c: string) => c.charAt(0).toUpperCase() + c.slice(1);

  it('orders by recipe count, then label; Other when some have none', () => {
    const recipes = [{ cuisine: 'thai' }, { cuisine: 'french' }, { cuisine: 'french' }, { cuisine: 'italian' }, { cuisine: null }];
    expect(cuisineFacets(recipes, label)).toEqual({ keys: ['french', 'italian', 'thai'], hasOther: true });
  });

  it('counts an unknown value as Other, and is empty with no cuisines', () => {
    expect(cuisineFacets([{ cuisine: 'martian' }], label)).toEqual({ keys: [], hasOther: true });
    expect(cuisineFacets([], label)).toEqual({ keys: [], hasOther: false });
  });
});

describe('RecipeFilters schema (for MCP inputs)', () => {
  it('rejects repeated or out-of-range months and unknown cuisines', () => {
    expect(RecipeFilters.safeParse({ ...emptyFilters, months: [10, 10] }).success).toBe(false);
    expect(RecipeFilters.safeParse({ ...emptyFilters, months: [13] }).success).toBe(false);
    expect(RecipeFilters.safeParse({ ...emptyFilters, cuisines: ['martian'] }).success).toBe(false);
    expect(RecipeFilters.safeParse({ months: [10], time: '30_60', cuisines: ['other'], addedBy: [alex] }).success).toBe(true);
  });
});

describe('speed (SC-001)', () => {
  it('filters 2,000 recipes well under 100 ms', () => {
    const many = Array.from({ length: 2000 }, (_, i) =>
      recipe({ best_months: [(i % 12) + 1], total_minutes: i % 120, cuisine: i % 3 ? 'french' : null, created_by: i % 2 ? alex : mia }),
    );
    const f: RecipeFilters = { months: [10], time: 'under_30', cuisines: ['french', 'other'], addedBy: [alex] };
    const start = performance.now();
    filterRecipes(many, f);
    expect(performance.now() - start).toBeLessThan(50);
  });
});
