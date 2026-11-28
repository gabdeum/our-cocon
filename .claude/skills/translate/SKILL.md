---
name: translate
description: Add or change app copy in every language, fix a translation, or add a new language to Our Cocon (spec 076).
---
English (`apps/app/strings/en.ts`) is the source and matches `design/`. French (`fr.ts`) and Spanish (`es.ts`) translate it, typed as `Strings`, so a missing key fails the type check.

## New or changed strings
1. Write the English in `en.ts` (keyed by screen, as the constitution says).
2. Add the same key, with the same function arguments, to every other language file, at the same place.
3. Voice: plain, short, sentence case, verb-first buttons. French says "vous", Spanish "tú". Use terms already in the file: look up the nearest keys in `fr.ts`/`es.ts` (e.g. "Recently deleted" is « Supprimés récemment » / "Eliminados recientemente").
4. Plurals are functions: French counts 0 and 1 as singular (`n < 2`), Spanish only 1. Avoid gender agreement with a name or typed text: put it after a colon or in « »/“ ”.
5. French typography: a non-breaking space (U+00A0) before ? ! : ; and inside « ». Use ’ for apostrophes.
6. Words a package shows go in its word files: `packages/calendar/words.{en,fr,es}.ts`, `packages/quantity/display.{en,fr,es}.ts`, `packages/reminders/words.{en,fr,es}.ts`.
7. Run `pnpm test apps/app/strings` (parity: same keys and arguments, text from every function, nothing left in English).

## Fixing a translation
Edit the value in the language file, or with `pnpm translations` (spec 077) once it exists. Same checks.

## Adding a language (e.g. German)
1. `packages/schemas/language.ts`: add the code to `AppLanguage`.
2. `apps/app/strings/de.ts` typed `Strings` (translate all of `en.ts`, in chunks), and add it to `all` and `languages` in `strings/index.ts`.
3. Word files: `packages/calendar/words.de.ts`, `packages/quantity/display.de.ts`, `packages/reminders/words.de.ts`, each added to its `…ByLanguage` map.
4. A migration: add the code to the `members.language` check and to `_push_prefs_ok`'s `lang` values (`add-table` skill), with a test.
5. `settings.language.names` in every language file: the new language in its own words.
6. The sign-in email: a branch in `apps/app/public/email/sign-in.html` and in the subject (`supabase/config.toml`, `infra/supabase/cocon.override.yml`).
7. `apps/app/locales/de.json` and `app.json` `locales` (iPhone permission text; needs a new build).
8. The ingredient catalog's names for it (spec 078).
