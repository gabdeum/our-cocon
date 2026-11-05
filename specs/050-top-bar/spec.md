# Feature Specification: One top bar for every pushed screen

**Feature Branch**: `050-top-bar` · **Status**: Built · **Depends on**: 002 (and every built screen listed below)
**Input**: Back and action buttons look different from screen to screen (text links "‹ Menu", "‹ Back", an "✕ Exit" pill, round buttons on the recipe page), and titles sit under the back button, wasting a row. One compact bar everywhere: round buttons with a soft shadow, the title centered between them, pinned to the top while scrolling.
**Design**: `design/system/components/TopBar/README.md`; screens `OC-Recipe`, `OC-RecipeSettings`, `OC-Timers`, `OC-Cook`, `OC-CalEvent`, `OC-CalSurprise`, `OC-CalSettings`, `OC-Connect`, `OC-SettingsFamily`, `OC-SettingsRecipes`, `OC-SettingsGroceries`, `OC-SettingsNotif`.

## User Scenarios & Testing

### User Story 1 — Same back button everywhere (P1)
**Acceptance**: **Given** any pushed screen (recipe, recipe settings, Timers, event detail, every settings page, cooking mode), **Then** the bar is one row: the same 40 px round white button on the left, the page title centered (17/900), round actions on the right. The left button is the same 40 px round white button with a chevron (✕ in cooking mode), at the same place, with the accessible name "Back to {parent}" ("Back to Menu", "Back to Leek & bacon quiche"; "Exit cooking mode").

### User Story 2 — Always reachable (P1)
**Given** a long screen, **When** I scroll, **Then** the bar stays pinned at the top (cream background, so the title stays readable); once content passes under it, a 1.5 px `line` hairline and a soft shadow appear under the bar.

### User Story 3 — Detail screens keep their big title (P1)
**Given** a recipe or an event, **Then** its name is the big heading in the content and the bar shows only buttons; **When** the heading scrolls under the bar, the name fades into the bar's center (200 ms).

## Requirements

- **FR-001 TopBar component** (`@cocon/ui`): sticky, full width, `surface-page` background, padding top = safe-area inset (52 in the drawings) and 8 below, sides 16; a 3-column grid `1fr auto 1fr` so the title is centered on the screen whatever the sides hold. Left: one `IconButton --round` (back chevron 22, or ✕ for cooking mode). Center: title 17/900, one line, ellipsis, max width = screen − 2 × (16 + 104 + 8). Right: up to 2 `IconButton --round` actions, gap 8. Props: `title`, `titleMode` = always | onScroll (detail screens), `actions`.
- **FR-001a**: Settings and list screens (all settings pages, Recipe settings, AI assistants, Timers) use `titleMode="always"` and drop their 28 px page h1; the lead sentence becomes the first line of content. Detail screens (recipe, event, the surprise view) use `onScroll`. Screen readers get one h1 per screen: the bar title, or the content heading on detail screens.
- **FR-002 IconButton `--round`**: 40 × 40 (touch target 44), radius 50%, `surface` white, ink icon 22 (✕ 20), shadow `0 4px 14px rgba(42,36,20,0.18)` (new token `shadow-button`; `shadow-float` stays the timer pill's). Focus ring as other buttons.
- **FR-002a**: Scrolled state (content under the bar): 1.5 px `line` bottom border and shadow `0 6px 14px -10px rgba(42,36,20,0.35)` (new token `shadow-bar`).
- **FR-003**: Replace every text back link ("‹ Menu", "‹ Settings", "‹ Calendar", "‹ Back", "‹ {recipe}") and cooking mode's "✕ Exit" pill with the TopBar. The title goes in the bar (FR-001a); never text beside the back button.
- **FR-004 Out of scope**: tab screens' TopBar (they have no back; FR-007 pins their top instead), bottom sheets and dialogs (they keep their handle / ✕ in the sheet header), and the create/edit forms (Cancel · title · Save stays: it's a modal task, not navigation).
- **FR-006 Event detail (updates spec 042)**: bar actions ✎ "Edit event" and ⋯ "More actions" (menu: Duplicate · Share a view-only link · Delete event in danger color); the bottom Edit / Duplicate / Share / Delete buttons are removed. Content: one meta row (type tag + repeat "Every Saturday"), title 28/900, one line "Sat, Oct 31 · Morning, about 09:00–12:00"; one white card with compact rows (52): who + responsible ("James · Gabriel takes him", car icon), place + soft "Maps" pill, reminder ("1 hour before · reminds Gabriel"); "Bring" card with its count in the header ("1 of 3") and 44 px rows; footer "Added by Eva · 2 days ago · anyone can tick the list". Fits one 390 × 844 screen without scrolling for a typical event. The surprise view (043) uses the same layout.
- **FR-007 Tab screens' pinned top** (Gabriel, 2026-11-05): `TabScreen` takes `pinned` (and `header`, which scrolls away above it). The pinned part sticks under the status bar (safe area, at least 54) and gets FR-002a's hairline and shadow once content is under it. Home: the brand row (mark, "Our Cocon", avatars). Recipes: the search, the title scrolls away; the Filters · In season · Under 30 min row is pinned under it; the "Try “leek” or “quick”" hint and the "In season in {Month}" group are removed. Groceries: the Add row; "Grocery settings" moves to the title's right as a round IconButton. The calendar already pins its header. Cooking mode's "Cooking options" is a round IconButton too.
- **FR-005**: On Android (later) the system back gesture still works; the TopBar is the same.

## Success Criteria
- **SC-001**: Every pushed screen renders the TopBar (snapshot test per route), and no text back link remains (grep test on `strings`/components).
- **SC-002**: On a 390 × 844 screen scrolled to the bottom, the back button is still visible and tappable (integration test).

## Tracking (PostHog)
None new.

## Warnings and errors
None.

## Needs your attention
None.

## Changelog
- 2026-11-02: Ready. From Gabriel's review: one round, sticky, shadowed top bar across screens.
- 2026-11-03: Gabriel's review: title centered in the bar (no row under the back button); detail screens show their name in the bar on scroll; the event detail is redesigned compactly (spec 042 changes listed in FR-006).
- 2026-11-04: Built. `TopBar` and `TopBarHeading` (`@cocon/ui`), drawn by `PushedScreen` and `PhotoScreen` (`topBar` prop) outside the scroll so the bar stays pinned; IconButton `round`; new `ActionMenu` (the event page's ⋯); tokens `shadow-button` and `shadow-bar`; icon `edit`; `Lead` replaces `BackHeader`/`BackLink`, which are gone. Every settings page, Recipe settings, AI assistants, Timers, Recently deleted and Activity use `titleMode="always"`; the recipe page (over its photo), the event page and the surprise view use `onScroll`; cooking mode's Exit pill is a round ✕ "Exit cooking mode". Back labels read "Back to {parent}". FR-006 built: see spec 042 and OC-CalEvent.md › Changelog; IconRow and ChecklistRow gain `compact`. No new analytics events. Deviations:
  - The round button's shadow is `shadow-button`, and the scrolled bar's `shadow-bar`: `shadow-float` already names the timer pill's stronger shadow.
  - The who row reads "James · Gabriel takes James": the app doesn't know anyone's pronouns. The reminder row keeps 049's time ("· reminds Gabriel · 08:00").
  - Timers' back reads "Back" (the drawing: "Back to recipe"): Timers opens from anywhere.
  - The bar's top padding is the safe-area inset, at least 52 (the web has none). The title's maximum width follows the widest side (one button or two), so settings titles get 246 at 390 rather than 214.
  - OC-CalSurprise's drawing only changed its bar, so the surprise view keeps its content (FR-006 says it shares the event's layout; the screen wins on layout).
  - Cooking mode keeps its own header (progress and the options button, as drawn), with the round ✕.
  - The compact card uses `ListGroup inset` (padding 4 16; the drawing 2 14).
  - SC-001 is a grep test (`apps/app/components/top-bar.test.ts`) plus each screen's own test of its "Back to …" button; SC-002 is checked structurally in jsdom (the bar sits outside the scroll and stays after scrolling to the end) and by hand. L125 adds it to Playwright.
  - The screens `OC-Cook`, `OC-Recipe` and `OC-Timers` from the review were drawn on their first versions; they were merged three-way so later changes (Cooking options, Add groceries, quick timers) stay.
- 2026-11-05: Gabriel's review of the build: round buttons 40 with a 22 icon (✕ 20), touch target kept at 44 (were 48 and 20–22); cooking mode's header lines up with the loading state's TopBar (the ✕ jumped when the steps appeared) and its options button is round; FR-007 added (tab screens' pinned top: Home's brand row, Recipes' search, Groceries' Add row). `BrandHeader` split into `BrandRow` and `BrandHeader`; IconButton `--soft-square` removed (no longer used). The screens in `design/screens/` aren't redrawn for these; the UI specs describe them.
