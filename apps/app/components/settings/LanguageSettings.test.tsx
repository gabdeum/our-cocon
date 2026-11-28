// Spec 076 FR-006: Menu › Language. Automatic names the device's language; each language is named
// in its own words; a choice applies at once.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { render } from '../../test/render';
import { expectAccessible } from '../../test/axe';
import { LanguageSettings } from './LanguageSettings';

afterEach(cleanup);

function setup(setting: 'automatic' | 'en' | 'fr' | 'es' = 'automatic') {
  const onChoose = vi.fn();
  const onBack = vi.fn();
  render(<LanguageSettings setting={setting} deviceLanguage="fr" onChoose={onChoose} onBack={onBack} />);
  return { onChoose, onBack };
}

describe('Language settings', () => {
  it('offers Automatic with the device language, then each language in its own words', async () => {
    setup();
    expect(screen.getByRole('heading', { name: 'Language' })).toBeTruthy();
    expect(screen.getAllByRole('radio').map((r) => r.getAttribute('aria-label'))).toEqual(['Automatic (Français)', 'English', 'Français', 'Español']);
    expect(screen.getByRole('radio', { name: 'Automatic (Français)' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText('Recipes, lists and notes stay as they were written.')).toBeTruthy();
    await expectAccessible();
  });

  it('picks a language, and goes back to the Menu', () => {
    const { onChoose, onBack } = setup('en');
    fireEvent.click(screen.getByRole('radio', { name: 'Español' }));
    expect(onChoose).toHaveBeenCalledWith('es');
    fireEvent.click(screen.getByRole('button', { name: 'Back to Menu' }));
    expect(onBack).toHaveBeenCalled();
  });
});
