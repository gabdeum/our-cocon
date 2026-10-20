import AsyncStorage from '@react-native-async-storage/async-storage';
import { z } from 'zod';
import { validChoice, type RecipeVariant, type VariantChoice } from '@cocon/schemas';
import { Unit } from '@cocon/schemas/recipes';
import type { UnitSystem } from '@cocon/quantity';

/** "Scale by an ingredient" (spec 013): what you have of one ingredient. */
export interface ScaledBy {
  ingredientId: string;
  amount: number;
  unit: Unit;
}

/**
 * FR-006: the servings and variants picked on a recipe, remembered on this device until changed.
 * Kept per person, so whoever signs in next on a shared iPad starts from the recipe as saved.
 * Only numbers and ids are stored, never recipe text.
 *
 * Spec 013 adds the "…" panel's choices: units, the kitchen scale (FR-002) and a scale by an
 * ingredient. Units and the kitchen scale are null until toggled here, so the recipe's or family's
 * setting (spec 027) applies; once toggled they override it on this device. `servings` stays the
 * whole number from before scaling, so Reset returns to it.
 */
export interface RecipeChoices extends VariantChoice {
  servings: number;
  system: UnitSystem | null;
  kitchenScale: boolean | null;
  scaledBy: ScaledBy | null;
}

/** Nothing toggled in the "…" panel: the settings apply. */
export const defaultPanelChoices = { system: null, kitchenScale: null } as const satisfies Pick<RecipeChoices, 'system' | 'kitchenScale'>;

export type ChoiceStorage = Pick<typeof AsyncStorage, 'getItem' | 'setItem'>;

const Stored = z.object({
  servings: z.int().min(1).max(50),
  version: z.string().max(64).nullable(),
  options: z.array(z.string().max(64)).max(50),
  // Spec 013; older saved choices have none of these.
  system: z.enum(['metric', 'imperial']).nullable().optional(),
  kitchenScale: z.boolean().nullable().optional(),
  scaledBy: z
    .object({ ingredientId: z.string().max(64), amount: z.number().positive().max(1_000_000), unit: Unit })
    .nullable()
    .optional(),
});

const key = (userId: string, recipeId: string) => `cocon.recipe.${userId}.${recipeId}`;

/** The choices to open with: what was remembered, still valid for this recipe, or the recipe as saved. */
export function startingChoices(stored: unknown, recipe: { serves: number; variants: readonly RecipeVariant[] }, max: number): RecipeChoices {
  const parsed = Stored.safeParse(stored);
  if (!parsed.success) return { servings: Math.min(recipe.serves, max), version: null, options: [], ...defaultPanelChoices, scaledBy: null };
  const { system, kitchenScale, scaledBy } = parsed.data;
  return {
    servings: Math.min(parsed.data.servings, max),
    ...validChoice(recipe.variants, parsed.data),
    system: system ?? defaultPanelChoices.system,
    kitchenScale: kitchenScale ?? defaultPanelChoices.kitchenScale,
    scaledBy: scaledBy ?? null,
  };
}

export async function readChoices(storage: ChoiceStorage, userId: string, recipeId: string): Promise<unknown> {
  try {
    const raw = await storage.getItem(key(userId, recipeId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Best effort: if the device refuses, the page still works, it just won't remember. */
export async function writeChoices(storage: ChoiceStorage, userId: string, recipeId: string, choices: RecipeChoices): Promise<void> {
  try {
    const { servings, version, options, system, kitchenScale, scaledBy } = choices;
    await storage.setItem(key(userId, recipeId), JSON.stringify({ servings, version, options, system, kitchenScale, scaledBy }));
  } catch {
    // Nothing to tell the cook; the choice just isn't kept.
  }
}

export const deviceStorage: ChoiceStorage = AsyncStorage;
