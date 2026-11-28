/** Spec 076: the app's language, for what the system draws (time pickers). English until the app says. */
let language = 'en';

export function setUiLanguage(next: string) {
  language = next;
}

/** "en_GB" for a 24-hour picker in English, "fr_FR" in French; the US region for a 12-hour one. */
export function pickerLocale(use24h: boolean): string {
  if (!use24h) return `${language}_US`;
  return language === 'en' ? 'en_GB' : `${language}_${language.toUpperCase()}`;
}
