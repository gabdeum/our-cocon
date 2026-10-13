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
**Given** step text "Add {leek} finely sliced", **Then** it renders "Add 2 leeks (300 g) finely sliced", matching the user's example: "Add 1 small onion (120 g) finely chopped".

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
