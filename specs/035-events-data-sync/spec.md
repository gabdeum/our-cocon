# Feature Specification: Events: data model, security and sync

**Feature Branch**: `035-events-data-sync` · **Status**: Ready · **Depends on**: 004, 033, 034
**Input**: Store family events with members, recurrence, logistics, checklist and visibility; enforce privacy in the database; sync in real time.
**Design**: no screen of its own.

## User Scenarios & Testing

### User Story 1 — Everyone sees changes live (P1)
**Given** Eva adds "Yoga" on her phone, **Then** Gabriel's calendar shows it within a second.

### User Story 2 — Private stays private (P1)
**Given** Eva marks an event Private, **Then** Gabriel's app, the Home card and Gabriel's AI assistant only ever receive "Busy" with Eva's color, day and time — never the title, place or notes.

### Edge cases
- Simultaneous edits: last write wins; realtime refreshes both screens.
- A deleted event goes to Recently deleted for 30 days (spec 018); restoring brings back its recurrence and exceptions.

## Requirements

- **FR-001**: Tables (use the `add-table` skill): `events` (family_id, title ≤60, category?, location?, notes?, starts_on, ends_on, time_type slot|all_day|custom, slots[], start_time?, end_time?, recurrence jsonb?, reminder none|morning_of|hour_before|day_before, responsible_member_id?, visibility family|private|surprise, created_by, source, deleted_at), `event_members` (event_id, member_id or `everyone` or `others`), `event_exceptions` (event_id, occurrence_date, override jsonb | cancelled), `event_checklist_items` (event_id, label, done, done_by), `event_surprise` (event_id, hidden_from member ids, cover_title, cover_note), `family_calendar_settings` (slot times, home time zone).
- **FR-002**: RLS: family members read and write their family's events. For `visibility = private`, rows other than the creator's are readable only through the view `events_visible`, which replaces title/location/notes/checklist with nulls and title "Busy". For `surprise`, members in `hidden_from` read only the cover (cover_title, time, location, cover_note). Tests prove both for the app role and for an MCP token.
- **FR-003**: Realtime on `events`, `event_members`, `event_exceptions`, `event_checklist_items` (adds to spec 004's list).
- **FR-004**: Every write records `created_by`/`updated_by` and `source` (app or the assistant's name) for the activity log (spec 026) — "Added via Claude" on the event detail.
- **FR-005**: Zod schemas in `packages/schemas` for event create/update, shared by app and MCP.
- **FR-006**: Birthdays are yearly all-day events with category Birthday; they're shown 3 days ahead on Home (spec 028).

## Tracking (PostHog)
No new events.

## Warnings and errors
Save failed: "Couldn't save. Check your connection and try again." Offline: app-wide read-only banner (decision 11): "You're offline. You can read, but changes need a connection."

## Needs your attention
The calendar brief's offline line ("changes will sync when you're back") conflicts with decision 11 (read-only offline). The spec keeps read-only; say if you want offline edits for the calendar.

## Changelog
- 2026-10-25: Ready. Written from the calendar brief and the reviewed canvas (page "Our Cocon · Calendar"). Renumbered on 2026-10-26: Home and Settings for all modules are 028 and 029.
