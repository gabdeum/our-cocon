# Feature Specification: MCP server — calendar tools and permission

**Feature Branch**: `044-mcp-calendar` · **Status**: Ready · **Depends on**: 023, 024, 025, 035
**Input**: Let any connected AI assistant read and change the family calendar, with the same rules as the app.
**Design**: canvas `OC-Connect` (new permission row and example); no new screen. Add to the OC-Connect.md that spec 025 shipped; don't replace it.

## User Scenarios & Testing

### User Story 1 — Add by talking (P1)
**Given** Gabriel tells Claude "Add James's baby music class every Saturday morning, I'll take him", **Then** a weekly Morning event appears for James with "Gabriel takes James", marked "Added via Claude", in real time.

### User Story 2 — Ask about the week (P1)
**Given** "What does Eva have on Tuesday?", **Then** the assistant calls `get_day` and answers from it; private events come back as "Busy".

## Requirements

- **FR-001 Tools** (`apps/mcp/tools/calendar/`): `list_events(from, to, member?)`, `get_day(date)` (grouped by slot), `create_event(...)` (title, day, slot(s) or custom times, members incl. everyone/others, optional repeat, location, notes, responsible, visibility), `update_event(id, patch, scope: this|future)`, `delete_event(id, scope)` (returns what was deleted; goes to Recently deleted), `find_free_slots(date | range, members?)`, `list_members()` (names, colors, has_app).
- **FR-002**: Inputs use the shared Zod schemas; slot maths, labels and visibility come from `@cocon/calendar`. Tool descriptions tell assistants to prefer slots unless the user gave a time, and to ask who handles logistics for members without the app.
- **FR-003 Permission** (updates spec 024/025): a new switch row "Add & change events" in "What AI can do", between "Change the grocery list" and "Delete recipes", per member, default on, stored in `ai_permissions` and saved with `setAiPermission` like the others (`ai_permission_changed` {permission: "events", allowed}). The lead becomes "Let your AI save recipes, fill the grocery list and add events for you. Each person connects their own." and "Try saying" gains “Add James’s pediatrician on Wednesday morning.” The Disconnect dialog already says "recipes, groceries and calendar".
- **FR-004**: Writes carry `source` = assistant name and appear in the activity feed with Undo (spec 026).

## Tracking (PostHog)
| Event | Properties |
| --- | --- |
| `mcp_tool_called` | tool, assistant, ok (existing event, new tool names) |

## Warnings and errors
Same format as spec 023. Not allowed: "This member hasn't allowed AI to change the calendar."

## Needs your attention
None.

## Changelog
- 2026-10-25: Ready. Written from the calendar brief and the reviewed canvas (page "Our Cocon · Calendar"). Renumbered on 2026-10-26: Home and Settings for all modules are 028 and 029.
- 2026-10-26 (later): Spec 025 shipped "What AI can do" as switches; FR-003 now adds a switch row to that screen.
