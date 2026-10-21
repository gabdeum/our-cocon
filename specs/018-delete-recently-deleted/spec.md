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
- **Turn on the nightly purge on the server.** The new timer `cocon-purge@<env>` is installed and started by `infra/provision.sh`, so re-run the server setup once after this merges (docs/operations.md › 1). Until then deleted recipes stay in the database past 30 days; they're no longer listed in Recently deleted.

## Changelog
- 2026-10-13: Ready. Decisions 1–34 applied; tracking added.
- 2026-10-21: Built. Delete from the edit form's Variants section (OC-Delete Dialog, then Recipes with "Recipe deleted · Undo" for 8 s); Settings › More › Recently deleted (`/settings/deleted`) with Restore and "Delete now"; a restore after 30 days is refused by the database, and no photo can be added to a deleted recipe's folder; a nightly job (`scripts/purge-deleted.ts`, systemd timer `cocon-purge@<env>` at 04:30 UTC, after the backups) removes recipes deleted over 30 days ago, photos first. Deviations: "Delete now" is in a sheet opened by tapping a row, with copy written for it (OC-Settings.md › Recently deleted); a deleter who left shows as "Former member"; Dialog gained `emphasis` (bold "Recently deleted"), Link an optional icon, and ListRow's chevron an optional status. FR-005 (share links) and the grocery, MCP, activity and Home edge cases moved to 032-later L38–L42, since those features come later. `recipe_deleted.source` is `app` only until assistants can delete (023); Undo sends `recipe_restored` with `days_since_delete: 0`. The More group has only Recently deleted until 025 adds AI assistants. No recipe settings exist yet (027), so SC-001 covers details, ingredients, steps, variants and photos.
