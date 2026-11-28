# 077 — Translations and catalog editor (`pnpm translations`)

**Status:** Ready to build
**Depends on:** 076 (languages), 078 (catalog languages)

## Summary
A page on Gabriel's Mac, opened with `pnpm translations`, that lists every string in every language, grouped by theme, with search. Translations can be edited in place and are written straight into the repo files. A second section edits the ingredient catalog: every field of every item, and new items.

## Functional requirements
### Strings
- **FR-001** `pnpm translations` starts a local server on 127.0.0.1 only and opens the page. It reads `apps/app/strings/{en,fr,es}.ts`, the package word files and `data/catalog/ingredients.json` by parsing them, never by running them.
- **FR-002** Themes are set in `scripts/translations/themes.ts` (top-level key → theme): Getting started, Home & activity, Recipes, Cooking & timers, Groceries, Calendar, Reminders, Notes, Settings, Sharing, AI assistants, Notifications, Dates & units, General. A test fails when a top-level key has no theme.
- **FR-003** The page shows the themes with counts, a search box (key and every language), and filters "Missing" and "Same as English". Each row: key, the design-file comment, English (read only), then one editable box per other language.
- **FR-004** Function entries (plurals, names inside text) are shown and edited as code, with a hint.
- **FR-005** A change saves when the box loses focus: only that value's text is replaced in the file, the file must still parse and type check, and the row shows ✓ or the error (the file is left untouched on error). Nothing is committed.

### Ingredient catalog
- **FR-006** A Catalog section lists every item, with search across keys, names and synonyms in every language, and filters by aisle, "missing a translation" and "no sizes".
- **FR-007** Every field can be edited: names (singular, plural) and synonyms per language, aisle, density, piece sizes and default size, piece nouns per language, whole only, diet flags, packs per store profile (size, unit, label per language, loose; add, reorder, remove), source.
- **FR-008** New items can be added. The key is suggested from the English name and locks once saved; renaming means adding a synonym. Items can't be removed (recipes and lists point at them).
- **FR-009** Each save validates the whole file with `CatalogFile` and checks that no name is used by two items in the same language; errors show on the field and nothing is written.
- **FR-010** The file keeps its order and format, so `git diff` shows only the change. A "Build catalog migration" button runs `pnpm catalog` and shows how to apply it locally.

## Success criteria
- **SC-001** Editing one French string changes exactly one line in `git diff`, and the app shows it after a reload.
- **SC-002** A broken function entry is refused with the error shown, and the file stays as it was.
- **SC-003** A new catalog item added on the page is suggested in the app after building and applying the migration.

## Tracking (PostHog)
None (local developer tool).

## Warnings and errors
- Save refused: the row shows the parser, type or catalog error in plain words.
- Port in use: the command says so and suggests closing the other `pnpm translations`.

## Needs your attention (defaults chosen)
- The page is local only, not published anywhere.

## Changelog
- 2026-11-28 — First version.
