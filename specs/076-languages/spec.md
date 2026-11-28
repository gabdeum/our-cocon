# 076 — The app in French and Spanish

**Status:** Ready to build
**Depends on:** every built screen spec (all copy is in `apps/app/strings/en.ts`), 046–049 (notifications), 056–060 (reminders)
**Updates:** constitution (Language rule), README decision 1

## Summary
Every screen, sheet, toast, date, amount and notification can be shown in English, French or Spanish. Each person picks a language in Menu › Language, or leaves it on Automatic to follow the device or browser. English stays the source copy that matches `design/`; French and Spanish translate it. Typed content (recipe text, item names, notes) is never translated. MCP tool text stays English: the assistant translates for the person.

## Functional requirements
### Strings
- **FR-001** `apps/app/strings/en.ts` stays the source. `fr.ts` and `es.ts` are typed `Strings` (the shape of `en`, with strings widened), so a missing key or a function with different arguments fails the type check.
- **FR-002** Screens import `strings` from `apps/app/strings` (not `strings/en`). `setLanguage(lang)` copies the chosen language into the same nested objects, so module-level aliases such as `const m = strings.menu` follow the language. The root layout re-renders the whole tree when the language changes; no reload needed.
- **FR-003** Plurals and lists are functions per language (French counts 0 as singular; "James, Lou et Mia", "James, Lou y Mia").
- **FR-004** A parity test checks: same keys and function arities in every language, every function returns text for sample arguments, and no French or Spanish value equals its English one except an allow-list (brand, unit symbols…).

### Choosing the language
- **FR-005** `members.language`: `automatic` (default), `en`, `fr`, `es`. Per person, synced across devices, readable and writable by that member only (same RLS as the member's own row).
- **FR-006** Menu › Settings gets a **Language** page: Automatic (shows the device language in brackets), English, Français, Español. Each language name is written in its own language. Changing it applies at once.
- **FR-007** Automatic = the device or browser language (`Intl.DateTimeFormat().resolvedOptions().locale`); anything other than fr or es falls back to English. Before sign-in (Welcome, join links, OAuth consent) and on public share pages, the device or browser language applies. On web, `<html lang>` follows.

### Dates, times, amounts
- **FR-008** `@cocon/calendar` words come per language (`words.fr.ts`, `words.es.ts`); its label functions take the words as an argument (English by default, which the MCP server keeps). Day and month order per language: "Sat 28 Nov", "sam. 28 nov.", "sáb 28 nov".
- **FR-009** Times follow the existing time-format setting ("14:30" in every language, which also keeps calendar titles fitting); 12-hour labels use the language's AM/PM words.
- **FR-010** `@cocon/quantity` display words come per language: unit names and plurals, "a pinch of", "about", "of", size words, and the decimal separator ("1,5 kg" in French and Spanish).
- **FR-011** Sorting by name (cuisines, grocery items) uses the current language.

### Outside the app screens
- **FR-012** Push notifications (reminders and event reminders) are written in the recipient's language: their `members.language`, else (Automatic) the language the device registered with (`push_devices.prefs.lang`), else English.
- **FR-013** The sign-in email has French and Spanish versions, picked from the language sent with the sign-in request and stored in the account's metadata.
- **FR-014** Error text coming from the database is never shown as is; the app maps it to a string.
- **FR-015** iPhone system text (the alarm permission) is localized through `app.json` `locales`. This part needs a new build (`pnpm release:ios`). The Live Activity intents are hidden from Shortcuts (`isDiscoverable = false`), so their titles are never shown.
- **FR-016** Dev pages (`/dev/*`) stay English.

### Keeping it easy
- **FR-017** CLAUDE.md and a `translate` skill describe how to add strings in every language and how to add a new language.

## Success criteria
- **SC-001** With French chosen, no English word shows on any screen, sheet, toast, empty state or error, except brand names and typed content.
- **SC-002** Switching language in Menu changes every visible word within one second, without a reload, and survives a restart and another device.
- **SC-003** A reminder push reaches a French-speaking member in French while English speakers in the same family get English.
- **SC-004** Every existing test still passes with English as the default.

## Tracking (PostHog)
| Event | Properties | When |
|---|---|---|
| `language_changed` | `language` (automatic, en, fr, es) | After the setting saves |

`settings_row_opened` gains the row `language`. Super property `language` (the language in use: en, fr, es), sent with every event like `layout_tier`.

## Warnings and errors
- Saving the language fails: keep the new language on this device, show "Couldn't save. Try again." and retry on the next start (`language_changed` is sent only once it saves).

## Needs your attention (defaults chosen)
- French addresses people as "vous", Spanish as "tú".
- "Our Cocon" is not translated.
- The Language page sits under Menu › Settings, after Notifications.
- The sign-in email's subject on staging and prod is in `infra/supabase/cocon.override.yml` (infra version 13): run the bootstrap after merging.
- AI assistants' menu names (Claude, ChatGPT, Gemini) in Menu › AI assistants › Connect stay in English inside the steps, since their French and Spanish labels weren't checked.
- Words after typed text are masculine where French or Spanish would need agreement (L172).
- The Language row uses the speech-bubble icon (no globe icon in the set).

## Changelog
- 2026-11-28 — First version.
- 2026-11-28 — Built. Deviations: French times stay "14:30" (FR-009, keeps titles fitting); the Live Activity intents need no translation (hidden from Shortcuts); errors from the database were already mapped to codes (FR-014, no change). Piece sizes in French and Spanish read after the noun in brackets ("2 œufs (gros)"), avoiding agreement. The screens redraw on a change (a remount of the navigation), so an open sheet closes.
- 2026-11-28 — Review: the language is a super property rather than a person property (the tracker has no person properties; same as the layout tier). `app.json` also sets `CFBundleAllowMixedLocalizations`. Piece sizes read "petit format" / "tamaño pequeño", which agree with any noun.
