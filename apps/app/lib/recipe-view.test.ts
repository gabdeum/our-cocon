import { describe, expect, it } from 'vitest';
import { quiche, quicheIds } from '@cocon/schemas/quiche.fixture';
import { format, scale } from '@cocon/quantity';
import { applyVariants, noVariants, type RecipeVariant, type VariantChoice } from '@cocon/schemas';
import { bestMonthsLabel, defaultFormat, optionHint, recipeChips, recipeView, servingsMax, timerClock, type StepPart } from './recipe-view';

const recipe = { ...quiche, facts: {} };
const dough = quiche.variants.find((v) => v.id === quicheIds.dough) as RecipeVariant;
const line = (choice: VariantChoice, servings: number, name: string) => recipeView(recipe, servings, choice).ingredients.find((i) => i.name === name);

describe('recipeView (FR-004)', () => {
  it('reads like the screen for 6', () => {
    const rows = recipeView(recipe, 6, noVariants).ingredients.map((i) => [i.amount, i.name, i.sub]);
    expect(rows).toEqual([
      ['1', 'Shortcrust pastry', '230 g'],
      ['20 g', 'Butter', null],
      ['2', 'Leeks', '300 g'],
      ['200 g', 'Bacon lardons', null],
      ['3', 'Large eggs', '150 g'],
      ['300 ml', 'Heavy cream', null],
      ['100 g', 'Gruyère, grated', null],
      ['1 pinch', 'Nutmeg', null],
    ]);
  });

  it('with catalog facts: no size word for the default size, and grams under volumes', () => {
    const linked = {
      ...recipe,
      ingredients: quiche.ingredients.map((i) => ({ ...i, catalog_key: ({ Leeks: 'leek', Eggs: 'egg', 'Heavy cream': 'heavy_cream' } as Record<string, string>)[i.name] ?? null })),
      facts: {
        leek: { default_size: 'medium' as const, size_small_g: 100, size_medium_g: 150, size_large_g: 250 },
        egg: { default_size: 'large' as const, size_small_g: 38, size_medium_g: 44, size_large_g: 50, whole_only: true },
        heavy_cream: { density_g_per_ml: 1 },
      },
    };
    const at7 = recipeView(linked, 7, noVariants).ingredients;
    const find = (name: string) => at7.find((i) => i.name === name);
    expect(find('Leeks')).toMatchObject({ amount: '2½', sub: '350 g' });
    expect(find('Eggs')).toMatchObject({ amount: '3½', sub: '175 g' });
    expect(find('Heavy cream')).toMatchObject({ amount: '350 ml', sub: '350 g' });
    // A variant's ingredient gets its facts too.
    const dough = recipeView({ ...linked, facts: { ...linked.facts, water: { density_g_per_ml: 1 } } }, 6, { version: null, options: [quicheIds.dough] }).ingredients;
    expect(dough.find((i) => i.name === 'Ice water')).toMatchObject({ amount: '50 ml', sub: '50 g' });
  });

  it('US1: for 9, every amount is the engine output for 9', () => {
    const scaled = scale({ serves: 6, ingredients: quiche.ingredients }, { servings: 9 }).ingredients.map((i) => format(i, defaultFormat));
    const rows = recipeView(recipe, 9, noVariants).ingredients;
    rows.forEach((row, n) => expect(row.amount.startsWith((scaled[n] as { amount: string }).amount)).toBe(true));
    expect(line(noVariants, 9, 'Bacon lardons')?.amount).toBe('300 g');
    expect(line(noVariants, 9, 'Large eggs')).toMatchObject({ amount: '4½', sub: '225 g' });
  });

  it('US2: Vegetarian shows mushrooms, tagged as a variant; dough shows its three rows and 7 steps', () => {
    const veg = { version: quicheIds.vegetarian, options: [] };
    expect(line(veg, 6, 'Bacon lardons')).toBeUndefined();
    expect(line(veg, 6, 'Mushrooms, sliced')).toMatchObject({ amount: '250 g', variant: true });
    const dough = { version: null, options: [quicheIds.dough] };
    const view = recipeView(recipe, 6, dough);
    expect(view.ingredients.slice(0, 3).map((i) => i.name)).toEqual(['Flour', 'Cold butter, cubed', 'Ice water']);
    expect(view.stepCount).toBe(7);
    expect(recipeView(recipe, 6, noVariants).stepCount).toBe(6);
  });

  it('SC-002: matches the quantity engine for every variant combination', () => {
    const choices: VariantChoice[] = [
      noVariants,
      { version: quicheIds.vegetarian, options: [] },
      { version: null, options: [quicheIds.dough] },
      { version: quicheIds.vegetarian, options: [quicheIds.dough] },
    ];
    for (const choice of choices)
      for (const servings of [1, 6, 9, 16]) {
        const applied = applyVariants(quiche, quiche.variants, choice).ingredients;
        const engine = scale({ serves: 6, ingredients: applied }, { servings }).ingredients.map((i) => format(i, defaultFormat));
        const view = recipeView(recipe, servings, choice).ingredients;
        expect(view.map((v) => v.sub)).toEqual(engine.map((e) => e.sub));
        expect(view.map((v) => v.amount.split(' ')[0])).toEqual(engine.map((e) => e.amount));
        expect({ choice, servings, view: view.map((v) => `${v.amount} | ${v.name}${v.sub ? ` (${v.sub})` : ''}${v.variant ? ' [Variant]' : ''}`) }).toMatchSnapshot();
      }
  });

  it('SC-001: a re-render with new servings or variants takes well under 50 ms', () => {
    const start = performance.now();
    for (let s = 1; s <= 16; s++) recipeView(recipe, s, { version: quicheIds.vegetarian, options: [quicheIds.dough] });
    expect((performance.now() - start) / 16).toBeLessThan(50);
  });
});

describe('servings range (edge cases)', () => {
  it('is 1–16, or up to what a bigger recipe serves', () => {
    expect(servingsMax(6)).toBe(16);
    expect(servingsMax(20)).toBe(20);
  });
});

describe('bestMonthsLabel (FR-001)', () => {
  it.each([
    [[10, 11, 12, 1, 2, 3], 'Best Oct – Mar'],
    [[6, 7, 8], 'Best Jun – Aug'],
    [[4], 'Best Apr'],
    [[1, 5, 6], 'Best Jan, May – Jun'],
    [[12, 1, 6], 'Best Jun, Dec – Jan'],
    [[], null],
    [[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], null],
  ])('%j → %s', (months, label) => expect(bestMonthsLabel(months)).toBe(label));
});

describe('recipeChips (FR-001)', () => {
  const members = [{ user_id: 'u-g', display_name: 'Gabriel' }];
  it('shows time, cuisine, best months and "via" the assistant', () => {
    expect(recipeChips({ total_minutes: 70, cuisine: 'french', best_months: [10, 11, 12, 1, 2, 3], created_by: 'u-g', source: 'claude' }, members)).toEqual({
      facts: ['1 h 10', 'French', 'Best Oct – Mar'],
      author: 'Gabriel · via Claude',
    });
  });
  it('hides an empty time, cuisine Other and all-year months', () => {
    expect(recipeChips({ total_minutes: null, cuisine: null, best_months: [], created_by: 'u-g', source: 'app' }, members)).toEqual({ facts: [], author: 'Gabriel' });
  });
});

describe('optionHint (FR-002)', () => {
  it('says what an option changes', () => {
    expect(optionHint(dough)).toBe('Adds 3 ingredients and 1 step. Changes 1 step');
    expect(optionHint({ changes: [{ type: 'remove_ingredient', ingredient_id: 'x' }] })).toBe('Removes 1 ingredient');
    expect(optionHint({ changes: [{ type: 'add_ingredient', ingredient: { id: 'c', name: 'Chives' } }, { type: 'change_step', step_id: 's', body: 'x' }] })).toBe(
      'Adds 1 ingredient. Changes 1 step',
    );
    expect(optionHint({ changes: [] })).toBeNull();
  });
});

const imperial = { system: 'imperial', scale: true } as const;
const amounts = (parts: StepPart[]) => parts.flatMap((p) => (typeof p === 'object' && 'amount' in p ? [p.amount] : []));
const text = (parts: StepPart[]) => parts.map((p) => (typeof p === 'string' ? p : 'amount' in p ? p.amount : p.missing)).join('');

describe('steps (spec 009)', () => {
  it('US1: at 9 servings, imperial, step 3 says "melt 1.1 oz butter… Add 3 leeks (15.9 oz)…" (30 g at 0.1 oz, like 15.9 oz)', () => {
    const step = recipeView(recipe, 9, noVariants, imperial).steps[2];
    expect(step).toMatchObject({ number: 3, name: 'Cook the filling', variant: false });
    expect(amounts(step?.parts ?? [])).toEqual(['1.1 oz butter', '3 leeks (15.9 oz)', '10.6 oz bacon lardons']);
    expect(text(step?.parts ?? [])).toContain('melt 1.1 oz butter over medium heat. Add 3 leeks (15.9 oz) finely sliced');
  });

  it('FR-001: temperatures in the body show both scales; temperature check, timer and tip come with the step', () => {
    const steps = recipeView(recipe, 6, noVariants).steps;
    expect(text(steps[0]?.parts ?? [])).toMatch(/^Preheat the oven to 180 °C \(350 °F\)\./);
    expect(steps[0]).toMatchObject({ timer: null, tip: 'Chill the lined pan for 10 minutes so the edges don’t shrink.' });
    expect(steps[1]?.timer).toEqual({ seconds: 720, label: 'Blind bake', clock: '12:00' });
    expect(steps[4]?.tempCheck).toBe('the center should reach 71 °C (160 °F) and barely wobble.');
    expect(recipeView(recipe, 6, noVariants, imperial).steps[4]?.tempCheck).toBe('the center should reach 160 °F (71 °C) and barely wobble.');
  });

  it('US2: the thermometer setting off hides the temperature check', () => {
    expect(recipeView(recipe, 6, noVariants, defaultFormat, { thermometer: false }).steps[4]?.tempCheck).toBeNull();
  });

  it('edge: a variant step carries the Variant tag and numbering stays continuous; Vegetarian fills the swapped token', () => {
    const steps = recipeView(recipe, 6, { version: quicheIds.vegetarian, options: [quicheIds.dough] }).steps;
    expect(steps.map((s) => s.number)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(steps[0]).toMatchObject({ name: 'Make the dough', variant: true, timer: { clock: '30:00' }, tip: 'Cold hands and cold butter make a flakier crust.' });
    expect(amounts(steps[0]?.parts ?? [])).toEqual(['200 g flour', '100 g cold butter', '50 ml ice water']);
    expect(text(steps[1]?.parts ?? [])).toContain('with the rolled-out dough');
    // Spec 017 FR-004: a step a variant changes carries the tag too.
    expect(steps[1]?.variant).toBe(true);
    expect(steps[2]?.variant).toBe(false);
    expect(amounts(steps[3]?.parts ?? [])).toContain('250 g mushrooms');
  });

  it('spec 017 SC-001: every variant combination of the seed quiche, step by step', () => {
    const choices: VariantChoice[] = [
      noVariants,
      { version: quicheIds.vegetarian, options: [] },
      { version: null, options: [quicheIds.dough] },
      { version: quicheIds.vegetarian, options: [quicheIds.dough] },
    ];
    for (const choice of choices) {
      const steps = recipeView(recipe, 6, choice).steps.map((s) => `${s.number} ${s.name ?? ''}${s.variant ? ' [Variant]' : ''}: ${text(s.parts)}`);
      expect({ choice, steps }).toMatchSnapshot();
    }
  });

  it('edge: a removed step disappears and the rest renumber', () => {
    const skipRest: RecipeVariant = { id: 'r', position: 2, name: 'No rest', kind: 'option', changes: [{ type: 'remove_step', step_id: 'c0c02000-0000-4000-8000-000000000002' }] };
    const steps = recipeView({ ...recipe, variants: [...quiche.variants, skipRest] }, 6, { version: null, options: ['r'] }).steps;
    expect(steps.map((s) => `${s.number} ${s.name}`)).toEqual(['1 Preheat and line', '2 Cook the filling', '3 Mix the custard', '4 Bake', '5 Rest']);
  });

  it('edge: a token whose ingredient is gone shows its last known name, or "an ingredient"', () => {
    const gone = { ...recipe, ingredients: quiche.ingredients.filter((i) => i.name !== 'Butter') };
    expect(recipeView(gone, 6, noVariants).steps[2]?.parts).toContainEqual({ missing: 'an ingredient' });
    const removed: RecipeVariant = { id: 'x', position: 2, name: 'No butter', kind: 'option', changes: [{ type: 'remove_ingredient', ingredient_id: 'c0c01000-0000-4000-8000-000000000002' }] };
    expect(recipeView({ ...recipe, variants: [removed] }, 6, { version: null, options: ['x'] }).steps[2]?.parts).toContainEqual({ missing: 'Butter' });
  });

  it('SC-001: for 1–16 servings, every variant choice and both systems, step amounts equal the ingredient tab', () => {
    const choices: VariantChoice[] = [noVariants, { version: quicheIds.vegetarian, options: [] }, { version: null, options: [quicheIds.dough] }, { version: quicheIds.vegetarian, options: [quicheIds.dough] }];
    for (const options of [defaultFormat, imperial, { system: 'metric', scale: false } as const])
      for (const choice of choices)
        for (let servings = 1; servings <= 16; servings++) {
          const view = recipeView(recipe, servings, choice, options);
          const applied = applyVariants(recipe, recipe.variants, choice);
          const phrases = new Map(
            scale({ serves: 6, ingredients: applied.ingredients }, { servings }).ingredients.map((i) => [i.id, format(i, options)] as const),
          );
          const lines = new Map(view.ingredients.map((l) => [l.id, l]));
          applied.steps.forEach((step, n) => {
            const ids = [...step.body.matchAll(/\{ing:([^}]+)\}/g)].map((m) => m[1] as string).filter((id) => phrases.has(id));
            expect(amounts(view.steps[n]?.parts ?? [])).toEqual(ids.map((id) => phrases.get(id)?.phrase));
            // The list line for each of those ingredients shows the same amount the step does.
            ids.forEach((id) => expect(phrases.get(id)?.phrase.startsWith(phrases.get(id)?.amount ?? '')).toBe(true));
            ids.forEach((id) => expect(lines.get(id)?.amount.startsWith(phrases.get(id)?.amount ?? '')).toBe(true));
          });
        }
  });

  it('timerClock pads minutes and seconds', () => {
    expect(timerClock(720)).toBe('12:00');
    expect(timerClock(330)).toBe('05:30');
    expect(timerClock(3600)).toBe('60:00');
  });
});
