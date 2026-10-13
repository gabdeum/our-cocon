# Feature Specification: Delete and Recently deleted

**Feature Branch**: `018-delete-recently-deleted` · **Status**: Ready · **Depends on**: 014
**Input**: Safe recipe deletion with a 30-day way back.
**Design**: canvas `OC-Delete`, `OC-Settings` (Recently deleted row); components Dialog, ListRow, Button.

## User Scenarios & Testing

### User Story 1 — Delete a recipe (P1)
**Acceptance**: **Given** the edit form, **When** I tap "Delete this recipe", **Then** a Dialog asks "Delete “Leek & bacon quiche”?" and explains: "It will disappear for the whole family, along with its 2 variants. You can bring it back from Recently deleted for 30 days." "Delete recipe" removes it for everyone.

### User Story 2 — Bring it back (P1)
**Given** Settings › Recently deleted, **Then** I see deleted recipes with "Deleted by Gabriel · 3 days ago · 27 days left" and a Restore button; restoring puts it back exactly as it was.

### Edge cases
- Grocery items linked to a deleted recipe stay on the list, with their source shown as "From a deleted recipe".
- A recipe deleted via AI follows the same 30-day rule, and its activity entry offers Restore (spec 026).

## Requirements

- **FR-001**: Delete is a soft delete (`deleted_at`, `deleted_by`); deleted recipes are hidden from lists, search, share links and MCP reads.
- **FR-002**: A nightly job permanently removes recipes deleted more than 30 days ago, including their photos.
- **FR-003**: Recently deleted is a pushed screen listing items newest first, with Restore and "Delete now" (which needs a Dialog).
- **FR-004**: Any family member can delete any recipe; it stays recoverable for 30 days.
- **FR-005**: Shared links of a deleted recipe stop working, and work again on restore.

## Success Criteria
- **SC-001**: A restored recipe is identical to the original, including variants, settings and photo (test).

## Tracking (PostHog)
| Event | Properties |
| --- | --- |
| `recipe_deleted` | source (app, assistant name) |
| `recipe_restored` | days_since_delete |

## Warnings and errors
All copy is in the States tables of the UI specs for: OC-Delete. New messages go there and in `strings/en.ts` first.

## Needs your attention
None.

## Changelog
- 2026-10-13: Ready. Decisions 1–34 applied; tracking added.
