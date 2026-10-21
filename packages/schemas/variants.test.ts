import { describe, expect, it } from 'vitest';
import { quiche, quicheIds } from './quiche.fixture';
import { applyVariants, brokenChanges, noVariants, parseVariantChanges, validChoice, variantConflicts, variantEffect, type RecipeVariant } from './variants';

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

  it('US3: Vegetarian plus dough: both apply, 10 ingredients and 7 steps (the seed Classic has 8)', () => {
    const r = applyVariants(quiche, quiche.variants, { version: quicheIds.vegetarian, options: [quicheIds.dough] });
    expect(r.ingredients).toHaveLength(10);
    expect(r.steps).toHaveLength(7);
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
    // FR-004: a changed step carries the Variant tag.
    expect(r.steps[4]).toMatchObject({ name: 'Bake', body: 'Bake for 25 minutes.', timer_seconds: 1500, fromVariant: true });
  });

  it('a swap to one ingredient carries the step tokens over (spec 009)', () => {
    const r = applyVariants(quiche, quiche.variants, { version: quicheIds.vegetarian, options: [] });
    expect(r.steps[2]?.body).toContain(`{ing:${quicheIds.mushrooms}}`);
    expect(r.steps[2]?.body).not.toContain(quicheIds.lardons);
  });

  it('follows a swapped-in ingredient swapped again, and leaves a swap to several ingredients alone', () => {
    const again: RecipeVariant = {
      id: 'again',
      position: 2,
      name: 'Tofu',
      kind: 'option',
      changes: [{ type: 'swap_ingredient', ingredient_id: quicheIds.mushrooms, with: [{ id: 'c0c04000-0000-4000-8000-0000000000ff', name: 'Tofu' }] }],
    };
    const r = applyVariants(quiche, [...quiche.variants, again], { version: quicheIds.vegetarian, options: ['again'] });
    expect(r.steps[2]?.body).toContain('{ing:c0c04000-0000-4000-8000-0000000000ff}');
    const split: RecipeVariant = {
      id: 'split',
      position: 0,
      name: 'Two',
      kind: 'option',
      changes: [{ type: 'swap_ingredient', ingredient_id: quicheIds.pastry, with: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }] }],
    };
    expect(applyVariants(quiche, [split], { version: null, options: ['split'] }).steps[0]?.body).toContain(`{ing:${quicheIds.pastry}}`);
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
    expect(variantEffect(dough.changes)).toEqual({ ingredientsAdded: 3, ingredientsRemoved: 0, stepsAdded: 1, stepsChanged: 1, stepsRemoved: 0 });
  });
});

describe('brokenChanges (edge case)', () => {
  it('finds changes pointing at an ingredient or step the recipe no longer has', () => {
    const changes: RecipeVariant['changes'] = [
      { type: 'remove_ingredient', ingredient_id: quicheIds.lardons },
      { type: 'swap_ingredient', ingredient_id: 'c0c01000-0000-4000-8000-0000000000aa', with: [{ id: 'x', name: 'X' }] },
      { type: 'add_ingredient', ingredient: { id: 'y', name: 'Y' } },
      { type: 'remove_step', step_id: 'c0c02000-0000-4000-8000-0000000000aa' },
      { type: 'change_step', step_id: quicheIds.preheat, body: 'Preheat.' },
    ];
    expect(brokenChanges(quiche, changes)).toEqual([1, 3]);
    expect(brokenChanges(quiche, dough.changes)).toEqual([]);
  });
});

describe('variantConflicts (edge case)', () => {
  const noBacon: RecipeVariant = { id: 'nb', position: 2, name: 'No bacon', kind: 'option', changes: [{ type: 'remove_ingredient', ingredient_id: quicheIds.lardons }] };
  it('names the other variant changing the same ingredient, both ways', () => {
    const c = variantConflicts([...quiche.variants, noBacon]);
    expect(c[quicheIds.vegetarian]).toEqual({ 0: ['No bacon'] });
    expect(c.nb).toEqual({ 0: ['Vegetarian'] });
    expect(c[quicheIds.dough]).toEqual({});
  });
  it('two versions never clash: only one can be picked', () => {
    const c = variantConflicts([...quiche.variants, { ...noBacon, kind: 'version' }]);
    expect(c[quicheIds.vegetarian]).toEqual({});
  });
  it('the later one in the list wins when both are on', () => {
    const swap: RecipeVariant = { id: 'tofu', position: 3, name: 'Tofu', kind: 'option', changes: [{ type: 'swap_ingredient', ingredient_id: quicheIds.lardons, with: [{ id: 't', name: 'Tofu' }] }] };
    const r = applyVariants(quiche, [noBacon, swap], { version: null, options: ['nb', 'tofu'] });
    expect(r.ingredients.map((i) => i.name)).not.toContain('Tofu');
    const r2 = applyVariants(quiche, [{ ...swap, position: 0 }, { ...noBacon, position: 1 }], { version: null, options: ['nb', 'tofu'] });
    expect(r2.ingredients.map((i) => i.name)).toContain('Tofu');
  });
});

describe('parseVariantChanges', () => {
  it('keeps the valid changes and drops the rest', () => {
    expect(parseVariantChanges([{ type: 'remove_step', step_id: quicheIds.preheat }, { type: 'nope' }, 3])).toEqual([{ type: 'remove_step', step_id: quicheIds.preheat }]);
    expect(parseVariantChanges('x')).toEqual([]);
  });
});
