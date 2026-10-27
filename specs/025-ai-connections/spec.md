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
- Connection steps were checked on 2026-10-26 against Anthropic's, OpenAI's and Google's help pages (decision 34). ChatGPT moved its menus this autumn (Plugins, Developer mode), so the step has a fallback line; re-check all three before launch (032-later L68).
- Gemini connects only for people 18 or older in the US with a personal Google account; the sheet says so. Its return address is still unverified (032-later L59).
- The sign-out, approval, grant and account addresses on `api.` now ask the MCP server first (Caddy). If the MCP container is down, those calls fail (502) rather than letting an assistant through: signing out in the app then keeps the session until it's back.
- Found while testing: a member who joined by invite can't delete their account (032-later L71, P1).

## Changelog
- 2026-10-13: Ready. Decisions 1–34 applied; tracking added.
- 2026-10-26: Built. Settings › AI assistants (`/settings/ai`) with Connect (steps checked against each assistant's docs, address with Copy, "check connection"), Manage (last used, permissions, Disconnect revoking every grant the assistant holds) and "What AI can do" (032-later L67). The MCP server records each assistant's last use (`assistant_use`, at most once a minute); `my_assistants()` lists the member's grants. Leaving the family (removed, or the family deleted) revokes every connection (trigger on `members`). Disconnect is immediate on the API too (`check_request`, PostgREST's pre-request), and assistant tokens can't reach the member's own sign-in actions (Caddy asks the MCP server's internal check, 032-later L62). Deviations: Gemini offered with a US-only note instead of "Not available yet" (that state exists, unused); connections from apps the database can't name (e.g. Claude Code locally) are listed under their own name so they can be disconnected; the screen's 48 px permission rows use ListRow's 60 px; IconTile gained letters and ListRow a tile leading and olive tones. Copy not drawn added to OC-Connect.md (sheets, States).
- 2026-10-26 (review): "What AI can do" rows are switches (one tap, instead of a choice of Allowed · Not allowed); menu and button names in the connection steps are highlighted like amounts in recipe steps; ChatGPT's steps add a note to ask again when a safety check stops a request. OC-Connect.md updated.
