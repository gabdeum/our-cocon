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

## Warnings and errors
Tool errors return one plain sentence saying what to fix (e.g. "Unknown unit 'cupz'. Use g, ml, cup, tbsp or tsp.") so the assistant can retry. Permission denied: "This member hasn't allowed AI to do that. They can change it in Settings › AI assistants."

## Needs your attention
First task, before any tool is built: prove on the self-hosted staging stack that Supabase's OAuth 2.1 server with dynamic client registration is enabled and that Claude, ChatGPT and Gemini can connect through it. If it isn't available self-hosted, stop and tell me: the options are a small OAuth layer in the MCP server, or moving to Supabase Cloud.

## Changelog
- 2026-10-13: Ready. Decisions 1–34 applied; tracking added.
- 2026-10-18: FR-004 now converts written temperatures to `{temp:…}` tokens (spec 005).
- 2026-10-19: FR-002a: search and filters shared with the app; cuisine as a key; diet gone.
