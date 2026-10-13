# Feature Specification: Shared grocery list

**Feature Branch**: `020-grocery-list` · **Status**: Ready · **Depends on**: 004, 031
**Input**: One family grocery list everyone edits and ticks off in real time.
**Design**: canvas `OC-Groceries`; components ScreenHeader, StatusBanner (`oc-presence`), TextField, IconButton (`--olive-square`), Card (`--soft`), ListRow, TabBar.

## User Scenarios & Testing

### User Story 1 — Shop together (P1)
**Acceptance**: **Given** Mia is in the store and Alex at home, **When** Mia ticks "Gruyère", **Then** Alex sees it struck through within a second, and the header reads "6 items to buy".

### User Story 2 — Add something quickly (P1)
**Given** I type "2 lemons" and press Add, **Then** "Lemons · Need 2" appears under Produce with "Added by Gabriel".

### User Story 3 — See who's shopping (P2)
**Given** Mia ticks an item, **Then** the others see "Mia is shopping" for 10 minutes after her last tick.

### Edge cases
- Adding an item that already exists merges the quantities ("Already on the list").
- Ticked items stay on the list, struck through, until someone taps "Clear done items". Nothing clears automatically.
- Unknown items go to "Other".

## Requirements

- **FR-001**: Items are grouped by aisle in the catalog's fixed order (spec 031). The aisle comes from the family override, otherwise the catalog, otherwise "Other". "Move to…" on a row saves a family override, so the item lands in that aisle from then on.
- **FR-002**: Free-text input is parsed with spec 015's parser into quantity, unit and name.
- **FR-003**: Each row shows the source ("For <recipe>", "Added by <name>", "<name> via <assistant>") and the amounts (spec 021).
- **FR-004**: A card per linked recipe ("For Leek & bacon quiche · 2 items · Open") sits above the aisles.
- **FR-005**: Ticking is optimistic and syncs through realtime; a failed sync reverts the tick and shows "Couldn't update. Try again."
- **FR-006**: Swipe left on a row (or long-press) offers Edit and Remove.

## Success Criteria
- **SC-001**: A tick reaches other devices in under 1 s at p95.

## Tracking (PostHog)
| Event | Properties |
| --- | --- |
| `grocery_item_added` | from (app, recipe, ai) |
| `grocery_item_ticked` | — |
| `done_items_cleared` | count |
| `clear_done_undone` | count |

## Warnings and errors
All copy is in the States tables of the UI specs for: OC-Groceries. New messages go there and in `strings/en.ts` first.

## Needs your attention
None.

## Changelog
- 2026-10-13: Ready. Decisions 1–34 applied; tracking added.
