# Feature Specification: Menu tab (apps and settings) and the settings pages

**Feature Branch**: `029-settings-screen` · **Status**: Ready · **Depends on**: 018, 021, 025, 027, 033, 034, 036
**Input**: The Menu tab replaces the Settings screen. It has two sections: **Apps**, a directory of every part of the app (Calendar, Recipes, Groceries for now; later, parts that have no tab), and **Settings**, with one page each for the family, AI assistants, and each app (Calendar, Recipes, Groceries).
**Design**: `design/ui/OC-Menu.md`, `OC-SettingsFamily.md`, `OC-SettingsRecipes.md`, `OC-SettingsGroceries.md`, `OC-CalSettings.md`, `OC-Connect.md`; screens `OC-Menu`, `OC-SettingsFamily`, `OC-SettingsRecipes`, `OC-SettingsGroceries`, `OC-CalSettings`; components ScreenHeader, ListRow (with icon tile), AppTile (new), SettingRow (switch), SegmentedControl, Avatar, Button (dashed), ColorSwatch, BottomSheet, Dialog, TabBar.

## User Scenarios & Testing

### User Story 1 — Get anywhere from the Menu (P1)
**Acceptance**: **Given** the Menu tab, **Then** it shows the title "Menu", then **Apps** (tiles Calendar "3 today", Recipes "48 recipes", Groceries "7 to buy"), then **Settings**: Family, AI assistants; Calendar, Recipes, Groceries; Recently deleted. **When** I tap the Recipes tile, **Then** the Recipes tab opens and is selected in the tab bar.

### User Story 2 — Each app's settings on its own page (P1)
**Given** Menu › Settings › Groceries, **Then** I see "Where do you shop?" (US · Europe, with its example) and "Round up to store sizes"; changing them here or in the Groceries tab's "Grocery settings" sheet changes the same family settings.

### User Story 3 — Family and my account in one place (P1)
**Given** Menu › Family, **Then** I see the members, "+ Invite someone", "+ Add without app", and Your account (Your name, Sign out, Delete my account).

### User Story 4 — Understand every option (P1)
**Given** any setting, **Then** a one-line hint says what it does ("Off: shows cups and spoons instead of grams").

### User Story 5 — Make the calendar mine (P1)
**Given** Menu › Calendar, **When** Gabriel sets "Opens on: Agenda", **Then** the Calendar tab opens on Agenda for him only.

### User Story 6 — Family times of day (P2)
**Given** the owner, **When** Gabriel changes Evening to 18:30–22:00, **Then** new Evening events use it for the whole family; existing events keep their times.

### Edge cases
- A future app with no tab (Timers, 032 L20, if Gabriel decides so) is added as one more tile in Apps; the grid wraps to new rows of three.
- Offline: settings show their saved values and controls are disabled (SegmentedControl `disabled`, spec 021), with the app's usual offline banner.

## Requirements

- **FR-001 Routes**: Menu `/menu` (the tab's root). Settings pages are pushed screens: `/settings/family`, `/settings/ai` (spec 025), `/settings/calendar`, `/settings/recipes` (built in spec 027), `/settings/groceries`, `/settings/deleted` (spec 018). The old `/settings` redirects to `/menu`. Every settings page has the back link "Menu".
- **FR-002 Apps**: a 3-column grid of AppTile links (white, radius 22, icon tile 44 on `surface-soft`, name 16/900, live detail 13/700 ink-muted): Calendar "{n} today" (or "Nothing today"), Recipes "{n} recipes", Groceries "{n} to buy" (or "All done"). Tapping a tile switches to that tab. The list of apps is data (`APPS` in `@cocon/ui` or the app shell), so a new app is one entry.
- **FR-003 Settings**: three white cards: (1) Family "{names} · your account" › and AI assistants "{n} connected" › (or "Not connected"); (2) Calendar "Your view, colors, times of day" ›, Recipes "Cooking defaults, units" ›, Groceries "Where you shop, store sizes" ›; (3) Recently deleted "{n} item(s)" › (counts recipes and events). Rows are ListRows with a 36 px icon tile.
- **FR-004 Family page** (`/settings/family`): Members (avatar in member color, name, "Has the app" / "Added by {name}", role "Owner" / "Can edit" / "No account"); "+ Invite someone" and "+ Add without app" side by side, with the hint (spec 033 owns the sheets and rules). **Your account**: "Your name ›" (shows the name), "Sign out" (olive link row); below the card, danger link "Delete my account" → Dialog. Only the owner sees member role controls and "Delete family".
- **FR-005 Recipes page** (`/settings/recipes`, built in spec 027): Cooking defaults — keep screen on, kitchen scale, thermometer, Units.
- **FR-006 Groceries page** (`/settings/groceries`): the same two family settings as the Groceries tab's "Grocery settings" sheet (spec 021) — "Where do you shop?" US · Europe with the example "Recipe needs 300 ml cream → Buy 1 pint" / "→ Buy 2 × 20 cl", and "Round up to store sizes". The sheet stays as a shortcut.
- **FR-007 Calendar page** (`/settings/calendar`) — **For you**: Opens on (Month default · Week · Day · Agenda); Week starts on (Automatic = device region · Sunday · Monday); Time format (Automatic · 24-hour · 12-hour); Show birthdays (on; "Also on Home, 3 days ahead"); Fade past days (on; "So today and what's next stand out").
- **FR-008 My color**: 4×2 ColorSwatch grid of the member palette (spec 033); mine has a ring; taken swatches show the owner's initial and can't be picked; names "Sky, taken" / "Lilac, free" / "Honey, your color".
- **FR-009 Times of day** (family; owner edits, others see "Only {owner}, the family owner, can change them." and no chevrons): five rows with hours; a slot's end must equal the next one's start.
- **FR-010 Calendar › Family**: "Home time zone" row (spec 034 FR-008) and "AI assistants" row → `/settings/ai`.
- **FR-011**: Changes save instantly, with no Save button. Family settings sync to all members; "For you" calendar settings are per member.
- **FR-013 Account deletion** (032-later L71): "Delete my account" works for a member who joined by invite: point every `created_by` / `updated_by` column that references `auth.users` at `on delete set null` (or a "Former member" placeholder), and test deleting the account of a member who joined.
- **FR-012 Copy that names the old screen**: "Settings › AI assistants" in AI refusals (specs 023, 024) becomes "Menu › AI assistants"; "Your family defaults are in Settings." on recipe settings (spec 027) becomes "Your family defaults are in Menu › Recipes."

## Success Criteria
- **SC-001**: Every tile and row opens the right screen (integration test per row), and every settings page's back link returns to Menu.
- **SC-002**: A calendar preference changed by Eva never changes Gabriel's view.
- **SC-004**: A member who joined by invite can delete their account; their recipes and events stay, shown as by "Former member" (test).
- **SC-003**: A grocery setting changed on the Groceries page shows in the Grocery settings sheet, and the other way round (test).

## Tracking (PostHog)
| Event | Properties |
| --- | --- |
| `menu_app_opened` | app (calendar, recipes, groceries) |
| `settings_row_opened` | row (family, ai, calendar, recipes, groceries, deleted) |
| `signed_out` | — |
| `calendar_settings_changed` | setting, value |

## Warnings and errors
All copy is in the States tables of `design/ui/OC-Menu.md`, `OC-SettingsFamily.md`, `OC-SettingsRecipes.md`, `OC-SettingsGroceries.md` and `OC-CalSettings.md`. Overlapping slot times: "Times can't overlap. Evening has to start when Afternoon ends."

## Needs your attention
None.

## Changelog
- 2026-10-13: Ready. Decisions 1–34 applied; tracking added.
- 2026-10-22 (from spec 021): Gabriel moved the Groceries section (where you shop, round up) to a sheet on the Groceries tab; FR-002 and the acceptance order updated.
- 2026-10-26: Reworked for all modules: opened from the Menu tab (spec 036); Calendar settings screen merged in (from the calendar brief); Family shows members without the app (spec 033); Recently deleted counts events; Account section now drawn. Builds after the calendar specs.
- 2026-10-26 (later): Gabriel's direction: Settings becomes **Menu** with two sections, Apps (a directory of every part of the app) and Settings (Family, AI assistants, then one page per app). Cooking defaults move to their own Recipes page (built in 027), the grocery settings get a Groceries page (the Groceries tab's sheet stays), Account moves into the Family page. Routes `/menu` and `/settings/*`; new event `menu_app_opened`.
- 2026-10-26 (later): Does 032-later L71 (FR-013): account deletion fails today for members who joined by invite.
