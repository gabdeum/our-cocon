import AsyncStorage from '@react-native-async-storage/async-storage';
import { z } from 'zod';
import { validChoice, type RecipeVariant, type VariantChoice } from '@cocon/schemas';

/**
 * FR-006: the servings and variants picked on a recipe, remembered on this device until changed.
 * Kept per person, so whoever signs in next on a shared iPad starts from the recipe as saved.
 * Only numbers and ids are stored, never recipe text.
 */
export interface RecipeChoices extends VariantChoice {
  servings: number;
}

export type ChoiceStorage = Pick<typeof AsyncStorage, 'getItem' | 'setItem'>;

const Stored = z.object({
  servings: z.int().min(1).max(50),
  version: z.string().max(64).nullable(),
  options: z.array(z.string().max(64)).max(50),
});

const key = (userId: string, recipeId: string) => `cocon.recipe.${userId}.${recipeId}`;

/** The choices to open with: what was remembered, still valid for this recipe, or the recipe as saved. */
export function startingChoices(stored: unknown, recipe: { serves: number; variants: readonly RecipeVariant[] }, max: number): RecipeChoices {
  const parsed = Stored.safeParse(stored);
  if (!parsed.success) return { servings: Math.min(recipe.serves, max), version: null, options: [] };
  return { servings: Math.min(parsed.data.servings, max), ...validChoice(recipe.variants, parsed.data) };
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
    await storage.setItem(key(userId, recipeId), JSON.stringify({ servings: choices.servings, version: choices.version, options: choices.options }));
  } catch {
    // Nothing to tell the cook; the choice just isn't kept.
  }
}

export const deviceStorage: ChoiceStorage = AsyncStorage;
