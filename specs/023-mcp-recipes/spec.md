# Feature Specification: MCP server — recipes

**Feature Branch**: `023-mcp-recipes` · **Status**: Ready · **Depends on**: 004, 005, 017
**Input**: Let any AI assistant search, read, create, update and delete family recipes on a member's behalf.

## User Scenarios & Testing

### User Story 1 — Save a recipe by talking (P1)
**Acceptance**: **Given** Gabriel connected Claude, **When** he says "Save my mum's ratatouille, it serves 4" and gives the recipe, **Then** a complete recipe (ingredients with units, steps with ingredient tokens, timers where steps mention durations) appears in the app as "Gabriel · via Claude".

### User Story 2 — Ask about recipes (P1)
**Given** "What can we cook in under 30 minutes this month?", **Then** the assistant calls search with filters and lists matching recipes with links.

### User Story 3 — Edit through AI (P2)
**Given** "Make the quiche serve 8 by default and add a tip to step 5", **Then** the recipe is updated and the change shows in the activity feed with Undo (spec 026).

### Edge cases
- Invalid input (unknown unit, missing name) returns a clear error the assistant can fix and retry.
- A token for an ingredient not in the list is rejected with the offending text.

## Requirements

- **FR-001**: A remote MCP server over streamable HTTP at `mcp.ourcocon.com`, authenticated per family member through Supabase's OAuth 2.1 server with dynamic client registration; calls run with the member's token so RLS applies; tokens are revocable from the app (spec 025). Tools are registered per module (`tools/recipes`, `tools/groceries`) so later modules add their own.
- **FR-002**: Tools: `search_recipes(query, filters)`, `get_recipe(id, servings?, variants?, units?)`, `create_recipe(recipe)`, `update_recipe(id, patch)`, `delete_recipe(id)` (subject to spec 024 permissions), `list_variants(id)`, `upsert_variant(recipe_id, variant)`.
- **FR-002a**: `search_recipes` uses the same accent- and case-insensitive search (spec 006 FR-004) and the same filters (spec 007: months, total time, cuisine, added by) as the app, from `packages/schemas`. `cuisine` is read and written as a key from the list in spec 006 FR-003; an empty cuisine is Other. An unknown key is rejected: "Unknown cuisine 'x'. Use one of: american, british, … or leave it empty."
- **FR-003**: Inputs are validated with the shared Zod schemas, and outputs include rendered amounts from `@cocon/quantity`, so assistants never compute quantities themselves.
- **FR-004**: Steps sent as plain text are converted to tokens by matching ingredient names; unmatched mentions stay as text. Written temperatures ("180 °C", "350 °F") become `{temp:<°C>}` tokens the same way as spec 016 FR-006; the tool description tells assistants to send `{temp:<°C>:food}` for thermometer readings. Tool results render steps with `renderStep`, so assistants see both scales.
- **FR-005**: Every write records `source` as the client's name and appears in the activity log.
- **FR-006**: Tool descriptions are written so assistants ask for missing servings and units rather than guessing.

## Success Criteria
- **SC-001**: From a pasted recipe, Claude and ChatGPT each produce a valid recipe in at least 9 of 10 test cases.
- **SC-002**: The MCP server rejects any call for another family's data (test).

## Tracking (PostHog)
| Event | Properties |
| --- | --- |
| `mcp_tool_called` | tool, assistant, ok (sent from the MCP server) |
| `recipe_deleted` | source (spec 018's event; the assistant's name when `delete_recipe` deletes, sent from the MCP server) |

## Warnings and errors
Tool errors return one plain sentence saying what to fix (e.g. "Unknown unit 'cupz'. Use g, ml, cup, tbsp or tsp.") so the assistant can retry. Permission denied: "This member hasn't allowed AI to do that. They can change it in Settings › AI assistants."

## Needs your attention
First task, before any tool is built: prove on the self-hosted staging stack that Supabase's OAuth 2.1 server with dynamic client registration is enabled and that Claude, ChatGPT and Gemini can connect through it. If it isn't available self-hosted, stop and tell me: the options are a small OAuth layer in the MCP server, or moving to Supabase Cloud.

- 2026-10-22 (part A): available self-hosted (Auth v2.196) and proven on local Supabase end to end (register, approve, token, tools). Self-hosted needs Caddy to add the anon key on the OAuth routes (done). Proven on staging after part A merged (Gabriel, 2026-10-23): assistants connect to `https://mcp-staging.ourcocon.com/mcp`.

## Changelog
- 2026-10-13: Ready. Decisions 1–34 applied; tracking added.
- 2026-10-18: FR-004 now converts written temperatures to `{temp:…}` tokens (spec 005).
- 2026-10-19: FR-002a: search and filters shared with the app; cuisine as a key; diet gone.
- 2026-10-22: Part A shipped (the build is split in two so assistants can be tried on staging before any tool writes):
  - Shipped: OAuth sign-in for assistants (Supabase OAuth 2.1 server with dynamic registration), the Approve access page (`/oauth/consent`, copy in OC-Connect.md), the module-agnostic MCP core (`apps/mcp/src`, modules in `apps/mcp/tools/<module>`), and `search_recipes` and `get_recipe`. `mcp_tool_called` is sent from the server.
  - Deviation: assistant tokens act as a limited Postgres role, `cocon_assistant`, which can only read recipes for now. Passwords can't sign anyone in, and authenticator-app MFA is off on the servers. Found by the security review: without these, a token would be a full member session.
  - Deviation: assistants are named from their return addresses, not a fixed list of clients.
  - Deviation: shared reads moved to the new `packages/data`.
  - Deviation: the approval page names an assistant only when its return address proves it. Otherwise it quotes the app's own name and warns about a look-alike (OC-Connect.md › Approve access).
  - Deviation: `search_recipes` filters accept `other` (no cuisine), so their unknown-cuisine sentence ends "or other for recipes with no cuisine". Writes keep FR-002a's "or leave it empty".
  - For part B: calls refused before a tool runs (sign-in, rate limit, unknown tool) send no `mcp_tool_called`. Spec 024's permission refusals must go through `callTool`, so they're tracked with `ok: false`.
  - Part B: `create_recipe`, `update_recipe`, `delete_recipe`, `list_variants`, `upsert_variant` and the activity entries (FR-005).
- 2026-10-23: Part B shipped:
  - Shipped: `create_recipe`, `update_recipe` and `delete_recipe`.
    - Ingredients are matched against the catalog.
    - Plain-text steps get ingredient and temperature tokens, and a timer from a single duration they mention.
    - The tools work through the app's save RPCs.
  - Deviation (FR-002, Gabriel's call): variants are part of the recipe. `create_recipe` and `update_recipe` take a `variants` list, whose changes name ingredients by name and steps by number. `get_recipe` returns variants in that same form. `list_variants` and `upsert_variant` were dropped.
  - Deviation: tools take flat arguments, not `recipe` and `patch` objects.
  - Deviation: `update_recipe` adds `step_changes` (small edits) and `scale_to`. With `scale_to`, "serve 8 by default" rescales every amount with the quantity engine; `serves` alone only corrects the number, as in the form.
  - Deviation (FR-005): the activity log is written by the database. A trigger logs every row an assistant adds, changes or removes, with the row as it was. It can't be skipped (an assistant's token also works on the API directly) or forged. Each tool call is tagged (`call_id`, `tool`) so spec 026 can group its entries. A change too big to log in full (a variant over 60 KB) is refused, so nothing an assistant does is beyond undo.
  - Deviation: delete is the app's soft delete. Assistants can't remove a recipe for good, and can't set photos.
  - Deviation: the unknown-unit sentence lists every unit. An amount with no unit asks for one instead of guessing.
  - Tracking: `recipe_deleted` is also sent from the MCP server, with the assistant as `source`.
- 2026-10-23: With Gabriel, after watching assistants write recipes:
  - FR-004: a token or name matches the ingredient's full name first, then its short name ("onion" for "Onion, cooked") when only one row has it; a short name two rows share is refused with both full names.
  - Each ingredient goes in one step: plain text links only its first mention in the recipe, and a token for one an earlier step uses is refused, saying how to split it into rows ("Water (sauce)", "Water (topping)"). Same for `step_changes`; variants' steps aren't checked.
  - Amounts that would not scale are refused in step text, titles, tips, ingredient names and prep notes ("about 20 g", "need 3 g"); ones that hold whatever the servings are fine ("2 tbsp per serving", "a 2 l pan"). `scalingAmountIn` in `@cocon/quantity`.
  - The step instructions in the tool descriptions say all of this, plus brackets and comma notes.
- 2026-10-24: With Gabriel: steps aren't refused for amounts any more. Text can't tell a size ("divide into 75 g balls") from an amount that should scale ("add 75 g butter"), and the refusal blocked real recipes (bao balls, ratios). A step with an amount now saves, and `create_recipe`/`update_recipe` return `warnings` ("Step 8 mentions "75 g"… If it should scale, put it on the ingredient… If it's a size…, leave it"), for step text, titles and tips, variants' steps included. The tool instructions say what should scale and to check each warning. Ingredient names and prep notes are still refused.
- 2026-10-24: With Gabriel: assistants used timers, temperature checks and tips at random, and named and ordered ingredients loosely. The write tools' descriptions now say how the app shows a recipe, which assistants can't see, in sections (Ingredients, Steps, Step add-ons, Variants), and give an order to work in: check servings and amounts, list ingredients most important first with everyday names (no brands; a bracket for a second row of one ingredient, a comma for how it's bought or prepared), decide step by step which need a timer, temperature check or tip and why, then save the variants the member gave and suggest others after saving. Deviation (US1): no timer from a duration in the text any more ("fry for 5 minutes" got one). A step has a timer only when the assistant sends `timer_minutes`; `stepTimerFrom` is removed.
- 2026-10-24: Leaner tool text (31k characters in all, was 44k): `update_recipe` points to `create_recipe`'s rules instead of repeating them, field hints are shorter, and a variant's new ingredients and steps no longer offer an `id` (one was refused). Ingredient names keep a form that is a different product in the shop ("Tinned tomatoes", a catalog item of its own); the comma is for how to buy or prepare it. The variant rules say a swap for one ingredient follows into the steps, but a swap for several or a removal doesn't, so those steps need `change_step`.
- 2026-10-24: With Gabriel, so assistants edit what's saved, not what they read. `get_recipe` returns two forms: `as_shown` (what the member sees: scaled, in their units, variants applied, to quote) and `for_editing` (the saved recipe exactly as `create_recipe`/`update_recipe` take it: details incl. `prep_minutes` and `source_text`, ingredient rows, steps with `{ing:Name}` and their add-ons, thermometer checks as `{celsius, text}`, variants). Sending `for_editing` back changes nothing; step numbers in `step_changes` and variants are its numbers. In a whole step list, a kept step keeps its title and add-ons unless the assistant sends new ones or `null`. A variant's `add_ingredient` takes `next_to` and `place`, so an added ingredient sits by importance (stored as `next_to_id` and `place` on the change, spec 017). Saving a variant that removes an ingredient, or swaps it for several, warns about base steps that still name it. Ingredient names: the raw ingredient, other details after a comma, a bracket per use.
- 2026-10-24: With Gabriel, after ChatGPT saved a bao recipe with "Tangzhong flour", "Tangzhong water" and "Prepared tangzhong". The ingredient rules now separate what an ingredient is (its canonical shop name, which the catalog matches), which part of the recipe uses it (the bracket: "All-purpose flour (tangzhong)", "All-purpose flour (dough)", one row per part) and what the recipe makes (a tangzhong, a roux: never an ingredient, named in the steps). Parts never go in a name. `create_recipe`/`update_recipe`, variants included, return a warning for each ingredient the catalog doesn't know (when the catalog answered), saying how to fix those three cases; a real unknown ingredient still saves. `get_recipe`'s `as_shown` lists rows of one ingredient as one line, added up, as the app's list does (spec 008). No logic changed for matching, scaling, steps or groceries: they already read the bracket that way.
