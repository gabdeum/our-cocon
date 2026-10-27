import { DEFAULT_FAMILY_SETTINGS, FamilySettings } from '@cocon/schemas';
import type { Db } from './client';

/** The family's settings (specs 021 and 027): its row (RLS returns only its own), or the defaults when nobody has changed anything. */
export async function loadFamilySettings(client: Pick<Db, 'from'>): Promise<FamilySettings> {
  const { data, error } = await client.from('family_settings').select('store_profile, round_to_packs, keep_awake, has_scale, has_thermometer, units').maybeSingle();
  if (error) throw error;
  return data ? FamilySettings.parse(data) : DEFAULT_FAMILY_SETTINGS;
}
