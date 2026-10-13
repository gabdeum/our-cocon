# Feature Specification: AI activity and undo

**Feature Branch**: `026-ai-activity-undo` · **Status**: Ready · **Depends on**: 024
**Input**: Show every change an AI made, who asked for it, and let anyone undo it.
**Design**: canvas `OC-Home` (activity card); components Card (`--soft`), Tag, Button (link "Undo").

## User Scenarios & Testing

### User Story 1 — Know what the AI did (P1)
**Acceptance**: **Given** Alex added 6 grocery items via ChatGPT, **Then** Home shows "6 items added to Groceries · Added by Alex via ChatGPT · 4 h ago" with Undo.

### User Story 2 — Undo it (P1)
**Given** I tap Undo, **Then** exactly those 6 items are removed (or merges reverted), and the card reads "Undone by Gabriel".

### Edge cases
- Something changed after the AI's action (an item ticked, a recipe edited again): Undo explains "Mia ticked 2 of these items. Undo the rest?" and does only the safe part.
- Undo is available for 7 days; after that the entry stays in history without Undo.

## Requirements

- **FR-001**: Every MCP write creates one activity entry for the whole tool call, holding enough data to reverse it.
- **FR-002**: Home shows the latest 2 entries; "See all" opens the full activity list, filterable by person and assistant.
- **FR-003**: Undo creates its own activity entry; undoing an undo isn't offered.
- **FR-004**: Only AI changes are logged in V1. An AI recipe delete appears as "{name} deleted {recipe} via {assistant}" with Restore instead of Undo.

## Success Criteria
- **SC-001**: Undo restores the exact previous state in every tool's test case.

## Tracking (PostHog)
| Event | Properties |
| --- | --- |
| `ai_change_undone` | kind |
| `ai_delete_restored` | — |

## Warnings and errors
All copy is in the States tables of the UI specs for: OC-Home. New messages go there and in `strings/en.ts` first.

## Needs your attention
None.

## Changelog
- 2026-10-13: Ready. Decisions 1–34 applied; tracking added.
