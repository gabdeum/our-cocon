# Feature Specification: Quantity engine

**Feature Branch**: `005-quantity-engine` · **Status**: Ready · **Depends on**: 001, 031
**Input**: One pure TypeScript library that scales, converts, rounds and formats every quantity and temperature, and renders step text from ingredient tokens.

## User Scenarios & Testing

### User Story 1 — Amounts are right at any serving size (P1)
**Acceptance**:
1. **Given** a recipe for 6 with 2 leeks (150 g each), **When** set to 9 servings, **Then** it shows "3 leeks (450 g)".
2. **Given** 1 egg ×1.25, **Then** "1½ large eggs"; eggs in "scale by ingredient" round to whole numbers (spec 013).

### User Story 2 — Units follow the person (P1)
**Acceptance**:
1. **Given** imperial, **Then** 300 ml shows "1¼ cups", 20 g shows "0.7 oz", 1.2 kg shows "2.6 lb".
2. **Given** the kitchen scale off, **When** an ingredient has a cup weight, **Then** 100 g Gruyère shows "about 1 cup" and 20 g butter shows "about 1½ tbsp".
3. **Given** temperature 180 °C, **Then** metric shows "180 °C (350 °F)" and imperial shows "350 °F (180 °C)".

### User Story 3 — Steps read naturally (P1)
**Given** step text "Add {leek} finely sliced", **Then** it renders "Add 2 leeks (300 g) finely sliced", matching the user's example: "Add 1 small onion (70 g) finely chopped".

### User Story 4 — Pieces read the way you'd cut them (P1)
**Acceptance** (onion sizes from the catalog: small 70 g, medium 120 g, large 200 g):
1. **Given** a recipe needs 95 g onion, **Then** it shows "½ large onion (95 g)": ½ large (100 g) is the closest fit.
2. **Given** 18 g onion, **Then** "¼ small onion (18 g)".
3. **Given** 1 small onion ×0.5, **Then** "½ small onion (35 g)".
4. **Given** 250 g onion, **Then** "2 medium onions (250 g)".
5. **Given** 7 g onion, **Then** "7 g onion": no piece is close enough.
6. **Given** imperial, **Then** 95 g onion shows "½ large onion (3.4 oz)".

### Edge cases
- 0 or missing quantity → the name only ("Salt and pepper").
- Pinch: 1 → "1 pinch", 2 or more → "2 pinches"; never scaled into grams.
- Very small results never show 0: below the smallest unit, show "a pinch" or "1 tsp".

## Requirements

- **FR-001**: `scale(recipe, {servings} | {ingredientId, amount, unit})` returns a factor and scaled ingredients.
- **FR-002**: `format(ingredient, {system: metric|imperial, scale: boolean})` returns `{amount, unit, sub, phrase}`; `phrase` is what steps embed.
- **FR-003**: Rounding: pieces to the nearest ½; cups to the nearest ¼; spoons to the nearest ½; grams to whole numbers; ml to whole numbers; oz and lb to 1 decimal; kg and L above 1000.
- **FR-004**: Imperial volumes: under ¼ cup use tbsp, under 1 tbsp use tsp (US measures). US cups only in V1.
- **FR-005**: Temperatures: °F rounded to the nearest 5.
- **FR-006**: `renderStep(body, ingredients, options)` replaces tokens with `phrase` and returns segments marked as highlight, for StepCard.
- **FR-007**: The same package runs in the app and the MCP server (no React Native imports).
- **FR-008**: Ingredient facts (density, piece sizes, whole-only rounding) come from the catalog (spec 031) and are passed in; the package holds only unit constants. Without a density, weight↔volume conversion is not offered and the author's unit is kept.
- **FR-009**: Piece fit. When an ingredient has catalog piece sizes and a known weight (an amount in g, kg, oz or lb, or a piece amount that scaling made fractional), it is shown as the piece amount closest to that weight:
  - Less than one piece of the author's size (or the default size): try ¼, ½ and 1 of each size (small, medium, large) and pick the one whose weight is closest. On a tie, prefer the author's size, then the default size, then the whole piece over ½ over ¼. No other fractions.
  - One piece or more: the author's size (or the default), in whole and half pieces (FR-003).
  - The size word is always shown. The weight in brackets is the recipe's actual amount (rounded per FR-003, in the person's units), not the piece weight.
  - If the closest fit is more than 25% away from the amount, show the weight only.
  - `whole_only` items (eggs) never get fractions; ingredients without sizes or a weight are unchanged.
  - Kitchen scale off (spec 013): the weight in brackets is dropped ("½ large onion").
  - Sizes come from the catalog facts passed in (FR-008). The recipe's amount itself never changes; a catalog edit can only change how it is worded.

## Success Criteria
- **SC-001**: Over 95% line coverage, with table-driven tests for every unit pair.
- **SC-002**: Formatting 100 ingredients takes under 5 ms.

## Tracking (PostHog)
No user actions; library only.

## Warnings and errors
Invalid quantities throw typed errors; callers show their screen's error copy.

## Needs your attention
None.

## Changelog
- 2026-10-13: Ready. Decisions 1–34 applied; tracking added.
- 2026-10-18: Added US4 and FR-009 (piece fit: closest ¼, ½ or whole piece of any size, with the actual weight), as Gabriel asked. US3's example now says 70 g, matching the catalog's small onion (spec 031).
