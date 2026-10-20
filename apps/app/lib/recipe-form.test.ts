// Spec 014: the Details form's rules (FR-002, FR-003, US2) and its edge cases, without the screen.
import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_SERVES,
  formFromRecipe,
  isDirty,
  nextSection,
  readAdvanced,
  readDetails,
  sectionOf,
  writeAdvanced,
  type DetailsForm,
  type RecipeDetails,
} from './recipe-form';

const empty = formFromRecipe(null);
const quiche: RecipeDetails = {
  id: 'r1',
  name: 'Leek & bacon quiche',
  description: 'Silky custard, sweet leeks and a crisp, buttery crust.',
  serves: 6,
  total_minutes: 70,
  prep_minutes: 25,
  cuisine: 'french',
  source_text: 'Grandma',
  best_months: [12, 1, 2],
  photo_path: '5f3e2d1c-0b9a-4876-9543-210fedcba987/0b1c2d3e-4f50-4617-8899-aabbccddeeff/9a8b7c6d-5e4f-4321-8fed-cba987654321.jpg',
};
const read = (patch: Partial<DetailsForm>) => readDetails({ ...empty, ...patch });

describe('sections (FR-001)', () => {
  it('opens the section a link names, or Details', () => {
    expect(sectionOf('steps')).toBe('steps');
    expect(sectionOf('photos')).toBe('details');
    expect(sectionOf(undefined)).toBe('details');
  });

  it('"Next: …" goes on in order, and the last section saves', () => {
    expect(nextSection('details')).toBe('ingredients');
    expect(nextSection('steps')).toBe('variants');
    expect(nextSection('variants')).toBeNull();
  });
});

describe('the form from a recipe', () => {
  it('starts a new recipe empty, serving 4', () => {
    expect(empty).toEqual({ name: '', description: '', serves: '4', totalTime: '', prepTime: '', cuisine: null, source: '', bestMonths: [], photoPath: null });
  });

  it('shows a saved recipe as it reads, times included', () => {
    expect(formFromRecipe(quiche)).toEqual({
      name: 'Leek & bacon quiche',
      description: 'Silky custard, sweet leeks and a crisp, buttery crust.',
      serves: '6',
      totalTime: '1 h 10',
      prepTime: '25 min',
      cuisine: 'french',
      source: 'Grandma',
      bestMonths: [1, 2, 12],
      photoPath: '5f3e2d1c-0b9a-4876-9543-210fedcba987/0b1c2d3e-4f50-4617-8899-aabbccddeeff/9a8b7c6d-5e4f-4321-8fed-cba987654321.jpg',
    });
  });

  it('reads a saved recipe back unchanged', () => {
    const result = readDetails(formFromRecipe(quiche));
    expect(result).toEqual({
      input: {
        name: 'Leek & bacon quiche',
        description: 'Silky custard, sweet leeks and a crisp, buttery crust.',
        serves: 6,
        total_minutes: 70,
        prep_minutes: 25,
        cuisine: 'french',
        source_text: 'Grandma',
        best_months: [1, 2, 12],
        photo_path: '5f3e2d1c-0b9a-4876-9543-210fedcba987/0b1c2d3e-4f50-4617-8899-aabbccddeeff/9a8b7c6d-5e4f-4321-8fed-cba987654321.jpg',
      },
    });
  });

  it('treats a cuisine from another list as Other', () => {
    expect(formFromRecipe({ ...quiche, cuisine: 'klingon' }).cuisine).toBeNull();
  });
});

describe('Save (US1, FR-002, FR-003)', () => {
  it('needs only a name; everything else is optional', () => {
    expect(read({ name: '  Soup  ', serves: '' })).toEqual({
      input: {
        name: 'Soup',
        description: null,
        serves: DEFAULT_SERVES,
        total_minutes: null,
        prep_minutes: null,
        cuisine: null,
        source_text: null,
        best_months: [],
        photo_path: null,
      },
    });
  });

  it('warns "Give your recipe a name" when it is empty', () => {
    expect(read({ name: '   ' })).toEqual({ warnings: { name: 'Give your recipe a name' } });
  });

  it.each(['0', '51', 'six', '2.5'])('warns when Serves is "%s"', (serves) => {
    expect(read({ name: 'Soup', serves })).toEqual({ warnings: { serves: 'Enter a number from 1 to 50' } });
  });

  it('reads times as minutes, and warns when it cannot', () => {
    const ok = read({ name: 'Soup', totalTime: '1 h 10', prepTime: '70' });
    expect('input' in ok && [ok.input.total_minutes, ok.input.prep_minutes]).toEqual([70, 70]);
    expect(read({ name: 'Soup', totalTime: 'a while', prepTime: 'soon' })).toEqual({
      warnings: { totalTime: 'Try “1 h 10” or “70 min”', prepTime: 'Try “1 h 10” or “70 min”' },
    });
  });

  it('shows every warning at once', () => {
    const result = read({ name: '', serves: '99', totalTime: '?' });
    expect('warnings' in result && Object.keys(result.warnings).sort()).toEqual(['name', 'serves', 'totalTime']);
  });
});

describe('unsaved changes (US3)', () => {
  it('knows when something changed', () => {
    const start = formFromRecipe(quiche);
    expect(isDirty(start, { ...start })).toBe(false);
    expect(isDirty(start, { ...start, bestMonths: [12, 2, 1] })).toBe(false);
    expect(isDirty(start, { ...start, name: 'Quiche' })).toBe(true);
    expect(isDirty(start, { ...start, photoPath: null })).toBe(true);
  });
});

describe('Advanced mode (US2)', () => {
  it('is remembered per person on this device', async () => {
    const saved = new Map<string, string>();
    const storage = { getItem: vi.fn(async (k: string) => saved.get(k) ?? null), setItem: vi.fn(async (k: string, v: string) => void saved.set(k, v)) };
    expect(await readAdvanced(storage, 'u-gabriel')).toBe(false);
    await writeAdvanced(storage, 'u-gabriel', true);
    expect(await readAdvanced(storage, 'u-gabriel')).toBe(true);
    expect(await readAdvanced(storage, 'u-alex')).toBe(false);
  });

  it('is off when the device refuses', async () => {
    const storage = { getItem: vi.fn().mockRejectedValue(new Error('no')), setItem: vi.fn().mockRejectedValue(new Error('no')) };
    await expect(writeAdvanced(storage, 'u', true)).resolves.toBeUndefined();
    expect(await readAdvanced(storage, 'u')).toBe(false);
  });
});
