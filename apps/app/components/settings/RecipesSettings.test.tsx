// Spec 027 (design/ui/OC-SettingsRecipes.md): the family's cooking defaults. US1: turning off "I have
// a thermometer" saves it for the whole family; the recipes that follow it are in
// lib/recipe-settings.integration.test.ts and RecipePage.test.tsx.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DEFAULT_FAMILY_SETTINGS, type FamilySettings } from '@cocon/schemas';
import { fakeTracker } from '../../test/fakes';
import { RecipesSettings } from './RecipesSettings';

afterEach(cleanup);

function setup(settings: FamilySettings = DEFAULT_FAMILY_SETTINGS, result: 'saved' | 'failed' = 'saved', readOnly = false) {
  const onChange = vi.fn(async () => result);
  const onBack = vi.fn();
  render(<RecipesSettings settings={settings} onChange={onChange} onBack={onBack} tracker={fakeTracker()} readOnly={readOnly} />);
  return { onChange, onBack };
}

const press = async (role: 'switch' | 'button', name: string) => {
  await act(async () => {
    fireEvent.click(screen.getByRole(role, { name }));
  });
};

describe('Recipes settings (OC-SettingsRecipes)', () => {
  it('reads like the screen: back to Settings, title, lead, and the Cooking defaults card', () => {
    const { onBack } = setup();
    fireEvent.click(screen.getByRole('link', { name: 'Settings' }));
    expect(onBack).toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Recipes' })).toBeTruthy();
    expect(screen.getByText('Used for every recipe, for the whole family. Each recipe can change them in its own settings.')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Cooking defaults' })).toBeTruthy();
    for (const [name, hint] of [
      ['Keep screen on while cooking', "So it doesn't lock with floury hands"],
      ['I have a kitchen scale', 'Off: shows cups and spoons instead of grams'],
      ['I have a thermometer', 'Off: hides temperature checks in steps'],
    ]) {
      expect(screen.getByRole('switch', { name }).getAttribute('aria-checked')).toBe('true');
      expect(screen.getByText(hint as string)).toBeTruthy();
    }
    expect(screen.getByText('Units')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Metric · g, ml, °C' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Imperial · oz, °F' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('US1: turning off "I have a thermometer" saves it for the whole family', async () => {
    const { onChange } = setup();
    await press('switch', 'I have a thermometer');
    expect(onChange).toHaveBeenCalledWith({ has_thermometer: false });
  });

  it('each setting saves at once: screen, scale and units', async () => {
    const { onChange } = setup();
    await press('switch', 'Keep screen on while cooking');
    await press('switch', 'I have a kitchen scale');
    await press('button', 'Imperial · oz, °F');
    expect(onChange.mock.calls).toEqual([[{ keep_awake: false }], [{ has_scale: false }], [{ units: 'imperial' }]]);
  });

  it('a failed save says so', async () => {
    setup(DEFAULT_FAMILY_SETTINGS, 'failed');
    await press('switch', 'I have a thermometer');
    expect(screen.getByText("Couldn't save. Try again.")).toBeTruthy();
  });

  it('offline, the settings show but cannot change', async () => {
    const { onChange } = setup(DEFAULT_FAMILY_SETTINGS, 'saved', true);
    await press('switch', 'I have a thermometer');
    expect(onChange).not.toHaveBeenCalled();
  });
});
