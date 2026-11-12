import { DEFAULT_FAMILY_SETTINGS, FamilySettings, MemberRecipeSettings, UnitSystem } from '@cocon/schemas';
import type { Db } from './client';

/** The family's settings (specs 021 and 027): its row (RLS returns only its own), or the defaults when nobody has changed anything. */
export async function loadFamilySettings(client: Pick<Db, 'from'>): Promise<FamilySettings> {
  const { data, error } = await client.from('family_settings').select('store_profile, round_to_packs, keep_awake, has_scale, has_thermometer, units').maybeSingle();
  if (error) throw error;
  return data ? FamilySettings.parse(data) : DEFAULT_FAMILY_SETTINGS;
}

/** Spec 051: the signed-in member's own units (RLS returns only their row), or none picked yet. */
export async function loadMyRecipeSettings(client: Pick<Db, 'from'>): Promise<MemberRecipeSettings> {
  const { data, error } = await client.from('member_recipe_settings').select('units').maybeSingle();
  if (error) throw error;
  return data ? MemberRecipeSettings.parse(data) : { units: null };
}

/** Spec 051: saves the member's own units (Menu › Recipes › For you). */
export async function saveMyUnits(client: Pick<Db, 'from'>, familyId: string, units: UnitSystem): Promise<{ error: unknown }> {
  const { error } = await client
    .from('member_recipe_settings')
    .upsert({ family_id: familyId, units: UnitSystem.parse(units) }, { onConflict: 'family_id,user_id' });
  return { error };
}
