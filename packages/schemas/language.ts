import { z } from 'zod';

/** Spec 076: the languages the app speaks. English is the source. */
export const AppLanguage = z.enum(['en', 'fr', 'es']);
export type AppLanguage = z.infer<typeof AppLanguage>;

/** FR-005: a person's setting (`members.language`); Automatic follows the device or browser. */
export const LanguageSetting = z.enum(['automatic', ...AppLanguage.options]);
export type LanguageSetting = z.infer<typeof LanguageSetting>;

/** FR-007: "fr-CA" → fr; anything the app doesn't speak → English. */
export function languageOf(locale: string | null | undefined): AppLanguage {
  const code = (locale ?? '').toLowerCase().split(/[-_]/)[0];
  return AppLanguage.safeParse(code).data ?? 'en';
}

/** The language in use: the setting, or the device's on Automatic. */
export const resolveLanguage = (setting: LanguageSetting, deviceLocale: string | null | undefined): AppLanguage =>
  setting === 'automatic' ? languageOf(deviceLocale) : setting;
