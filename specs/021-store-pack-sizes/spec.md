# Feature Specification: Store profiles — what you need vs. what to buy

**Feature Branch**: `021-store-pack-sizes` · **Status**: Ready · **Depends on**: 005, 020, 031
**Input**: Show both the amount recipes need and the packs to buy, based on where the family shops.
**Design**: canvas `OC-Groceries` (Buy/Need rows, store toggle), `OC-Settings` (Groceries section); components ListRow (trailing Buy/Need), SegmentedControl (`--pill` and light), Switch.

## User Scenarios & Testing

### User Story 1 — Buy what the store sells (P1)
**Acceptance**:
1. **Given** US stores, **Then** "Heavy cream" shows "Buy 1 pint carton" over "Need 300 ml · ~170 ml left over".
2. **Given** European stores, **Then** it shows "Buy 2 × 20 cl" over "Need 300 ml · 100 ml left over".

### User Story 2 — Choose my store type (P1)
**Given** Settings › Groceries › "Where do you shop?", **When** I pick European stores, **Then** every grocery row updates; the example in Settings reads "Recipe needs 300 ml cream → Buy 2 × 20 cl".

### User Story 3 — Only what recipes need (P2)
**Given** "Round up to store sizes" is off, **Then** rows show only "Need 300 ml".

### Edge cases
- No pack data for an item: show only "Need …".
- Items sold loose (apples, pumpkin): "Buy 1 kg loose" or "Buy 6"; a bag size when that's typical ("1 bag · 3 lb · about 8 apples").
- Items with no quantity ("Salt"): no Buy/Need text.

## Requirements

- **FR-001**: The family setting `store_profile` (us | eu) and `round_to_packs` (default on) are set in Settings; the Groceries screen has a quick US/Europe toggle that changes the same setting.
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

