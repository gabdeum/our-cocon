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
- 2026-10-22: Shipped. `/groceries` lists the family's items by aisle, live: typing "2 lemons" adds or merges (`planGroceryAdd` in `@cocon/quantity`, shared with 022 and 024), ticks are optimistic and revert with "Couldn't update. Try again.", "Mia is shopping" shows for 10 minutes after someone else's last tick, recipe cards sit above the aisles, "Clear done items" and "Remove" have Undo, and a row's menu (long-press, swipe left, right-click or the screen reader's actions) offers Edit, Move to… and Remove. Migration: `grocery_items.deleted_at` (a cleared item is kept a day for Undo, then the nightly purge removes it), and an aisle fallback trigger for writers that pass none. Deviations:
  - The store row, "Buy …" lines and the Buy/Need footnote come with 021; rows show "Need {amount}" only, in metric until 027.
  - Merging joins only an item still to buy whose amount adds up (two weights, two volumes or two counts); otherwise the new item gets its own row. A merge with no amount says "Already on the list."
  - Presence comes from tick times (`checked_by`, `checked_at`), so no new table; it ends early if her ticked items are cleared.
  - Swipe left opens the same menu as long-press, rather than showing buttons under the row.
  - The recipe card is tappable as a whole (Card rule), with "Open" as its label, and keeps the soft Card's 22 radius.
  - New copy for states not drawn (add failed, removed, the row menu, Edit and Move to… sheets, loading failed) is in design/ui/OC-Groceries.md.
  - From the security review (second migration): the database stamps when an item was cleared and by whom (`deleted_by`), whatever the device sends; Undo works for a day; members can no longer delete grocery rows for good (only the nightly purge does). Edits and merges are checked with `GroceryItemUpdate` (`packages/schemas`). The 004 RLS test now expects deletes to be refused.
  - Tracking: `grocery_item_added` also fires on a merge; `grocery_item_ticked` fires once the tick is saved, not on unticks. The screen also fires 031's `ingredient_unmatched` (an added item the catalog doesn't know) and `catalog_override_saved` `{field: 'aisle'}` (Move to…).
  - Presence never shows yourself (US3: "the others see"). Clear, Remove, Undo, Edit and Move to… failures use the tick's "Couldn't update. Try again." Offline, rows keep their ticks but can't be changed.
  - US1's "6 items to buy" assumes a list of seven with one ticked; the seed list starts at 6, so it reads 5 after Mia's tick.
- 2026-10-22: From Gabriel's review: the row menu opens straight on the Edit field (Move to… and Remove sit below it), and a hint under the add field says "Long-press an item to edit, move or remove it."
