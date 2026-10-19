import { describe, expect, it } from 'vitest';
import { quiche, quicheIds } from './quiche.fixture';
import { applyVariants, noVariants, validChoice, variantEffect, type RecipeVariant } from './variants';

const dough = quiche.variants.find((v) => v.id === quicheIds.dough) as RecipeVariant;
const names = (choice: Parameters<typeof applyVariants>[2]) => applyVariants(quiche, quiche.variants, choice).ingredients.map((i) => i.name);

describe('applyVariants (spec 008 US2)', () => {
  it('Classic is the base recipe, nothing marked as a variant', () => {
    const r = applyVariants(quiche, quiche.variants, noVariants);
    expect(r.ingredients.map((i) => i.name)).toEqual(quiche.ingredients.map((i) => i.name));
    expect(r.ingredients.some((i) => i.fromVariant)).toBe(false);
    expect(r.steps).toHaveLength(6);
  });

  it('Vegetarian swaps the lardons for mushrooms in the same place', () => {
    const r = applyVariants(quiche, quiche.variants, { version: quicheIds.vegetarian, options: [] });
    expect(r.ingredients[3]).toMatchObject({ name: 'Mushrooms', quantity: 250, unit: 'g', prep_note: 'sliced', fromVariant: true });
    expect(r.ingredients.map((i) => i.name)).not.toContain('Bacon lardons');
  });

  it('"Make my own dough" swaps pastry for three rows and adds a step before Preheat (6 → 7)', () => {
    const r = applyVariants(quiche, quiche.variants, { version: null, options: [quicheIds.dough] });
    expect(r.ingredients.slice(0, 3).map((i) => i.name)).toEqual(['Flour', 'Cold butter', 'Ice water']);
    expect(r.ingredients).toHaveLength(10);
    expect(r.steps).toHaveLength(7);
    expect(r.steps[0]).toMatchObject({ id: `${quicheIds.dough}:1`, name: 'Make the dough', fromVariant: true });
    expect(r.steps[1]?.name).toBe('Preheat and line');
  });

  it('combines a version and an option', () => {
    expect(names({ version: quicheIds.vegetarian, options: [quicheIds.dough] })).toEqual([
      'Flour', 'Cold butter', 'Ice water', 'Butter', 'Leeks', 'Mushrooms', 'Eggs', 'Heavy cream', 'Gruyère', 'Nutmeg',
    ]);
  });

  it('ignores a version id passed as an option, and an option id passed as the version', () => {
    expect(names({ version: quicheIds.dough, options: [quicheIds.vegetarian] })).toEqual(quiche.ingredients.map((i) => i.name));
  });

  it('applies variants in their saved order, and skips changes pointing at rows that are gone', () => {
    const first: RecipeVariant = { id: 'a', position: 0, name: 'No lardons', kind: 'option', changes: [{ type: 'remove_ingredient', ingredient_id: quicheIds.lardons }] };
    const second: RecipeVariant = {
      id: 'b',
      position: 1,
      name: 'Tofu',
      kind: 'option',
      changes: [
        { type: 'swap_ingredient', ingredient_id: quicheIds.lardons, with: [{ id: 'tofu', name: 'Tofu' }] },
        { type: 'add_ingredient', ingredient: { id: 'chives', name: 'Chives' } },
      ],
    };
    const r = applyVariants(quiche, [second, first], { version: null, options: ['b', 'a'] });
    expect(r.ingredients.map((i) => i.name)).not.toContain('Tofu');
    expect(r.ingredients.at(-1)).toMatchObject({ name: 'Chives', fromVariant: true });
  });

  it('changes and removes steps', () => {
    const v: RecipeVariant = {
      id: 'v',
      position: 0,
      name: 'Quick',
      kind: 'option',
      changes: [
        { type: 'change_step', step_id: 'c0c02000-0000-4000-8000-000000000005', body: 'Bake for 25 minutes.', timer_seconds: 1500 },
        { type: 'remove_step', step_id: 'c0c02000-0000-4000-8000-000000000006' },
        { type: 'add_step', step_id: 'missing', place: 'after', step: { body: 'Never added.' } },
      ],
    };
    const r = applyVariants(quiche, [v], { version: null, options: ['v'] });
    expect(r.steps).toHaveLength(5);
    expect(r.steps[4]).toMatchObject({ name: 'Bake', body: 'Bake for 25 minutes.', timer_seconds: 1500, fromVariant: false });
  });

  it("doesn't change the recipe it was given", () => {
    const before = JSON.stringify(quiche);
    applyVariants(quiche, quiche.variants, { version: quicheIds.vegetarian, options: [quicheIds.dough] });
    expect(JSON.stringify(quiche)).toBe(before);
  });
});

describe('validChoice (FR-006)', () => {
  it('drops remembered ids that no longer exist or have the wrong kind', () => {
    expect(validChoice(quiche.variants, { version: 'deleted', options: [quicheIds.dough, quicheIds.dough, quicheIds.vegetarian, 'gone'] })).toEqual({
      version: null,
      options: [quicheIds.dough],
    });
  });
});

describe('variantEffect (FR-002)', () => {
  it('counts what a swap brings in as added', () => {
    expect(variantEffect(dough.changes)).toEqual({ ingredientsAdded: 3, ingredientsRemoved: 0, stepsAdded: 1, stepsChanged: 0, stepsRemoved: 0 });
  });
});
