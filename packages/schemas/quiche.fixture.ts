import type { IngredientRow, StepRow } from './recipes';
import type { RecipeVariant } from './variants';

/** The seed quiche (supabase/seed.sql, OC-Recipe) for tests: serves 6, two variants. */
export const quicheIds = {
  pastry: 'c0c01000-0000-4000-8000-000000000001',
  lardons: 'c0c01000-0000-4000-8000-000000000004',
  mushrooms: 'c0c04000-0000-4000-8000-000000000001',
  preheat: 'c0c02000-0000-4000-8000-000000000001',
  vegetarian: 'c0c03000-0000-4000-8000-000000000001',
  dough: 'c0c03000-0000-4000-8000-000000000002',
} as const;

const ing = (n: number, row: Omit<IngredientRow, 'id'>): IngredientRow => ({ id: `c0c01000-0000-4000-8000-00000000000${n}`, ...row });
const piece = (weight: number, one: string, many: string) => ({ unit: 'piece' as const, weight_per_piece_g: weight, piece_noun_singular: one, piece_noun_plural: many });

export const quicheIngredients: IngredientRow[] = [
  ing(1, { name: 'Shortcrust pastry', quantity: 1, ...piece(230, 'sheet of shortcrust pastry', 'sheets of shortcrust pastry') }),
  ing(2, { name: 'Butter', quantity: 20, unit: 'g' }),
  ing(3, { name: 'Leeks', quantity: 2, ...piece(150, 'leek', 'leeks') }),
  ing(4, { name: 'Bacon lardons', quantity: 200, unit: 'g' }),
  ing(5, { name: 'Eggs', quantity: 3, size_word: 'large', ...piece(50, 'egg', 'eggs') }),
  ing(6, { name: 'Heavy cream', quantity: 300, unit: 'ml' }),
  ing(7, { name: 'Gruyère', quantity: 100, unit: 'g', prep_note: 'grated' }),
  ing(8, { name: 'Nutmeg', quantity: 1, unit: 'pinch' }),
];

const step = (n: number, name: string, body: string, extra: Partial<StepRow> = {}): StepRow => ({ id: `c0c02000-0000-4000-8000-00000000000${n}`, name, body, ...extra });
const t = (n: number) => `{ing:c0c01000-0000-4000-8000-00000000000${n}}`;
export const quicheSteps: StepRow[] = [
  step(1, 'Preheat and line', `Preheat the oven to {temp:180}. Line a 23 cm (9 in) tart pan with ${t(1)} and prick the base with a fork.`, {
    tip: 'Chill the lined pan for 10 minutes so the edges don’t shrink.',
  }),
  step(2, 'Blind bake', 'Bake the empty crust for 12 minutes until pale golden.', { timer_seconds: 720, timer_label: 'Blind bake' }),
  step(3, 'Cook the filling', `In a large pan, melt ${t(2)} over medium heat. Add ${t(3)} finely sliced and cook 6–8 minutes until soft. Add ${t(4)} and cook 5 minutes until golden.`, {
    timer_seconds: 480,
    timer_label: 'Soften leeks',
  }),
  step(4, 'Mix the custard', `Whisk ${t(5)} with ${t(6)} and ${t(8)}. Season with salt and pepper, then stir in half of the ${t(7)}.`),
  step(5, 'Bake', 'Spread the filling in the crust, pour over the custard and top with the rest of the cheese. Bake for 35 minutes.', {
    timer_seconds: 2100,
    timer_label: 'Bake',
    temp_check_c: 71,
    temp_check_text: 'the center should reach {temp} and barely wobble.',
    tip: 'If the top browns too fast, cover it loosely with foil.',
  }),
  step(6, 'Rest', 'Let it rest for 10 minutes before slicing, so it holds together.', { timer_seconds: 600, timer_label: 'Rest' }),
];

export const quicheVariants: RecipeVariant[] = [
  {
    id: quicheIds.vegetarian,
    position: 0,
    name: 'Vegetarian',
    kind: 'version',
    changes: [
      {
        type: 'swap_ingredient',
        ingredient_id: quicheIds.lardons,
        with: [{ id: quicheIds.mushrooms, name: 'Mushrooms', quantity: 250, unit: 'g', prep_note: 'sliced' }],
      },
    ],
  },
  {
    id: quicheIds.dough,
    position: 1,
    name: 'Make my own dough',
    kind: 'option',
    changes: [
      {
        type: 'swap_ingredient',
        ingredient_id: quicheIds.pastry,
        with: [
          { id: 'c0c04000-0000-4000-8000-000000000002', name: 'Flour', quantity: 200, unit: 'g' },
          { id: 'c0c04000-0000-4000-8000-000000000003', name: 'Cold butter', quantity: 100, unit: 'g', prep_note: 'cubed' },
          { id: 'c0c04000-0000-4000-8000-000000000004', name: 'Ice water', catalog_key: 'water', quantity: 50, unit: 'ml' },
        ],
      },
      {
        type: 'add_step',
        step_id: quicheIds.preheat,
        place: 'before',
        step: {
          name: 'Make the dough',
          body: 'Rub {ing:c0c04000-0000-4000-8000-000000000002} and {ing:c0c04000-0000-4000-8000-000000000003} together with your fingertips until sandy. Add {ing:c0c04000-0000-4000-8000-000000000004}, bring into a ball, wrap and chill.',
          timer_seconds: 1800,
          timer_label: 'Chill dough',
          tip: 'Cold hands and cold butter make a flakier crust.',
        },
      },
      {
        type: 'change_step',
        step_id: quicheIds.preheat,
        body: 'Preheat the oven to {temp:180}. Line a 23 cm (9 in) tart pan with the rolled-out dough and prick the base with a fork.',
      },
    ],
  },
];

export const quiche = { serves: 6, ingredients: quicheIngredients, steps: quicheSteps, variants: quicheVariants };
