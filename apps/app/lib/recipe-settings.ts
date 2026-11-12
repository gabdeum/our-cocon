import { useMemo } from 'react';
import { RecipeOverridesUpdate, resolveCooking, type CookingSettings, type RecipeOverrides } from '@cocon/schemas';
import { useFamilySettings, useMyRecipeSettings } from './family-settings';
import type { Client } from './supabase';

/** Saves a recipe's own cooking settings (spec 027); null puts one back on the family's default. */
export async function saveRecipeOverrides(client: Pick<Client, 'from'>, recipeId: string, change: RecipeOverridesUpdate): Promise<{ error: unknown }> {
  const valid = RecipeOverridesUpdate.safeParse(change);
  if (!valid.success) return { error: valid.error };
  const { error } = await client.from('recipes').update(valid.data).eq('id', recipeId);
  return { error };
}

/**
 * What's in force for a recipe (FR-001): its own settings, else the family's defaults (all on, in
 * metric, until those load), and the member's own units (spec 051). The recipe page, cooking mode
 * and their sheets read this.
 */
export function useCookingSettings(overrides: Partial<RecipeOverrides> | undefined): CookingSettings {
  const { settings } = useFamilySettings();
  const { settings: mine } = useMyRecipeSettings();
  const { keepAwake, scale, thermometer, system } = resolveCooking(settings, overrides, mine);
  // The same object while nothing changes, so the screens' views aren't recomputed every render.
  return useMemo(() => ({ keepAwake, scale, thermometer, system }), [keepAwake, scale, thermometer, system]);
}
