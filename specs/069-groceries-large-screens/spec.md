# Feature Specification: Groceries on larger screens

**Feature Branch**: `069-groceries-large-screens` · **Status**: Ready · **Depends on**: 063, 064, 065, 020, 021, 052

Screen: `design/screens/OC-GroceriesResponsive.dc.html` (pass `w`/`h`: 390, 820, 1180). UI spec: `design/ui/OC-LargeScreens.md` § Groceries.

> Use the app's existing Groceries screen: header with the round settings button at the top right, "{n} is shopping" pill, add field, recipe cards, aisle sections, item rows, Clear done / Clear all. Only the columns and spacing are new.

## Functional requirements
- **FR-001 Compact**: unchanged.
- **FR-002 Medium and expanded (≥ 600)**: the same order as phone. Header row (title + count | shopping pill + settings button), add field, recipe cards in a 2-column grid, aisles in **2 columns read by column** (063 `splitColumns`, weight = items + 1, so Produce → Bakery → Dairy fill the left column first), then Clear done / Clear all as a centred pair, max 420 px. Content max 1200, 24 px gutter. The expanded tier adds only the side rail (no extra panel).
- **FR-003** Both aisle columns start on the same top line, each beginning with an aisle heading. Aisles never split across columns.
- **FR-004** Ticking an item never moves aisles between columns while the screen is open. Re-split only on load, on add/remove of an aisle, or on resize.

## Success criteria
- **SC-001** At 820, with the sample list, columns differ in height by at most one item row.

## Tracking (PostHog)
None new.

## Needs your attention
- Three aisle columns from 1280 wide (laptops) would fit. Not included; say if you want it.

## Changelog
- 2026-11-19: Ready.
- 2026-11-20: Shipped. From 600 the recipe cards sit two by two (gap 10), the aisles in two columns read by column (063 `splitColumns`, weight = rows + 1, gap 14, both columns starting with an aisle heading), and Clear done / Clear all are a centred pair at most 420 wide (new token `layout-button-pair`). The split is kept while the screen is open (`aisleColumns` in `lib/groceries.ts`): ticking or a new row in an aisle moves nothing; a new or emptied aisle, or a change of tier, splits again. Below 600 nothing changes. Also, on Gabriel's call: the strip behind the side rail was the navigation library's default grey on every screen; the root now gives it a navigation theme with the page colour (see 064). Deviations: the add field stays pinned under the header (spec 050), and the space between header, add field and list stays the app's 18 (the source draws 14). No new events. An update is enough (no native change).
