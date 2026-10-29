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
- 2026-10-29: Built. The event page `/calendar/[id]?date=` (OC-CalEvent) with the live "Bring" checklist, Edit (to `/calendar/[id]/edit?date=`), Duplicate (a "Pick a date" DateGrid, then "Copied to {day}" · Undo), Share and Delete (OC-CalEventDelete) with the "Event deleted" · Undo toast. Deleted events are listed in Recently deleted with recipes ("{n} item(s)"). Share: table `event_share_links` (one active link per event date, token made by the database, stopping is one-way, members can't delete links; private, surprise and deleted events are refused), RPCs `share_event` and `shared_event` (service role only: title, date and time fields, place and first names; nothing once stopped, deleted, no longer a family event, cancelled, not one of the event's days, or over in the family's home time zone, a day later without one), Edge Function `shared-event` (added to Caddy's allow-list, so `infra/VERSION` is 4), public page `/e/[token]` (noindex, no analytics). `event_deleted` is sent on delete with `undone: false`, and again with `undone: true` when the toast's Undo brings it back; `event_checklist_ticked` only on a tick, not an untick. New in the design system: `IconRow` (ListRow), `MemberBadge` (MemberChip), `BackLink` (ScreenHeader), Dialog's second choice and Button `danger-outline`, ChecklistRow `disabled`, UndoToast without Undo, icons clock, repeat, pin and bell. `@cocon/calendar` gains `occurrenceOn` (finds a date moved to another day; the edit route uses it too). Copy for states not drawn, the share sheet and the shared page was written and added to OC-CalEvent.md; "Couldn't undo…" to OC-CalAdd.md; Recently deleted's event copy to OC-Menu.md. Deviations:
  - The type tag uses the system's Tag `md` soft (13/900, padding 5 10; the canvas draws 13/800, 6 12), and the delete Dialog the system's 60 icon disc and 14 gap (the canvas: 56, 10).
  - "This and all future ones" splits the series at that date (as "All future events" does) and deletes the new part, so those dates are one Recently deleted entry under the event's title; on the series' first date the whole event is deleted.
  - The reminder's "Shows on Home for …" also names whoever takes the members without the app (OC-CalEvent's Baby music class is for James only, yet reads "Gabriel").
  - Share isn't offered once that date is over. The Busy and surprise pages are 043's: until then a "Busy" event says "We couldn't open this event."

