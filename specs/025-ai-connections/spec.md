# Feature Specification: AI connections screen

**Feature Branch**: `025-ai-connections` · **Status**: Ready · **Depends on**: 023
**Input**: Each member connects and manages their own AI assistants, in plain language.
**Design**: canvas `OC-Connect`; components ScreenHeader (back link), ListRow, Button (olive sm), Callout (`--info`).

## User Scenarios & Testing

### User Story 1 — Connect Claude without help (P1)
**Acceptance**: **Given** Settings › AI assistants › Claude › Connect, **Then** clear steps show (copy the Our Cocon address, add it as a connector in Claude, approve access), and after approval the row reads "Connected · used just now".

### User Story 2 — See and stop access (P1)
**Given** "Manage" on a connected assistant, **Then** I see when it was last used and its permissions (spec 024), and "Disconnect" revokes its token immediately.

### Edge cases
- An assistant that doesn't support connecting yet shows "Not available yet" with a muted explanation.
- A member removed from the family has all their connections revoked.

## Requirements

- **FR-001**: The list shows Claude, ChatGPT and Gemini with status (Connected · used <time ago> / Not connected) and Manage or Connect.
- **FR-002**: Connect opens a guided sheet with the MCP URL (copy button), numbered steps per assistant, and a "Check connection" button.
- **FR-003**: The "What AI can do" section mirrors the member's permissions (spec 024).
- **FR-004**: The "Try saying" card shows 2 example phrases.
- **FR-005**: When building this spec, check each assistant's current documentation for connecting a remote MCP server and write the steps from it. An assistant that can't connect yet shows "Not available yet".

## Success Criteria
- **SC-001**: In testing, a non-technical member connects an assistant in under 5 minutes.

## Tracking (PostHog)
| Event | Properties |
| --- | --- |
| `ai_connect_started` | assistant |
| `ai_connected` | assistant |
| `ai_connect_failed` | assistant, step |
| `ai_disconnected` | assistant |

## Warnings and errors
All copy is in the States tables of the UI specs for: OC-Connect. New messages go there and in `strings/en.ts` first.

## Needs your attention
Connection steps for each assistant are checked against their current docs while building (decision 34).

## Changelog
- 2026-10-13: Ready. Decisions 1–34 applied; tracking added.
