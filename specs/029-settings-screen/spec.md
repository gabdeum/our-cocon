# Feature Specification: Settings screen

**Feature Branch**: `029-settings-screen` · **Status**: Ready · **Depends on**: 021, 025, 027
**Input**: One place for cooking defaults, grocery store, family, AI assistants and Recently deleted.
**Design**: canvas `OC-Settings`; components ScreenHeader, Switch rows, SegmentedControl, ListRow, Avatar, Button (dashed), TabBar.

## User Scenarios & Testing

### User Story 1 — Find any setting in one screen (P1)
**Acceptance**: **Given** the Settings tab, **Then** I see, in order: Cooking defaults (spec 027), Family (spec 003), More: AI assistants "2 connected ›" (spec 025) and Recently deleted "1 recipe ›" (spec 018).

### User Story 2 — Understand every option (P1)
**Given** any setting, **Then** a one-line hint says what it does ("Off: shows cups and spoons instead of grams").

## Requirements

- **FR-001**: Changes save instantly, with no Save button, and sync to all family members (family-level settings).
- **FR-002**: Settings has no Groceries section: "Where do you shop?" and "Round up to store sizes" live in the Groceries tab's "Grocery settings" sheet (moved there by spec 021).
- **FR-003**: An Account section at the bottom, built from existing components as `design/ui/OC-Settings.md` describes: "Your name", "Sign out", "Delete my account".
- **FR-004**: Only the owner sees member role controls and "Delete family".

## Success Criteria
- **SC-001**: Every row opens or changes the right thing (integration test per row).

## Tracking (PostHog)
| Event | Properties |
| --- | --- |
| `settings_row_opened` | row |
| `signed_out` | — |

## Warnings and errors
All copy is in the States tables of the UI specs for: OC-Settings. New messages go there and in `strings/en.ts` first.

## Needs your attention
None.

## Changelog
- 2026-10-13: Ready. Decisions 1–34 applied; tracking added.
- 2026-10-22 (from spec 021): Gabriel moved the Groceries section (where you shop, round up) to a sheet on the Groceries tab; FR-002 and the acceptance order updated.
