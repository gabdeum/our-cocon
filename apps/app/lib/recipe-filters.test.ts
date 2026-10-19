// Spec 007 FR-003 and FR-005: the session's filters, and the quick pills' rules.
import { describe, expect, it } from 'vitest';
import { emptyFilters } from '@cocon/schemas';
import { getRecipeFilters, getSheetSearch, inSeasonOn, setRecipeFilters, setSheetSearch, toggleInSeason, toggleUnder30, under30On } from './recipe-filters';

describe('the session store', () => {
  it('keeps filters for the person and family that set them; anyone else starts empty', () => {
    const filters = { ...emptyFilters, months: [10] };
    setRecipeFilters('mia:family-a', filters);
    expect(getRecipeFilters('mia:family-a')).toEqual(filters);
    // Alex signs in next on the same device, or Mia joins another family.
    expect(getRecipeFilters('alex:family-a')).toEqual(emptyFilters);
    expect(getRecipeFilters('mia:family-b')).toEqual(emptyFilters);
    expect(getRecipeFilters(null)).toEqual(emptyFilters);
  });

  it('stores nothing before someone is signed in to a family', () => {
    setRecipeFilters('mia:family-a', emptyFilters);
    setRecipeFilters(null, { ...emptyFilters, months: [3] });
    expect(getRecipeFilters(null)).toEqual(emptyFilters);
    expect(getRecipeFilters('mia:family-a')).toEqual(emptyFilters);
  });

  it("hands the list's search to the sheet, for the same person only", () => {
    setSheetSearch('mia:family-a', 'leek');
    expect(getSheetSearch('mia:family-a')).toBe('leek');
    expect(getSheetSearch('alex:family-a')).toBe('');
  });
});

describe('quick pills', () => {
  it('"In season" adds and removes this month, keeping other months', () => {
    const on = toggleInSeason({ ...emptyFilters, months: [11] }, 10);
    expect(on.months).toEqual([10, 11]);
    expect(inSeasonOn(on, 10)).toBe(true);
    expect(toggleInSeason(on, 10).months).toEqual([11]);
  });

  it('"Under 30 min" sets or clears the time, replacing another choice', () => {
    const on = toggleUnder30({ ...emptyFilters, time: 'over_60' });
    expect(on.time).toBe('under_30');
    expect(under30On(on)).toBe(true);
    expect(toggleUnder30(on).time).toBeNull();
  });
});
