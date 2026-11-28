import { createContext, Fragment, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, usePathname, type Href } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { calendarWordsByLanguage, setCalendarWords } from '@cocon/calendar';
import { displayWordsByLanguage, setDisplayWords } from '@cocon/quantity';
import { LanguageSetting, languageOf, resolveLanguage, type AppLanguage } from '@cocon/schemas';
import { setUiLanguage } from '@cocon/ui';
import { getLanguage, setLanguage, strings } from '../strings';
import { useSession } from './session';
import { useToast } from './toast';
import { tracker } from './tracker';

// Spec 076: the language the app is in. Each person's setting (`members.language`), kept on the
// device too so the app opens in it before the family loads; Automatic follows the device.

const STORAGE_KEY = 'cocon.language';
/** Which person and language the account's metadata last got (for the sign-in email). */
const SYNCED_KEY = 'cocon.language.account';
/** A choice the account hasn't saved yet: it wins over the account's, and is sent again on the next start. */
const PENDING_KEY = 'cocon.language.pending';

/** "fr-FR": the browser's language on the web, the phone's on iOS. */
export function deviceLocale(): string {
  try {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.language) return navigator.language;
    return Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    return 'en';
  }
}

/** Every word the app shows, in `language`: its strings, the calendar's, amounts, and the web page's `lang`. */
export function applyLanguage(language: AppLanguage) {
  setLanguage(language);
  setCalendarWords(calendarWordsByLanguage[language]);
  setDisplayWords(displayWordsByLanguage[language]);
  setUiLanguage(language);
  if (Platform.OS === 'web' && typeof document !== 'undefined') document.documentElement.lang = language;
}

// FR-007: before anything renders (Welcome, shared pages), the device's language.
applyLanguage(languageOf(deviceLocale()));

interface LanguageContextValue {
  /** What the person picked. */
  setting: LanguageSetting;
  /** What the app is in. */
  language: AppLanguage;
  /** The device's own, for "Automatic (Français)". */
  deviceLanguage: AppLanguage;
  choose: (setting: LanguageSetting) => void;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

/** Applies the language and redraws `children` when it changes, so every screen reads the new words. */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const { state, api, client, refresh } = useSession();
  const queryClient = useQueryClient();
  const toast = useToast();
  const pathname = usePathname();
  /** Where the person was when they picked: the redraw starts the screens afresh (an iPhone goes back to the first tab). */
  const returnTo = useRef<string | null>(null);
  const [saved, setSaved] = useState<LanguageSetting | null>(null);
  const [picked, setPicked] = useState<LanguageSetting | null>(null);
  const [pending, setPending] = useState<LanguageSetting | null>(null);

  useEffect(() => {
    Promise.all([AsyncStorage.getItem(STORAGE_KEY), AsyncStorage.getItem(PENDING_KEY)])
      .then(([value, unsaved]) => {
        setSaved(LanguageSetting.safeParse(value).data ?? null);
        setPending(LanguageSetting.safeParse(unsaved).data ?? null);
      })
      .catch(() => undefined);
  }, []);

  const member = state.status === 'ready' ? LanguageSetting.catch('automatic').parse(state.me.language) : null;
  const setting = picked ?? pending ?? member ?? saved ?? 'automatic';
  const deviceLanguage = languageOf(deviceLocale());
  const language = resolveLanguage(setting, deviceLocale());
  // During render, so the first frame after a change is already in the new language.
  if (language !== getLanguage()) applyLanguage(language);

  useEffect(() => tracker.register({ language }), [language]);
  useEffect(() => {
    const path = returnTo.current;
    returnTo.current = null;
    if (!path) return;
    // After the redrawn screens have mounted; on the web the address already holds it, so this is a no-op.
    const timer = setTimeout(() => router.navigate(path as Href), 0);
    return () => clearTimeout(timer);
  }, [language]);
  // Keeps the device's copy in step with the account (another device may have changed it).
  useEffect(() => {
    if (member) void AsyncStorage.setItem(STORAGE_KEY, member).catch(() => undefined);
  }, [member]);
  // FR-013: the sign-in email, and (spec 078) the catalog's names, are in the account's last language.
  // Once per change, per person.
  const userId = state.status === 'ready' ? state.userId : null;
  useEffect(() => {
    if (!userId) return;
    const mark = `${userId}:${language}`;
    void AsyncStorage.getItem(SYNCED_KEY)
      .then(async (synced) => {
        if (synced === mark) return;
        const { error } = await client.auth.updateUser({ data: { lang: language } });
        if (error) return;
        await AsyncStorage.setItem(SYNCED_KEY, mark);
        // Spec 078: the catalog's names, piece nouns and pack labels follow the account's language.
        await queryClient.invalidateQueries();
      })
      .catch(() => undefined);
  }, [client, queryClient, userId, language]);

  /** Saves a choice to the account; until it's saved it stays on this device, and wins (spec Warnings). */
  const save = useCallback(
    (next: LanguageSetting) =>
      api.setLanguage(next).then(async (result) => {
        if (!result.ok) return false;
        await AsyncStorage.removeItem(PENDING_KEY).catch(() => undefined);
        await refresh();
        setPending(null);
        setPicked(null);
        tracker.track('language_changed', { language: next });
        return true;
      }),
    [api, refresh],
  );

  // A choice that couldn't be saved last time: sent again once the family has loaded.
  const ready = state.status === 'ready';
  useEffect(() => {
    if (ready && pending && pending !== member) void save(pending);
  }, [ready, pending, member, save]);

  const choose = useCallback(
    (next: LanguageSetting) => {
      returnTo.current = pathname;
      setPicked(next);
      void AsyncStorage.multiSet([
        [STORAGE_KEY, next],
        [PENDING_KEY, next],
      ]).catch(() => undefined);
      void save(next).then((saved) => {
        if (!saved) toast.show({ text: strings.settings.language.saveFailed, tone: 'warn' });
      });
    },
    [save, toast, pathname],
  );

  const value = useMemo(() => ({ setting, language, deviceLanguage, choose }), [setting, language, deviceLanguage, choose]);
  return (
    <LanguageContext.Provider value={value}>
      <Fragment key={language}>{children}</Fragment>
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const value = useContext(LanguageContext);
  if (!value) throw new Error('useLanguage outside LanguageProvider');
  return value;
}
