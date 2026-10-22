# Feature Specification: Store profiles — what you need vs. what to buy

**Feature Branch**: `021-store-pack-sizes` · **Status**: Ready · **Depends on**: 005, 020, 031
**Input**: Show both the amount recipes need and the packs to buy, based on where the family shops.
**Design**: canvas `OC-Groceries` (amounts beside each name, the Grocery settings sheet); components ListRow (title detail, Edit action), SettingChoice, SegmentedControl (light), Switch. The canvas screens predate Gabriel's 2026-10-22 changes: `design/ui/OC-Groceries.md` is the reference.

## User Scenarios & Testing

### User Story 1 — Buy what the store sells (P1)
**Acceptance**:
1. **Given** US stores, **Then** the row reads "Heavy cream: 1 pint carton (need 300 ml)".
2. **Given** European stores, **Then** it reads "Heavy cream: 2 × 20 cl (need 300 ml)".

### User Story 2 — Choose my store type (P1)
**Given** Groceries › "Grocery settings" › "Where do you shop?", **When** I pick European stores, **Then** every grocery row updates; the sheet's example reads "Recipe needs 300 ml cream → Buy 2 × 20 cl".

### User Story 3 — Only what recipes need (P2)
**Given** "Round up to store sizes" is off, **Then** rows show only what recipes need: "Heavy cream: 300 ml".

### Edge cases
- No pack data for an item: only what recipes need ("Za'atar: 50 g").
- Items sold loose (apples, pumpkin): "Pumpkin: 1 kg loose", "Apple: 6 pieces"; a typical bag with what's in it is left for later (032-later L52).
- Items with no quantity ("Salt"): just the name.

## Requirements

- **FR-001**: The family settings `store_profile` (us | eu) and `round_to_packs` (default on) are set in the Groceries tab's "Grocery settings" sheet (the settings button beside "Add item"), for the whole family.
- **FR-002**: Pack sizes live in the catalog (spec 031): per ingredient and profile, size, unit, label ("pint carton", "20 cl", "8 oz block") and whether it's sold loose. Need amounts are summed in base units per catalog key before packs are picked.
- **FR-003**: The engine picks the pack combination that covers the need with the least left over (fewest packs on a tie), and reports the leftover. Prices are out of scope.
- **FR-004**: Pack data is maintained in the repo with the catalog; a family can correct a pack size for itself through the family override (spec 031), from the row's "Edit".
- **FR-005**: V1 offers US and European stores only. Profiles are data-driven so a UK profile can be added later.

## Success Criteria
- **SC-001**: For every catalog item with packs, Buy is never less than Need (test).

## Tracking (PostHog)
| Event | Properties |
| --- | --- |
| `store_profile_changed` | profile (us, eu) |
| `all_items_cleared` | count (Clear all items, confirmed) |

## Warnings and errors
All copy is in the States tables of the UI specs for: OC-Groceries, OC-Settings. New messages go there and in `strings/en.ts` first.

## Needs your attention
None.

## Changelog
- 2026-10-13: Ready. Decisions 1–34 applied; tracking added.
- 2026-10-22: Shipped. `family_settings` table (one row per family, live; spec 027 adds its columns here; members save it, never delete it), the pack engine `pickPacks` in `@cocon/quantity` (least left over, then exact before estimated, then fewest packs), Buy over Need rows, the US · Europe toggle, Settings › Groceries, and the family's own pack size from Edit › "Store size". Deviations:
  - Leftovers within 1% of the need count as a tie, so fewest packs wins: the catalog stores a half pint as 236 ml and a pint as 473 ml, and two half pints would otherwise beat the pint carton by 1 ml.
  - Buy text comes from catalog pack labels, so the screen's sample text differs (Gruyère US "6 oz wedge", apples in Europe "Buy 6" loose rather than a bag, pumpkin US "Buy 1 · ~500 g left over"); the bag-contents note ("about 8 apples") isn't built (032-later L52).
  - "~" marks estimated leftovers: US sizes, or a conversion through density or piece weight.
  - Rows of the same item still to buy are summed; the first carries Buy and "Need {total}", the others "Need {their amount}".
  - The Settings example is fixed copy ("Buy 1 pint" / "Buy 2 × 20 cl"); a test checks it against the engine, which says "Buy 1 pint carton" in the US.
  - Edit › "Store size" is not drawn; its copy is in OC-Groceries.md › Store sizes. Catalog items only (L53). A saved size replaces the catalog's packs for both stores (spec 031); "Use the usual sizes" puts them back and isn't tracked as a correction.
  - New design-system component `SettingChoice` (the stacked "Where do you shop?" setting with its example; 027 reuses it for Units). `SegmentedControl` gained a `disabled` state (offline) and a hit slop so the 36 px pill reaches 44.
- 2026-10-22: Gabriel's changes after trying it on dev:
  - Amounts sit beside the name, not on the right: "Heavy cream: 1 pint carton (need 300 ml)"; "(need …)" is left out when it's exactly what to buy ("Pumpkin: 1 kg loose"), and pieces bought one by one read "1 piece" unless the need is a count ("Apples: 6"). No leftover is shown (the engine still picks by least left over). The Buy/Need footnote went with the words.
  - Each row has an "Edit" text button (beside the row, not inside it); the long-press hint is gone (long-press, swipe and right-click still open the menu).
  - Where you shop and round up moved to a "Grocery settings" sheet (settings button beside "Add item"); the store row on Groceries and the Groceries section of Settings are gone (spec 029 updated).
  - "Clear all items" beside "Clear done items", confirmed by a Dialog, with Undo; new event `all_items_cleared`.
  - In Edit item, "Remove" is a red danger button apart from "Move to…" and "Store size".
  - ListRow: the right-hand Buy/Need trailing is replaced by a title detail and an end-of-row action.
- 2026-10-22 (later): from Gabriel's review: counts always say pieces ("Lemon: 2 pieces"), and a row shows the catalog's singular name when it's the same word as typed ("2 lemons" → "Lemon"; "Meyer lemons" stays as typed). The Grocery settings sheet's card now has the inset padding settings rows need (it had none).
