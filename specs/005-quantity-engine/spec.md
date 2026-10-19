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
**Given** step text "Add {ing:<leek id>} finely sliced" (tokens from spec 016), **Then** it renders "Add 2 leeks (300 g) finely sliced", matching the user's example: "Add 1 small onion (70 g) finely chopped".

### User Story 4 — Pieces read the way you'd cut them (P1)
**Acceptance** (onion sizes from the catalog: small 70 g, medium 120 g (default), large 200 g):
1. **Given** a recipe needs 95 g onion, **Then** it shows "¾ onion (95 g)": ¾ of a medium (90 g) is the closest fit.
2. **Given** 18 g onion, **Then** "2 tbsp of onions (18 g)": too little for a piece, so spoons.
3. **Given** 1 small onion ×0.5, **Then** "¼ onion (35 g)".
4. **Given** 250 g onion, **Then** "2 medium onions (250 g)"; 140 g shows "2 small onions (140 g)".
5. **Given** 7 g onion, **Then** "2 tsp of onions (7 g)".
6. **Given** imperial, **Then** 95 g onion shows "¾ onion (3.4 oz)".

### Edge cases
- 0 or missing quantity → the name only ("Salt and pepper").
- Pinch: 1 → "1 pinch", 2 or more → "2 pinches"; never scaled into grams.
- Very small results never show 0: below the smallest unit, show "a pinch" or "1 tsp".

## Requirements

- **FR-001**: `scale(recipe, {servings} | {ingredientId, amount, unit})` returns a factor and scaled ingredients.
- **FR-002**: `format(ingredient, {system: metric|imperial, scale: boolean})` returns `{amount, unit, sub, phrase}`; `phrase` is what steps embed.
- **FR-003**: Rounding: pieces to the nearest ½; cups to the nearest ¼; spoons to the nearest ½; grams to whole numbers; ml to whole numbers; oz and lb to 1 decimal; kg and L above 1000.
- **FR-004**: Imperial volumes: under ¼ cup use tbsp, under 1 tbsp use tsp (US measures). US cups only in V1.
- **FR-005**: Temperatures: oven temperatures round °F to the nearest 25 (180 °C → 350 °F), thermometer checks to the nearest 5 (71 °C → 160 °F). °C shows as a whole number. The caller says which kind it is.
- **FR-006**: `renderStep(body, ingredients, options)` replaces tokens with `phrase` and returns segments marked as highlight, for StepCard. Temperature tokens `{temp:<°C>}` (oven) and `{temp:<°C>:food}` (thermometer) render in both scales per FR-005, as plain text. `ingredientToken` and `temperatureToken` build tokens for the form (016) and the MCP server (023).
- **FR-007**: The same package runs in the app and the MCP server (no React Native imports).
- **FR-008**: Ingredient facts (density, piece sizes, whole-only rounding) come from the catalog (spec 031) and are passed in; the package holds only unit constants. Without a density, weight↔volume conversion is not offered and the author's unit is kept.
- **FR-009**: Piece fit. When an ingredient has catalog piece sizes and a known weight (an amount in g, kg, oz or lb, or a piece amount that scaling made fractional), it is shown as the piece amount closest to that weight. D is the default size's weight:
  - Tiny: below the smaller of 90% of ¼ D and 90% of the small size, show cups or spoons (FR-004) with the weight: "2 tsp of onions (7 g)". The volume uses the density, or water's (1 g/ml) when there is none.
  - Below D: ¼, ½ or ¾ of the default size with no size word ("¾ onion"), or one whole piece of any size with its size word ("1 small onion"). On a tie, prefer the default size, then the whole piece.
  - D or more: the default size in whole and half pieces, or the other sizes in whole pieces, always with the size word ("2 medium onions", "2 small onions"). On a tie, prefer the default size, then fewer pieces.
  - The default size wins whenever its best fit is within 10% of the amount, even if another size is closer: 500 g onion is "4 medium onions" (480 g), not "7 small onions" (490 g).
  - The weight in brackets is the recipe's actual amount (rounded per FR-003, in the person's units), not the piece weight.
  - `whole_only` items (eggs) never get the fit; ingredients without sizes or a weight are unchanged. Without a fit, pieces round to the nearest ½ (FR-003).
  - Kitchen scale off (spec 013): the weight in brackets is dropped ("¾ onion").
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
- 2026-10-18: Shipped `@cocon/quantity`: `scale`, `format`, `renderStep`, `formatTemperature`, `convert` and unit constants, with 223 tests and 100% line coverage (CI checks 95%). Changes agreed while planning: FR-005 now rounds ovens to 25 °F and thermometer checks to 5 °F (US2.3's 350 °F needed it). FR-009 and US4 rewritten to Gabriel's revised piece fit (fractions of the default size, whole pieces of other sizes, spoons for tiny amounts, no 25% rule). Other choices: tsp and tbsp stay spoons in metric up to ¼ cup, then ml (piece-fit spoon amounts too); spoon units are picked after rounding, so just under 1 tbsp reads "1 tbsp"; an amount that rounds to 0 shows "a pinch" in every unit (never "1 tsp"; in imperial that means weights under about 1.4 g); scaling by a piece ingredient accepts a weight through its piece weight (saved, else the catalog size). Fluid ounces and gas mark are left to spec 013's converter.
- 2026-10-18: After review, as Gabriel asked: temperature tokens `{temp:…}` in step text (FR-006; specs 016 FR-006 and 023 FR-004 now create them); the default size wins the piece fit within 10% (FR-009); catalog piece nouns now name the ingredient ("cloves of garlic", "salmon fillets"; catalog version 2, new data migration).
