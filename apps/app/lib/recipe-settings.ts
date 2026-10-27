import { useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { RecipeOverridesUpdate, resolveCooking, type CookingSetting, type CookingSettings, type RecipeOverrides, type Tracker } from '@cocon/schemas';
import { useFamilySettings } from './family-settings';
import { recipeKey, type RecipeDetail } from './recipe';
import type { Client } from './supabase';
import { optimisticWrite } from './write';

/** Saves a recipe's own cooking settings (spec 027); null puts one back on the family's default. */
export async function saveRecipeOverrides(client: Pick<Client, 'from'>, recipeId: string, change: RecipeOverridesUpdate): Promise<{ error: unknown }> {
  const valid = RecipeOverridesUpdate.safeParse(change);
  if (!valid.success) return { error: valid.error };
  const { error } = await client.from('recipes').update(valid.data).eq('id', recipeId);
  return { error };
}

/** Shown at once and saved; reverts on failure. Each setting changed (or reset) is tracked, never the recipe. */
export async function changeRecipeOverrides(
  deps: { queryClient: ReturnType<typeof useQueryClient>; client: Pick<Client, 'from'>; tracker: Tracker; familyId: string; recipeId: string },
  change: RecipeOverridesUpdate,
): Promise<'saved' | 'failed'> {
  const { queryClient, client, tracker, familyId, recipeId } = deps;
  const result = await optimisticWrite<RecipeDetail | null>(
    queryClient,
    recipeKey(familyId, recipeId),
    (r) => (r ? { ...r, overrides: { ...r.overrides, ...change } } : r),
    () => saveRecipeOverrides(client, recipeId, change),
  );
  if (result === 'saved') for (const setting of Object.keys(change) as CookingSetting[]) tracker.track('recipe_setting_changed', { setting });
  return result;
}

/**
 * What's in force for a recipe (FR-001): its own settings, else the family's defaults (all on, in
 * metric, until those load). The recipe page, cooking mode and their sheets read this.
 */
export function useCookingSettings(overrides: Partial<RecipeOverrides> | undefined): CookingSettings {
  const { settings } = useFamilySettings();
  const { keepAwake, scale, thermometer, system } = resolveCooking(settings, overrides);
  // The same object while nothing changes, so the screens' views aren't recomputed every render.
  return useMemo(() => ({ keepAwake, scale, thermometer, system }), [keepAwake, scale, thermometer, system]);
}
