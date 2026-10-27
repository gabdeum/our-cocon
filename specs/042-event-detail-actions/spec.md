# Feature Specification: Event detail, checklist, duplicate, share and delete

**Feature Branch**: `042-event-detail-actions` · **Status**: Ready · **Depends on**: 019, 035, 041
**Input**: See everything about an event, tick its checklist, copy it to another day, share it, or delete it safely.
**Design**: canvas `OC-CalEvent`, `OC-CalEventDelete`; components Tag, ListRow (icon rows), ChecklistRow, Button, Dialog, BottomSheet.

## User Scenarios & Testing

### User Story 1 — Everything in one place (P1)
**Given** "Baby music class", **Then** I see its type tag, title, member chips, "Saturday, Oct 31 · Morning · about 09:00–12:00", "Every Saturday", place with "Open in Maps", "Gabriel takes James", reminder, the "Bring" checklist and "Added by Eva · 2 days ago".

### User Story 2 — Delete a repeating event (P1)
**Given** a repeating event Eva added, **When** I tap "Delete event", **Then** a dialog asks "Delete “Baby music class”?" — "Eva added this. Delete only this one, or this and all future ones? It's removed for the whole family." with "Only this one", "This and all future ones", "Keep it".

## Requirements

- **FR-001**: Rows with olive icons: when, repeat summary, where (+ "Open in Maps"), responsible ("{name} drives" or "{name} takes {managed member}"), reminder ("Shows on Home for {account members on the event}"). Rows without a value are hidden.
- **FR-002 Checklist** "Bring": tickable by any family member, realtime; hint "Anyone in the family can tick these."
- **FR-003 Actions**: olive "Edit", soft "Duplicate" (date picker, then a toast "Copied to {day}" with Undo), soft "Share a view-only link", danger link "Delete event".
- **FR-004 Delete**: non-repeating → "Delete “{title}”? This removes it for the whole family." / "Delete" / "Keep it". Repeating → scope dialog above. Someone else's event adds "{Name} added this." Deleted events go to Recently deleted for 30 days (spec 018); toast "Event deleted" with Undo.
- **FR-005 Share**: reuses spec 019's link infrastructure: the page `/e/[token]` shows title, day, time, place and first names only — no notes, checklist or private/surprise content. The link expires after the event ends or when stopped.
- **FR-006**: "Added via {assistant}" replaces "Added by" for AI-created events.

## Tracking (PostHog)
| Event | Properties |
| --- | --- |
| `event_deleted` | scope, own_event (bool), undone (bool) |
| `event_duplicated` | — |
| `event_shared` | — |
| `event_checklist_ticked` | — |

## Warnings and errors
Copy in `design/ui/OC-CalEvent.md`. Share link for a private or surprise event is not offered.

## Needs your attention
None.

## Changelog
- 2026-10-25: Ready. Written from the calendar brief and the reviewed canvas (page "Our Cocon · Calendar"). Renumbered on 2026-10-26: Home and Settings for all modules are 028 and 029.
