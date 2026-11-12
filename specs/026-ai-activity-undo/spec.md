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
- **FR-002**: Home shows the latest entries (spec 028 FR-006); "See all activity" opens the full activity list, with a toggle "All · AI only" (opened with Home's filter) and filterable by person and assistant.
- **FR-003**: Undo creates its own activity entry; undoing an undo isn't offered.
- **FR-004**: App changes are logged too (spec 028 FR-009), with `source` app | assistant; only assistant entries can be undone. An AI recipe delete appears as "{name} deleted {recipe} via {assistant}" with Restore instead of Undo.

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
- 2026-10-27: Built. Entries are the database's own log grouped by tool call (`activity_entries`); Undo and Restore are one database function run as the member (`undo_ai_change`), so positions and RLS hold, and rows changed since are skipped after "Undo the rest?". New screen OC-Activity.md (words only) for "See all", with People and Assistants filters; new component ActivityCard. Deviations: Home shows 2 cards and "See all" where OC-Home draws one card (OC-Home.md updated); the edge-case copy is a Dialog, "Undo the rest?" with "Mia ticked 2 of these items. They'll stay as they are."; an AI delete's title is "Deleted: {recipe}" with OC-Home's "Deleted by {name} via {assistant}" sub-line; Undo on a recipe the AI added moves it to Recently deleted. Home is still a placeholder around the card until 028.
- 2026-10-27: From the security review: a call id only groups a fresh call by the same person and assistant, never one already undone; a delete is a delete by its rows, not its label; members add only one undo or restore per AI entry.
- 2026-11-02: FR-004 no longer limits the log to AI changes: app changes are logged too, and only assistant entries are undoable (spec 028 FR-009). The activity list gets "All · AI only" (FR-002).
- 2026-11-02: Built the change (with spec 028 FR-009). Migration `activity_for_everyone`: the log triggers also log a signed-in member's own writes, as `source` 'app', with a `kind` and no `before` (never undone); the database groups them by what they change (same recipe or event within 10 minutes, ticks within 10 minutes, adds or clears within 30 seconds), as an app action is often several requests. A private event's app rows keep no title and are read by the family as "a private event"; a surprise's aren't read by the people it's kept from. `activity_entries` lists both, with `p_source` 'ai' for AI only, and returns `from_recipe_name`, `event_when` and `event_secret`; `undo_ai_change` now marks its own writes so they aren't logged again as the member's change (the old body is `_undo_ai_change`). The list (OC-Activity.md) is titled "Activity", with "All · AI only" at the top (opened from Home with `?show=ai`), Assistants pills under AI only, and ActivityRows (new component, replaces ActivityCard). Titles now read "{person} {verb} {thing}" with "{module} · {detail} · via {assistant} · {timeAgo}" (OC-Home's wording), for AI entries too. Deviation: the list's toggle sends no event (its People and Assistants pills don't either).
- 2026-11-02: From the security review: an app row logged while its event was a surprise stays hidden from the people it was kept from even once the event is made private (`surprise` on the row). Not done, for Gabriel: the log is never purged, so a recipe or grocery item's name stays in it after the row is purged (already true of assistant rows' `before`).
- 2026-11-12 (spec 053): FR-002's list: 20 entries a page (was 50), paged by `(created_at, entry key)` so entries sharing a time aren't skipped, live updates refresh the first page without cancelling "Show more", and a failed page is a warn toast with Try again (053 FR-018 to FR-021). OC-Activity.md updated.
