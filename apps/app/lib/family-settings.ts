import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DEFAULT_FAMILY_SETTINGS, FamilySettings, FamilySettingsUpdate, type Tracker } from '@cocon/schemas';
import { useSession } from './session';
import type { Client } from './supabase';
import { optimisticWrite } from './write';

/**
 * The family's settings (spec 021; 027 adds the cooking defaults). The key starts with the table's
 * name, so a change on anyone's phone refetches it (lib/sync.tsx) and every list updates.
 */
export const familySettingsKey = (familyId: string) => ['family_settings', familyId] as const;

/** The family's row (RLS returns only its own), or the defaults when nobody has changed anything. */
export async function loadFamilySettings(client: Pick<Client, 'from'>): Promise<FamilySettings> {
  const { data, error } = await client.from('family_settings').select('store_profile, round_to_packs').maybeSingle();
  if (error) throw error;
  return data ? FamilySettings.parse(data) : DEFAULT_FAMILY_SETTINGS;
}

/** Saves a change for the whole family (upsert: the first change makes the row). */
export async function saveFamilySettings(client: Pick<Client, 'from'>, familyId: string, change: FamilySettingsUpdate): Promise<{ error: unknown }> {
  const valid = FamilySettingsUpdate.safeParse(change);
  if (!valid.success) return { error: valid.error };
  const { error } = await client.from('family_settings').upsert({ ...valid.data, family_id: familyId }, { onConflict: 'family_id' });
  return { error };
}

/**
 * Shown at once and saved; reverts on failure. A new store profile is tracked (spec 021), from
 * Settings or the Groceries toggle alike.
 */
export async function changeFamilySettings(
  deps: { queryClient: ReturnType<typeof useQueryClient>; client: Pick<Client, 'from'>; tracker: Tracker; familyId: string; current: FamilySettings },
  change: FamilySettingsUpdate,
): Promise<'saved' | 'failed'> {
  const { queryClient, client, tracker, familyId, current } = deps;
  const result = await optimisticWrite<FamilySettings>(
    queryClient,
    familySettingsKey(familyId),
    (s) => ({ ...(s ?? current), ...change }),
    () => saveFamilySettings(client, familyId, change),
  );
  if (result === 'saved' && change.store_profile && change.store_profile !== current.store_profile) {
    tracker.track('store_profile_changed', { profile: change.store_profile });
  }
  return result;
}

/** The family's settings for a screen, and a way to change them. Defaults until loaded. */
export function useFamilySettings() {
  const { state, client, tracker } = useSession();
  const queryClient = useQueryClient();
  const familyId = state.status === 'ready' ? state.family.id : null;
  const query = useQuery({ queryKey: familySettingsKey(familyId ?? ''), queryFn: () => loadFamilySettings(client), enabled: familyId !== null });
  const settings = query.data ?? DEFAULT_FAMILY_SETTINGS;
  const change = (update: FamilySettingsUpdate) =>
    familyId ? changeFamilySettings({ queryClient, client, tracker, familyId, current: settings }, update) : Promise.resolve('failed' as const);
  return { settings, loaded: query.data !== undefined, change };
}
