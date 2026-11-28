// Spec 076: every language the app speaks. `en.ts` is the source; the others translate it.
import { useSyncExternalStore } from 'react';
import { strings as en } from './en';
import { es } from './es';
import { fr } from './fr';
import type { Strings } from './types';

export type { Strings };
export const languages = ['en', 'fr', 'es'] as const;
export type Language = (typeof languages)[number];

const all: Record<Language, Strings> = { en, fr, es };

type Tree = Record<string, unknown> | unknown[];
const isTree = (v: unknown): v is Tree => typeof v === 'object' && v !== null;

function copy<T>(source: T): T {
  if (Array.isArray(source)) return source.map(copy) as T;
  if (isTree(source)) return Object.fromEntries(Object.entries(source).map(([k, v]) => [k, copy(v)])) as T;
  return source;
}

/** Writes `source` into `target`'s own nested objects, so `const m = strings.menu` follows the language. */
function assignInto(target: Tree, source: Tree) {
  for (const [key, value] of Object.entries(source)) {
    const current = (target as Record<string, unknown>)[key];
    if (isTree(value) && isTree(current)) assignInto(current, value);
    else (target as Record<string, unknown>)[key] = copy(value);
  }
}

/** The words in use. Typed as English so screens keep their literal types; the values follow `setLanguage`. */
export const strings: typeof en = copy(en);

let current: Language = 'en';
const listeners = new Set<(language: Language) => void>();

export function setLanguage(language: Language) {
  if (language === current) return;
  assignInto(strings as unknown as Tree, all[language] as unknown as Tree);
  current = language;
  // After the render that may have changed it (LanguageProvider applies it while rendering).
  queueMicrotask(() => {
    for (const listener of listeners) listener(language);
  });
}

/** Re-renders a component when the language changes (one above the screens, which are redrawn anyway). */
export const useLanguageChange = () => useSyncExternalStore(onLanguageChange, getLanguage, getLanguage);

/** For words handed to the system once (notification buttons): hand them over again. Returns the unsubscribe. */
export function onLanguageChange(listener: (language: Language) => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

export const getLanguage = (): Language => current;

/** The words of any language, without switching (notifications for someone else, tests). */
export const stringsFor = (language: Language): Strings => all[language];
