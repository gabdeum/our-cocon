# Feature Specification: Recipe page and recipe list on larger screens

**Feature Branch**: `067-recipe-large-screens` · **Status**: Ready · **Depends on**: 063, 064, 065, 006, 008, 009, 012, 051

Screen: `design/screens/OC-RecipeResponsive.dc.html` (pass `w`/`h`: 390, 744, 1180). UI spec: `design/ui/OC-LargeScreens.md` § Recipe.

> Use the app's existing recipe page: hero photo, title, description, chips, cooked line, "Cooking now" card, Version pills, "Make my own dough" switch, Servings card, ingredient rows, step cards (title only, tap opens cooking mode at that step), sticky footer. Use the existing Recipes list rows and search. New: the side-by-side columns, the list next to the recipe, the framed panel and the "More options" link.

## Functional requirements
Priority as width grows: **recipe → ingredients and steps side by side (≥ 600) → + recipe list (≥ 960).**

- **FR-001 Compact**: unchanged (Ingredients / Steps tabs).
- **FR-002 Medium (≥ 600)**: the tabs are removed. Below the header block, two columns, 28 px gap: left `minmax(260, 0.8fr)` = Version, dough switch, Servings card, "Ingredients · {n}" + rows; right `1.2fr` = "Steps · {n}", hint "Tap a step to open it in cooking mode", step cards. Hero photo 280 px tall. The sheet has 24 px side padding, and content max 1200 (063).
- **FR-003 More options (≥ 600)**: in the narrow ingredients column, the ⋯ button leaves the Servings row. A text link "More options · scale, units" (sliders icon, olive, 15/800, 44 px tall) sits just under the Servings card and opens the same options, as a popover per 065.
- **FR-004 Step cards** (all sizes, as in the app today): number badge · title · "Variant" tag when relevant · **timer duration pill** when the step has a timer (soft fill, clock icon, "12 min") · 48 px square photo when the step has one · chevron. Tapping opens cooking mode **at that step**.
- **FR-005 Expanded (≥ 960)**: side rail (064) + **Recipes list column** (320 px: title "Recipes" + New, search, filter chips, section label, recipe rows; the open recipe's row has a 2 px olive border) + the recipe in a **framed panel**: 12 px margin top, right and bottom; 28 px radius on all corners; 2 px `line-strong` border; scrolls inside. Selecting another recipe in the list swaps the panel (no navigation push); the back button is hidden at this tier.
- **FR-006 Footer** (≥ 600): the sticky footer ("Add to groceries" with label + Start / Resume) is right-aligned, max 520 px wide.

## Success criteria
- **SC-001** At 744, ingredients and steps are both visible without tapping a tab.
- **SC-002** At 1180, choosing a recipe in the list updates the panel and the URL (web) without reloading the list or losing its scroll.

## Tracking (PostHog)
| Event | Properties |
| --- | --- |
| `recipe_opened` (existing) | + source `split_list` |
| `cook_started_from_step` | step (existing event if there is one; add `layout_tier`) |

## Needs your attention
- On web at ≥ 960 the URL should still be `/recipes/{id}` with the list rendered alongside. Confirm that matches your routes.

## Changelog
- 2026-11-19: Ready.
