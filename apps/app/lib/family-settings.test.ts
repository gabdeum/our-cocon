// Spec 021: a settings change is shown at once, saved for the family, and `store_profile_changed`
// is sent only when the store really changed and was saved (from Settings or the Groceries toggle).
// Spec 027: `family_default_changed` for each cooking default saved.
import { DEFAULT_FAMILY_SETTINGS } from '@cocon/schemas';
import { describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { fakeTracker } from '../test/fakes';
import { changeFamilySettings, familySettingsKey } from './family-settings';

function setup(error: unknown = null) {
  const queryClient = new QueryClient();
  const upsert = vi.fn(async () => ({ error }));
  const client = { from: vi.fn(() => ({ upsert })) } as never;
  const tracker = fakeTracker();
  const current = { ...DEFAULT_FAMILY_SETTINGS, store_profile: 'us', round_to_packs: true } as const;
  queryClient.setQueryData(familySettingsKey('fam'), current);
  return { deps: { queryClient, client, tracker, familyId: 'fam', current }, upsert, tracker, queryClient };
}

describe('changeFamilySettings', () => {
  it('saves a new store for the family and tracks it', async () => {
    const { deps, upsert, tracker } = setup();
    expect(await changeFamilySettings(deps, { store_profile: 'eu' })).toBe('saved');
    expect(upsert).toHaveBeenCalledWith({ store_profile: 'eu', family_id: 'fam' }, { onConflict: 'family_id' });
    expect(tracker.track).toHaveBeenCalledWith('store_profile_changed', { profile: 'eu' });
  });

  it('does not track round-up, or a store that did not change', async () => {
    const { deps, tracker } = setup();
    await changeFamilySettings(deps, { round_to_packs: false });
    await changeFamilySettings(deps, { store_profile: 'us' });
    expect(tracker.track).not.toHaveBeenCalled();
  });

  it('reverts and does not track a change that failed', async () => {
    const { deps, tracker, queryClient } = setup(new Error('offline'));
    expect(await changeFamilySettings(deps, { store_profile: 'eu' })).toBe('failed');
    expect(queryClient.getQueryData(familySettingsKey('fam'))).toEqual({ ...DEFAULT_FAMILY_SETTINGS, store_profile: 'us', round_to_packs: true });
    expect(tracker.track).not.toHaveBeenCalled();
  });

  it('tracks a cooking default saved for the family (027), and only which one', async () => {
    const { deps, tracker } = setup();
    await changeFamilySettings(deps, { has_thermometer: false });
    expect(tracker.track).toHaveBeenCalledWith('family_default_changed', { setting: 'has_thermometer' });
    await changeFamilySettings(deps, { units: 'metric' });
    expect(tracker.track).toHaveBeenCalledTimes(1);
    const failed = setup(new Error('offline'));
    await changeFamilySettings(failed.deps, { units: 'imperial' });
    expect(failed.tracker.track).not.toHaveBeenCalled();
  });
});
