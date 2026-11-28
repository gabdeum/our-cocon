import { describe, expect, it } from 'vitest';
import { languageOf, resolveLanguage } from './language';

describe('languageOf', () => {
  it.each([
    ['fr-FR', 'fr'],
    ['fr_CA', 'fr'],
    ['es-419', 'es'],
    ['en-GB', 'en'],
    ['de-DE', 'en'],
    ['', 'en'],
    [null, 'en'],
  ])('%s → %s', (locale, language) => expect(languageOf(locale)).toBe(language));
});

describe('resolveLanguage', () => {
  it('follows the device on Automatic', () => expect(resolveLanguage('automatic', 'es-MX')).toBe('es'));
  it('keeps a chosen language whatever the device', () => expect(resolveLanguage('fr', 'es-MX')).toBe('fr'));
});
