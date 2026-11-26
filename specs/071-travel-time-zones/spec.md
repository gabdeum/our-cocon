# 071 — Travelling to another time zone

**Status**: Built 2026-11-26 · **Depends on**: 029 (family time zone), 034 (wall-clock events, FR-008), 049 (event reminders), 056 (reminders), 059 (reminder notifications)

Lifts 034 FR-008's "travel time zones are out of scope". Copy and drawer in `design/ui/OC-TravelTimeZone.md` (not drawn yet: BottomSheet like the notifications ask sheet).

Decided with Gabriel (2026-11-26): there's no fixed home. The family's time zone (`family_calendar_settings.home_time_zone`, shown as "Family time zone") is wherever the family last moved. A member can keep their own times on another zone while the family stays put ("My time zone").

## Functional requirements
- **FR-001 Detect.** When the app opens or comes back to the front, and the family has a time zone, the phone's zone is compared with the one the member's times follow (their own, else the family's). A zone showing the same time now (Berlin for Paris) is no change. On another clock, the drawer opens, unless the member said "Stay" to that zone (`asked_time_zone`). Moving on to a third zone asks again.
- **FR-002 Drawer.** Where the phone is and how far from the family's time ("6 hours behind Paris"), then one example event at 4 PM shown each way ("Keep my times (I am the only one travelling)", "Keep everyone’s time (everyone is travelling)", "Stay on Paris time"), then the buttons "Keep my times" (ink), "Keep everyone’s time" (soft) and the link "Stay on Paris time". Closing it is "Stay".
- **FR-003 Keep my times.** `set_away_time_zone(zone, zone)`: the member's own time zone (`away_time_zone`). Events are clock times, so they stay as entered (4 PM stays 4 PM) and nothing is rewritten; the member's "today", "now" and the "Now" tag follow it. Their own open reminders with a time move to keep their clock time (16:00 Paris becomes 16:00 New York); reminders without a time (a day), Everyone's and other people's stay.
- **FR-004 Reading.** The app's zone is `own ?? family ?? phone` (`useTimeZone`); the database's reminder views use the caller's own zone first (`_reminder_time_zone`). The notifier sends event reminders to a member with their own zone at their time there, the others on the family's.
- **FR-005 Back on the family's time.** When the phone shows the family's time again, the member's own zone and last answer are cleared without asking, and their reminders move back.
- **FR-006 Privacy.** Each member's own zone is theirs (RLS on `member_calendar_settings`). Analytics never carry a zone.
- **FR-007 Keep everyone's time.** `set_away_time_zone(zone, zone, 'family')`: the family's time zone moves there (any member may). Everyone's reminders with a time keep their clock time; members keeping their own times somewhere keep theirs (those now on the family's clock drop it). Nobody else is asked: their phones are on the family's clock. Nothing goes back by itself: coming home, the drawer asks again and "Keep everyone’s time" moves the family back.
- **FR-008 Settings.** Menu › Calendar › Family: "Family time zone" (any member moves it once set, through FR-007, so times stay as entered; the first time, the owner sets it as before), and "My time zone" only while the member keeps their own times elsewhere, with "Use the family’s time zone ({city})".
- **FR-009 Everyone moved.** When every member with the app keeps their own times on the same clock, the family has moved: its time zone becomes that zone and their own are cleared, as FR-007.

## Success criteria
- **SC-001** `supabase/tests/071_travel_time_zone.test.sql`: only the caller's own timed reminders move with "Keep my times"; everyone's with the family; the last member to keep their times there moves the family; other members and families see and move nothing; bad input is refused.
- **SC-002** `apps/app/lib/travel.test.ts`: when the drawer opens, when it doesn't, and when the member's own times go back.
- **SC-003** `packages/calendar/reminders.test.ts`: a member with their own zone is reminded on its clock, the others on the family's.

## Tracking (PostHog)
| Event | Properties |
| --- | --- |
| `travel_time_zone_asked` | — |
| `travel_time_zone_chosen` | choice (keep, family, home), reminders_moved |
| `travel_time_zone_ended` | reminders_moved |

## Needs your attention
- With "Keep my times", events for Everyone follow the traveller's clock too (a 6 PM school play at home reminds them at 6 PM where they are). The event isn't tied to a place, so the app can't tell.
- Quiet hours (059) follow the family's time zone, not a member's own.
- The MCP server uses the family's time zone for "today".
- When the family moves, reminders of a member keeping their own times elsewhere don't move (their zone wins), so the count can hint that someone has their own zone (not which). Accepted after the security review.
- Spec 029 FR-010 made the time zone owner-only; once set, any member now moves it (the drawer lets anyone, so Settings does too).

## Changelog
- 2026-11-26: Built (Gabriel's feedback batch 4). Migration `travel_time_zone`: `member_calendar_settings.away_time_zone`, `asked_time_zone`, `set_away_time_zone`, `_my_away_time_zone` (security definer: assistants can't read `auth`), `_reminder_time_zone` reads it first. App: `lib/travel.ts`, `TravelHost` (root), `TravelSheet`. Notifier: `ReminderFamily.awayTimeZones`. An update is enough for this spec alone (no native change).
- 2026-11-26 (Gabriel, after a first try): no fixed home. "Keep everyone’s time" moves the family's time zone (FR-007; `set_away_time_zone` gains `p_scope` and is security definer to move everyone's reminders, rows locked); everyone keeping their times on the same clock moves it too (FR-009, `_same_clock`). Settings shows "Family time zone" and "My time zone" (FR-008). A family "trip" that ended by itself and a "While travelling" row were tried and dropped the same day.
