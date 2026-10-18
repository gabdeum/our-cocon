import { describe, expect, expectTypeOf, it } from 'vitest';
import type { Database } from './database.types';
import { ActivityInput } from './activity';
import { AISLE_ORDER, Aisle, GroceryItemInput } from './groceries';
import { IngredientInput, RecipeInput, SizeWord, StepInput, Unit, VariantChange, VariantInput, VariantKind } from './recipes';
import { WriteSource } from './sources';
import { ChangeEvent, familyChannel } from './sync';

type Enums = Database['public']['Enums'];
const id = '5f3e2d1c-0b9a-4876-9543-210fedcba987';

describe('enums match the database', () => {
  it('has the same values as the migrations', () => {
    expectTypeOf<Unit>().toEqualTypeOf<Enums['unit']>();
    expectTypeOf<SizeWord>().toEqualTypeOf<Enums['size_word']>();
    expectTypeOf<VariantKind>().toEqualTypeOf<Enums['variant_kind']>();
    expectTypeOf<Aisle>().toEqualTypeOf<Enums['aisle']>();
  });

  it('keeps the fixed aisle order', () => {
    expect(AISLE_ORDER[0]).toBe('produce');
    expect(AISLE_ORDER.at(-1)).toBe('other');
    expect(AISLE_ORDER).toHaveLength(10);
  });
});

describe('recipe inputs', () => {
  const recipe = { name: ' Leek & bacon quiche ', serves: 4, best_months: [10, 11] };

  it('trims and keeps the database limits', () => {
    expect(RecipeInput.parse(recipe).name).toBe('Leek & bacon quiche');
    expect(RecipeInput.safeParse({ ...recipe, name: 'x'.repeat(81) }).success).toBe(false);
    expect(RecipeInput.safeParse({ ...recipe, description: 'x'.repeat(141) }).success).toBe(false);
    expect(RecipeInput.safeParse({ ...recipe, serves: 51 }).success).toBe(false);
    expect(RecipeInput.safeParse({ ...recipe, best_months: [13] }).success).toBe(false);
    expect(RecipeInput.safeParse({ ...recipe, best_months: [3, 3] }).success).toBe(false);
  });

  it('accepts no extra fields (family, author and source are the database\'s)', () => {
    expect(RecipeInput.safeParse({ ...recipe, family_id: id }).success).toBe(false);
    expect(RecipeInput.safeParse({ ...recipe, source: 'claude' }).success).toBe(false);
  });

  it('allows sizes and piece weights on pieces only', () => {
    expect(IngredientInput.safeParse({ position: 0, name: 'Onions', quantity: 2, unit: 'piece', size_word: 'small' }).success).toBe(true);
    expect(IngredientInput.safeParse({ position: 0, name: 'Flour', quantity: 200, unit: 'g', size_word: 'small' }).success).toBe(false);
    expect(IngredientInput.safeParse({ position: 0, name: 'Flour', unit: 'g' }).success).toBe(false);
    expect(IngredientInput.safeParse({ position: 0, name: 'Salt' }).success).toBe(true);
  });

  it('needs a timer for a timer label', () => {
    expect(StepInput.safeParse({ position: 0, body: 'Bake', timer_seconds: 1800, timer_label: 'Bake' }).success).toBe(true);
    expect(StepInput.safeParse({ position: 0, body: 'Bake', timer_label: 'Bake' }).success).toBe(false);
  });
});

describe('variant changes', () => {
  const flour = { id, name: 'Flour', quantity: 200, unit: 'g' };

  it('accepts the six change types', () => {
    const changes = [
      { type: 'swap_ingredient', ingredient_id: id, with: [flour] },
      { type: 'add_ingredient', ingredient: flour },
      { type: 'remove_ingredient', ingredient_id: id },
      { type: 'add_step', step_id: id, place: 'before', step: { body: 'Make the dough' } },
      { type: 'change_step', step_id: id, timer_seconds: 600 },
      { type: 'remove_step', step_id: id },
    ];
    expect(VariantInput.safeParse({ position: 0, name: 'Homemade dough', kind: 'option', changes }).success).toBe(true);
  });

  it('rejects unknown changes and empty swaps', () => {
    expect(VariantChange.safeParse({ type: 'change_servings', serves: 2 }).success).toBe(false);
    expect(VariantChange.safeParse({ type: 'swap_ingredient', ingredient_id: id, with: [] }).success).toBe(false);
  });
});

describe('groceries, activity and sync', () => {
  it('validates grocery items', () => {
    expect(GroceryItemInput.safeParse({ name: 'Leeks', quantity: 2, unit: 'piece', aisle: 'produce' }).success).toBe(true);
    expect(GroceryItemInput.safeParse({ name: 'Leeks', aisle: 'garden' }).success).toBe(false);
  });

  it('names actions and sources in lower case', () => {
    expect(ActivityInput.safeParse({ action: 'add_groceries', target_kind: 'grocery_item', payload: {} }).success).toBe(true);
    expect(ActivityInput.safeParse({ action: 'Add groceries', target_kind: 'x', payload: {} }).success).toBe(false);
    expect(WriteSource.safeParse('chatgpt').success).toBe(true);
    expect(WriteSource.safeParse('Claude Desktop').success).toBe(false);
  });

  it('reads what the database sends', () => {
    expect(ChangeEvent.parse({ table: 'recipes', op: 'update', id, by: id, source: 'app' }).table).toBe('recipes');
    expect(ChangeEvent.safeParse({ table: 'recipe_ingredients', op: 'update', id }).success).toBe(false);
    expect(familyChannel(id)).toBe(`family:${id}`);
  });
});
