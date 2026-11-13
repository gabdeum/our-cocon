# Feature Specification: Assistants fill in what they can (estimates, times, seasons, ingredient details)

**Feature Branch**: `055-assistant-estimates` · **Status**: Ready · **Depends on**: 023, 044
**Input**: Gabriel (2026-11-12): (1) an ingredient's detail after the comma is about the ingredient, not preparation the steps already say; (2) assistants add events with sensible estimates (an end time, a time of day…) instead of asking, since correcting a guess is the same step as giving the answer; (3) assistants always add a recipe's times, and its best months where it's seasonal.
**Design**: none (MCP server only).
**Not in scope**: the app's own forms; checking an assistant's estimates.

## User Scenarios & Testing

### User Story 1 — An event is saved at once (P1)
**Acceptance**:
1. **Given** I tell my assistant "Dentist for Mia on Thursday at 4", **Then** it saves 16:00 to about 16:30–17:00 without asking, tells me the end time is a guess, and gives me the event's link.
2. **Given** Mia doesn't have the app and I didn't say who takes her, **Then** I'm saved as the one who takes her, and the reply says so.
3. **Given** "Football Saturday morning", **Then** it uses the Morning slot (no time asked).

### User Story 2 — A recipe has its times and seasons (P1)
**Acceptance**:
1. **Given** I paste a ratatouille recipe without times, **Then** it's saved with a total and a hands-on time estimated from the steps, and best months June–September (December–March for a family in the Southern Hemisphere).
2. **Given** a lasagne, **Then** no best months (all year).

### User Story 3 — Ingredient details don't repeat the steps (P2)
**Given** a recipe whose step says "Slice the onions", **Then** the ingredient reads "Onion", not "Onion, sliced"; "Butter, softened" and "Chicken thighs, skin on" keep their detail.

## Requirements
- **FR-001 Estimate, don't ask**: the server's instructions: ask only for what changes amounts (how many a recipe serves, an amount that's unclear); otherwise save with a sensible estimate, then say what was estimated and give the link so the member can correct it in the app.
- **FR-002 Ingredient details**: after the comma is a detail of the ingredient itself (its state, cut or how it's bought: "Butter, softened", "Chicken thighs, skin on", "Chickpeas, drained"). Preparation a step does stays in the step, never both; preparation that's done before the recipe starts and no step mentions may go after the comma ("Onion, finely chopped").
- **FR-003 Times**: `create_recipe` and `update_recipe` always send `total_minutes` and `prep_minutes`, estimated from the steps when the source doesn't say; `update_recipe` adds them when missing.
- **FR-004 Seasons**: `best_months` for a dish built on seasonal produce or made for a season or occasion, as the months it's at its best where the family lives; empty for an all-year dish.
- **FR-005 Hemisphere**: the family's hemisphere comes from its home time zone (`hemisphereOf` in `@cocon/schemas`; UTC or unknown is Northern). For a Southern family, the server's instructions say so. It's read once per member per hour.
- **FR-006 Events**: `create_event` uses a slot from the kind of event unless a time was given; with a start time and no end, it estimates the end (an appointment 30–60 min, a class or match 1–2 h, a meal out 2 h). It adds `type` and `location` when known.
- **FR-007 Who takes them**: when a member without the app is on an event and `responsible` isn't sent, the member talking to the assistant takes them, if they have the app (`responsibleOf`); `update_event` keeps whoever was set.

## Success Criteria
- **SC-001**: On staging with Claude, "Dentist for Mia Thursday at 4" is saved in one call, with no question.
- **SC-002**: Tests prove the default taker (create and update) and the Southern-Hemisphere line; the rest is tool wording, checked by trying it with an assistant on staging.

## Tracking (PostHog)
No new events.

## Warnings and errors
None new.

## Needs your attention
Nothing.

## Changelog
- 2026-11-12: Written and built. The server's instructions, `create_recipe`/`update_recipe` and `create_event` now ask assistants to estimate and save rather than ask (amounts and servings excepted), to keep preparation in the steps, and to always send times and, for seasonal dishes, best months; a Southern-Hemisphere family's connection says so (`hemisphereOf`, read once per member per hour); the member talking to the assistant takes someone without the app by default, also when people are added to an event.
- 2026-11-13 (after review): the server's rule names what's never guessed (who it's for, private or surprise, a repeat's scope, what to delete); the seasons read gives up after 2 s and a failure is kept a minute, not an hour.
