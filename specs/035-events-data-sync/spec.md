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
- The calendar brief's offline line ("changes will sync when you're back") conflicts with decision 11 (read-only offline). The build keeps read-only; say if you want offline edits for the calendar.
- Choices made where the spec is silent (say if you want them changed): removing James from an event he shares with Eva just takes James off it; only events that were James's alone go to Everyone (Others stays). The home time zone is set by the first device that opens the app; only the owner changes it afterwards (029). Limits: surprise cover title 60, cover note 200, checklist items 80 characters and 50 per event, place 200.
- New copy (added to OC-SettingsFamily.md): when James has upcoming events, the Remove dialog reads "Move James's {n} upcoming events to Everyone?" / "Their past events stay on the calendar. Their name and color come off the family list."
- Accepted risk (032-later L86): Eva gets only a surprise's cover, but with her own token she could notice that the events table shows her no row for it.

## Changelog
- 2026-10-25: Ready. Written from the calendar brief and the reviewed canvas (page "Our Cocon · Calendar"). Renumbered on 2026-10-26: Home and Settings for all modules are 028 and 029.
- 2026-10-27: Built. Tables `events`, `event_members` (member, Everyone, Others, or a removed member's name), `event_exceptions`, `event_checklist_items` (who ticked it, set by the database), `event_surprise` and `family_calendar_settings`, all family-scoped with the author and source stamped (FR-004). Privacy is in the database (FR-002): private events and surprises hidden from you can't be read, changed or deleted in the tables; everyone reads through `events_visible`, which gives "Busy" (members, days, times) or the cover (shaped like a family event, so nothing says it's a surprise), and hands `viewFor` the creator's member id, members and surprise (032-later L80). Only the creator changes visibility or the surprise; a surprise is kept from people with the app, never its creator. Assistants read only `events_visible` and the settings (writes come with 044). Live: events, members, exceptions and checklists (FR-003); child-table changes refetch the calendar's `['events']` queries. `save_event` saves an event, who it's for, its surprise and checklist in one go; `@cocon/data` has `loadEvents`, `saveEvent`, `saveException`, delete/restore and the settings, checked with the new `EventInput`/`EventPatch`/`SurpriseCover` schemas and the engine first (FR-005). Birthdays must be yearly and all day (FR-006, checked in the schemas, not the database). Deletes go to Recently deleted for 30 days with their repeat and exceptions, and the nightly job removes them after; the 30-day rule is now one trigger for recipes and events. Also did 032-later L78: removing a member without the app moves their upcoming events to Everyone (the Dialog says how many) and past events keep them in grey, as do events of anyone who leaves; an event already deleted keeps them in grey if restored. Deviation: the home time zone is claimed by the first device that opens the app (`claim_home_time_zone`). After the security review: the cover has no reminder and an empty checklist like a family event, live changes don't name the event a detail belongs to, hidden views copy only timing fields from exceptions and repeats, a surprise whose creator left still shows only the cover to the person it's hidden from, and the visibility helpers answer only for your own family.
