# Feature Specification: Event reminders on the phone

**Feature Branch**: `049-event-reminders` · **Status**: Built · **Depends on**: 033, 035, 041, 043, 046
**Input**: An event's reminder now reaches the right people's phones, even when the app is closed: "Baby swim class in 1 hour".
**Design**: `design/ui/OC-Notifications.md` › Event reminders; screen `OC-NotifLockReminders`; `OC-SettingsNotif` (event reminders section).

## User Scenarios & Testing

### User Story 1 — The right person is reminded (P1)
**Acceptance**: **Given** "Baby swim class" at 14:30 for James, "Gabriel takes James", reminder 1 hour before, **Then** at 13:30 Gabriel's phones show "Baby swim class in 1 hour" / "14:30 · Aquatic Center · Gabriel takes James". Eva gets nothing unless she chose "All family events".

### User Story 2 — The evening before (P1)
**Given** "Eva’s birthday" (all day, Tuesday) with "1 day before", **Then** on Monday at 18:00 every account member on the event gets "Tomorrow: Eva’s birthday" / "All day · Tuesday".

### User Story 3 — Changes just work (P1)
**Given** the pediatrician moves from 10:00 to 11:00 after reminders were planned, **Then** the reminder follows the new time; a deleted event sends nothing.

### Edge cases
- Repeating events: each occurrence reminds on its own; exceptions (spec 035) are respected.
- An event created after its reminder time: no reminder.
- Server was down: a reminder more than 30 minutes late is skipped (2 hours for "1 day before").
- Private events remind only their owner; a surprise never reminds the person it's hidden from (spec 043).
- Events added by an AI assistant remind like any other.

## Requirements

- **FR-001 Options** (spec 041 Reminder, enum on `events.reminder`): None · 15 minutes before (`minutes_15`, new) · 1 hour before · Morning of · 1 day before. Add event pre-fills the member's default (spec 046 FR-003). Remove the hint "Shows on Home for now. Phone alerts come later."; the new hint is "Reminds {names} on their phones." (or "Reminds you" for private).
- **FR-002 When** (per occurrence, family home time zone, spec 034): `minutes_15` / `hour_before` → start − 15 min / − 1 h (slot events start at their slot's start; all-day events treat these as Morning of); `morning_of` → 07:30 that day, or 1 hour before the start if that's earlier than 08:30; `day_before` → 18:00 the day before.
- **FR-003 Who**: account members on the event; "Everyone" → all account members; a managed member (spec 033) → the responsible member, or all account members when "Not decided yet"; "Others" → the creator. Plus members whose scope is "All family events" (only family-visible events). Minus anyone with reminders off on all their devices. Each recipient gets it on every enabled device (`push_devices`).
- **FR-004 Copy**: `minutes_15` "{title} in 15 minutes"; `hour_before` "{title} in 1 hour"; `morning_of` "{title} at {time}" (slot: "{title} this {slot}", all day: "Today: {title}"); `day_before` "Tomorrow: {title}". Body: "{time or slot} · {place} · {responsible line}", dropping empty parts; members' names only when the recipient isn't the only one on it ("James · Dr. Lee · Gabriel takes James"). Time format follows the recipient's setting (spec 029).
- **FR-005 Sending**: `apps/notifier` (spec 046) runs every minute: `reminders_due(now)` expands occurrences in the next 2 minutes with `@cocon/calendar` (same rules as the app), resolves recipients (FR-003), skips ones already in `reminder_deliveries` (event_id, occurrence_date, kind, member_id — unique), sends through `packages/notify` with `data.route = /calendar/{id}?date={occurrence}`, thread `reminders`, interruption level `active`, default sound.
- **FR-006**: Home's "reminders due today" (spec 028 FR-003) stays; the event detail's reminder row reads "Reminds {names} · {when}" ("Reminds Gabriel · 13:30").

## Success Criteria
- **SC-001**: For a table of events (slot, custom, all day, repeating, private, surprise, managed member, Others), `reminders_due` returns exactly the expected recipients and times (unit test).
- **SC-002**: A reminder arrives within 60 s of its time on staging (end-to-end check with a test device).
- **SC-003**: No duplicate reminder for the same occurrence and person, even if the worker restarts (test on `reminder_deliveries`).

## Tracking (PostHog)
| Event | Properties |
| --- | --- |
| `event_reminder_sent` (server) | kind, recipients (count) |
| `notification_opened` | kind = reminder (from 046) |

## Warnings and errors
Copy in `design/ui/OC-Notifications.md`. No user-facing errors; failed sends are retried once, then logged.

## Needs your attention
- Defaults chosen for you: "Morning of" = 07:30 and "1 day before" = 18:00 the evening before. Change them here if you prefer other times.

## Changelog
- 2026-11-02: Ready. From Gabriel's notifications brief.
- 2026-11-04: Built. Reminders go out from the notifier's new `reminders` job: `remindersDue` in `@cocon/calendar` (when, who, words; the event sheet's hint, the event page's row and Home use the same rules), claimed in `reminder_deliveries` before sending (a crash in between loses one reminder rather than sending two), sent with `packages/notify` (now worded per phone, and retried once). The event's Reminder has "15 minutes before", starts on the member's default, and assistants get it too (`reminder` on create_event and update_event, default from the member's settings; not for one date). `event_reminder_sent` goes to PostHog from the notifier (it now reads the PostHog key from app.env). The nightly purge keeps 90 days of sends (032-later L118). Deviations: the spec's examples drive the bodies: "15 minutes" and "1 hour" are "{time} · {place} · {who takes}", "Morning of" "{who it's for} · {place} · {who takes}" (its time is in the title), "1 day before" "{time, slot or All day} · {weekday} · …" (OC-Notifications.md has the rules); slot titles read "early this morning" and "at lunch" for those two slots; no `reminders` thread (Expo's push API has none, 032-later L122); a reminder may go out up to 30 s early instead of "in the next 2 minutes"; the hint says "Reminds you on your phone." whenever you're the only one reminded, not only for private events; an event moved later on the same day after its reminder went out isn't reminded again (the claim is per date, not per time); "Automatic" time format follows each phone's clock, which the app now sends with its settings (`clock_24h`).
