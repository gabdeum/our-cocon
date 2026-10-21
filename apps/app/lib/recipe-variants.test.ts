import { describe, expect, it } from 'vitest';
import { quiche, quicheIds } from '@cocon/schemas/quiche.fixture';
import type { RecipeVariant } from '@cocon/schemas';
import { draftsFromRows, type IngredientDraft } from './recipe-ingredients';
import { draftsFromSteps, type SavedStep } from './recipe-steps';
import {
  changeSummary,
  changeTag,
  createdVariantEvents,
  draftBroken,
  draftConflicts,
  draftsFromVariants,
  emptyVariant,
  newChange,
  pickChangeStep,
  readVariants,
  variantsChanged,
  variantSummary,
  type ChangeDraft,
  type SummaryBase,
  type VariantDraft,
} from './recipe-variants';

const savedSteps: SavedStep[] = quiche.steps.map((s, position) => ({
  id: s.id,
  position,
  name: s.name ?? null,
  body: s.body,
  timer_seconds: s.timer_seconds ?? null,
  timer_label: s.timer_label ?? null,
  temp_check_c: s.temp_check_c ?? null,
  temp_check_text: s.temp_check_text ?? null,
  tip: s.tip ?? null,
  photo_path: null,
}));
const baseSteps = draftsFromSteps(savedSteps);
const ids = (() => {
  let n = 0;
  return () => `00000000-0000-4000-8000-${String((n += 1)).padStart(12, '0')}`;
})();

const names = new Map<string, string>(quiche.ingredients.map((i) => [i.id, i.name]));
for (const v of quiche.variants)
  for (const c of v.changes) if (c.type === 'swap_ingredient') for (const w of c.with) names.set(w.id, w.name);
const base: SummaryBase = { ingredients: quiche.ingredients, steps: quiche.steps, names, facts: () => null };

const vegetarian = quiche.variants[0] as RecipeVariant;
const dough = quiche.variants[1] as RecipeVariant;

const fill = (d: IngredientDraft, patch: Partial<IngredientDraft>): IngredientDraft => ({ ...d, ...patch });

describe('summaries (FR-005, OC-RecipeSettings)', () => {
  it('a swap reads "~~Shortcrust pastry~~ → 200 g flour, 100 g cold butter, 50 ml ice water"', () => {
    const swap = dough.changes[0];
    if (!swap) throw new Error('fixture');
    expect(changeSummary(swap, base)).toEqual({ struck: 'Shortcrust pastry', text: '200 g flour, 100 g cubed cold butter, 50 ml ice water' });
    expect(changeTag(swap, base)).toEqual({ label: 'Replace ingredient', tone: 'honey' });
  });

  it('an added step reads "Make the dough · 30 min timer", tagged before step 1', () => {
    const add = dough.changes[1];
    if (!add) throw new Error('fixture');
    expect(changeSummary(add, base)).toEqual({ struck: null, text: 'Make the dough · 30 min timer' });
    expect(changeTag(add, base)).toEqual({ label: 'Add step · before step 1', tone: 'sage' });
  });

  it('a changed step says what changes', () => {
    const change = { type: 'change_step' as const, step_id: quicheIds.preheat, body: 'Heat to {temp:200}.', timer_seconds: null };
    expect(changeSummary(change, base)).toEqual({ struck: null, text: '“Heat to 200 °C (400 °F).” · No timer' });
    expect(changeTag(change, base).label).toBe('Change step 1');
  });

  it("the settings line: Vegetarian and the dough option", () => {
    expect(variantSummary(vegetarian.changes, base)).toBe('Replaces bacon lardons with 250 g sliced mushrooms');
    expect(variantSummary(dough.changes, base)).toBe('Replaces shortcrust pastry with 3 ingredients · adds step “Make the dough” · changes step 1');
    expect(variantSummary([], base)).toBe('No changes yet');
  });

  it('leaves out changes pointing at something removed', () => {
    const gone = { type: 'remove_ingredient' as const, ingredient_id: '00000000-0000-4000-8000-0000000000ee' };
    expect(variantSummary([gone, ...vegetarian.changes], base)).toBe('Replaces bacon lardons with 250 g sliced mushrooms');
  });
});

describe('drafts and Save', () => {
  const start = () => draftsFromVariants(quiche.variants, savedSteps, {});

  it('saved variants come back unchanged when nothing is edited', () => {
    const read = readVariants(start(), baseSteps);
    expect(read).toEqual({ rows: quiche.variants.map(({ id, name, kind, changes }) => ({ id, name, kind, changes })) });
  });

  it('US1: a new version "Vegetarian" swapping bacon lardons for 250 g sliced mushrooms', () => {
    const swap = newChange('swap_ingredient', ids) as Extract<ChangeDraft, { type: 'swap_ingredient' }>;
    const row = swap.with[0] as IngredientDraft;
    const draft: VariantDraft = {
      ...emptyVariant(ids()),
      name: ' Vegetarian ',
      changes: [{ ...swap, ingredientId: quicheIds.lardons, with: [fill(row, { name: 'Mushrooms', quantity: '250', unit: 'g', prepNote: 'sliced' })] }],
    };
    const read = readVariants([draft], baseSteps);
    if (!('rows' in read)) throw new Error(JSON.stringify(read));
    expect(read.rows).toEqual([
      {
        id: draft.id,
        name: 'Vegetarian',
        kind: 'version',
        changes: [{ type: 'swap_ingredient', ingredient_id: quicheIds.lardons, with: [expect.objectContaining({ id: row.id, name: 'Mushrooms', quantity: 250, unit: 'g', prep_note: 'sliced' })] }],
      },
    ]);
    expect(createdVariantEvents(read.rows, new Set())).toEqual([{ change_count: 1 }]);
    expect(createdVariantEvents(read.rows, new Set([draft.id]))).toEqual([]);
  });

  it('US2: an option adding "Make the dough" before step 1 with a 30 min timer', () => {
    const add = newChange('add_step', ids) as Extract<ChangeDraft, { type: 'add_step' }>;
    const draft: VariantDraft = {
      ...emptyVariant(ids()),
      name: 'Make my own dough',
      kind: 'option',
      changes: [{ ...add, stepId: quicheIds.preheat, step: { ...add.step, name: 'Make the dough', body: 'Rub, chill.', timerOn: true, minutes: '30', timerLabel: 'Chill dough' } }],
    };
    const read = readVariants([draft], baseSteps);
    if (!('rows' in read)) throw new Error(JSON.stringify(read));
    expect(read.rows[0]?.changes).toEqual([
      {
        type: 'add_step',
        step_id: quicheIds.preheat,
        place: 'before',
        step: { name: 'Make the dough', body: 'Rub, chill.', timer_seconds: 1800, timer_label: 'Chill dough', temp_check_c: null, temp_check_text: null, tip: null, photo_path: null },
      },
    ]);
  });

  it('a changed step saves only what differs from the base step', () => {
    const pick = newChange('change_step', ids) as Extract<ChangeDraft, { type: 'change_step' }>;
    const picked = pickChangeStep(pick, baseSteps[4] as (typeof baseSteps)[number]) as Extract<ChangeDraft, { type: 'change_step' }>;
    const draft = { ...emptyVariant(ids()), name: 'Quick', changes: [{ ...picked, step: { ...picked.step, minutes: '25' } }] };
    const read = readVariants([draft], baseSteps);
    if (!('rows' in read)) throw new Error(JSON.stringify(read));
    expect(read.rows[0]?.changes).toEqual([{ type: 'change_step', step_id: 'c0c02000-0000-4000-8000-000000000005', timer_seconds: 1500 }]);
    const same = readVariants([{ ...draft, changes: [picked] }], baseSteps);
    expect('warnings' in same && Object.values(same.warnings[draft.key]?.change ?? {})).toEqual(['stepUnchanged']);
  });

  it('warns for no name, no changes, and changes left half done; drops empty ones', () => {
    const empty = { ...emptyVariant(ids()), changes: [newChange('remove_ingredient', ids), newChange('swap_ingredient', ids)] };
    const half = newChange('swap_ingredient', ids) as Extract<ChangeDraft, { type: 'swap_ingredient' }>;
    const halfDone = { ...emptyVariant(ids()), name: 'Half', changes: [{ ...half, with: [fill(half.with[0] as IngredientDraft, { name: 'Tofu' })] }] };
    const read = readVariants([empty, halfDone], baseSteps);
    if (!('warnings' in read)) throw new Error('expected warnings');
    expect(read.warnings[empty.key]).toMatchObject({ name: 'nameMissing', changes: 'noChanges' });
    expect(read.warnings[halfDone.key]?.change).toEqual({ [half.key]: 'pickIngredient' });
  });

  it("passes on a row's own warning", () => {
    const add = newChange('add_ingredient', ids) as Extract<ChangeDraft, { type: 'add_ingredient' }>;
    const draft = { ...emptyVariant(ids()), name: 'Chives', changes: [{ ...add, ingredient: fill(add.ingredient, { name: 'Chives', quantity: '2' }) }] };
    const read = readVariants([draft], baseSteps);
    if (!('warnings' in read)) throw new Error('expected warnings');
    expect(read.warnings[draft.key]).toMatchObject({ change: { [add.key]: 'rows' }, rows: { [add.ingredient.key]: 'unitMissing' } });
  });

  it("writes back changes it can't read, so editing a variant never loses an assistant's change", () => {
    const odd = { type: 'remove_step', step: 'not an id' };
    const [veg] = draftsFromVariants([{ ...vegetarian, unreadable: [odd] }], savedSteps, {}) as [VariantDraft];
    const read = readVariants([{ ...veg, name: 'Veggie' }], baseSteps);
    expect(read).toEqual({ rows: [{ id: vegetarian.id, name: 'Veggie', kind: 'version', changes: [...vegetarian.changes, odd] }] });
    // Only unreadable changes left: not "no changes".
    expect('rows' in readVariants([{ ...veg, changes: [] }], baseSteps)).toBe(true);
  });

  it('knows when anything changed', () => {
    const s = start();
    expect(variantsChanged(s, [...s])).toBe(false);
    expect(variantsChanged(s, s.slice(1))).toBe(true);
    expect(variantsChanged(s, [{ ...(s[0] as VariantDraft), name: 'Veggie' }, ...s.slice(1)])).toBe(true);
  });
});

describe('warnings while editing (edge cases)', () => {
  it('"Also changed by" when two variants change the same ingredient', () => {
    const drafts = draftsFromVariants(
      [...quiche.variants, { id: ids(), position: 2, name: 'No bacon', kind: 'option', changes: [{ type: 'remove_ingredient', ingredient_id: quicheIds.lardons }] }],
      savedSteps,
      {},
    );
    const conflicts = draftConflicts(drafts, baseSteps);
    const [veg, , noBacon] = drafts as [VariantDraft, VariantDraft, VariantDraft];
    expect(conflicts[veg.key]).toEqual({ [veg.changes[0]?.key ?? '']: ['No bacon'] });
    expect(conflicts[noBacon.key]).toEqual({ [noBacon.changes[0]?.key ?? '']: ['Vegetarian'] });
  });

  it('a change pointing at an ingredient removed in the form is broken (032-later L29)', () => {
    const [veg] = draftsFromVariants(quiche.variants, savedSteps, {}) as [VariantDraft];
    const ingredients = draftsFromRows(quiche.ingredients.map((i, position) => ({ ...i, position })), {});
    expect(draftBroken(veg, { ingredients, steps: baseSteps }, baseSteps).size).toBe(0);
    const without = ingredients.filter((d) => d.id !== quicheIds.lardons);
    expect([...draftBroken(veg, { ingredients: without, steps: baseSteps }, baseSteps)]).toEqual([veg.changes[0]?.key]);
  });
});
