// Spec 027: a recipe's own setting is shown at once and saved, Reset sends null, and
// `recipe_setting_changed` says only which setting, once it's saved.
import { describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { fakeTracker } from '../test/fakes';
import { quicheDetail } from '../test/quiche-detail';
import { recipeKey } from './recipe';
import { changeRecipeOverrides } from './recipe-settings';

function setup(error: unknown = null) {
  const queryClient = new QueryClient();
  const eq = vi.fn(async () => ({ error }));
  const update = vi.fn(() => ({ eq }));
  const client = { from: vi.fn(() => ({ update })) } as never;
  const tracker = fakeTracker();
  queryClient.setQueryData(recipeKey('fam', quicheDetail.id), quicheDetail);
  return { deps: { queryClient, client, tracker, familyId: 'fam', recipeId: quicheDetail.id }, update, eq, tracker, queryClient };
}

describe('changeRecipeOverrides', () => {
  it('saves the recipe’s own setting and tracks which one', async () => {
    const { deps, update, eq, tracker } = setup();
    expect(await changeRecipeOverrides(deps, { has_thermometer: true })).toBe('saved');
    expect(update).toHaveBeenCalledWith({ has_thermometer: true });
    expect(eq).toHaveBeenCalledWith('id', quicheDetail.id);
    expect(tracker.track).toHaveBeenCalledWith('recipe_setting_changed', { setting: 'has_thermometer' });
  });

  it('Reset sends null', async () => {
    const { deps, update } = setup();
    await changeRecipeOverrides(deps, { units: null });
    expect(update).toHaveBeenCalledWith({ units: null });
  });

  it('reverts and does not track a change that failed', async () => {
    const { deps, tracker, queryClient } = setup(new Error('offline'));
    expect(await changeRecipeOverrides(deps, { units: 'imperial' })).toBe('failed');
    expect(queryClient.getQueryData<typeof quicheDetail>(recipeKey('fam', quicheDetail.id))?.overrides.units).toBeNull();
    expect(tracker.track).not.toHaveBeenCalled();
  });

  it('refuses anything that isn’t a cooking setting', async () => {
    const { deps, update } = setup();
    expect(await changeRecipeOverrides(deps, { name: 'x' } as never)).toBe('failed');
    expect(update).not.toHaveBeenCalled();
  });
});
