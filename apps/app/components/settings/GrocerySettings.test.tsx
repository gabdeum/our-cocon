// Spec 021 US2 and US3 in Settings › Groceries: where the family shops, and round up to store sizes.
// The Groceries rows that follow these settings are tested in GroceryList.test.tsx.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { pickPacks } from '@cocon/quantity';
import { facts, packsOf } from '@cocon/quantity/catalog.fixture';
import type { FamilySettings } from '@cocon/schemas';
import { strings } from '../../strings/en';
import { buyText } from '../../lib/groceries';
import { flush } from '../../test/fakes';
import { GrocerySettings } from './GrocerySettings';

afterEach(cleanup);

function setup(settings: FamilySettings = { store_profile: 'us', round_to_packs: true }, result: 'saved' | 'failed' = 'saved', readOnly = false) {
  const onChange = vi.fn(async () => result);
  const view = render(<GrocerySettings settings={settings} onChange={onChange} readOnly={readOnly} />);
  return { onChange, rerender: (next: FamilySettings) => view.rerender(<GrocerySettings settings={next} onChange={onChange} readOnly={readOnly} />) };
}

describe('Settings › Groceries', () => {
  it('shows where the family shops, with an example', () => {
    setup();
    expect(screen.getByRole('heading', { name: 'Groceries' })).toBeTruthy();
    expect(screen.getByText('Where do you shop?')).toBeTruthy();
    expect(screen.getByText('So the list shows packs you can actually buy')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'US stores' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('300 ml cream')).toBeTruthy();
    expect(screen.getByText('Buy 1 pint')).toBeTruthy();
    expect(screen.getByRole('switch', { name: 'Round up to store sizes' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText('Off: the list shows only what recipes need')).toBeTruthy();
  });

  it('US2: picking European stores saves it for the family, and the example follows', async () => {
    const { onChange, rerender } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'European stores' }));
    await flush();
    expect(onChange).toHaveBeenCalledWith({ store_profile: 'eu' });
    rerender({ store_profile: 'eu', round_to_packs: true });
    expect(screen.getByText('Buy 2 × 20 cl')).toBeTruthy();
  });

  it('US3: turns round-up off', async () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByRole('switch', { name: 'Round up to store sizes' }));
    await flush();
    expect(onChange).toHaveBeenCalledWith({ round_to_packs: false });
  });

  it('says so when a change could not be saved', async () => {
    setup(undefined, 'failed');
    fireEvent.click(screen.getByRole('button', { name: 'European stores' }));
    await flush();
    expect(screen.getByText("Couldn't save. Try again.")).toBeTruthy();
  });

  it('offline: shows the settings, can not change them', async () => {
    const { onChange } = setup(undefined, 'saved', true);
    fireEvent.click(screen.getByRole('button', { name: 'European stores' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Round up to store sizes' }));
    await flush();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('the example agrees with what the list would buy for 300 ml of cream', () => {
    const buy = (profile: 'us' | 'eu') => {
      const plan = pickPacks({ quantity: 300, unit: 'ml' }, packsOf('heavy_cream', profile), facts('heavy_cream'), profile);
      return plan ? buyText(plan) : null;
    };
    // The US example shortens the catalog's "1 pint carton" (OC-Settings copy).
    expect(buy('us')).toBe('Buy 1 pint carton');
    expect(buy('us')?.startsWith(strings.settings.groceries.exampleBuy.us)).toBe(true);
    expect(buy('eu')).toBe(strings.settings.groceries.exampleBuy.eu);
  });
});
