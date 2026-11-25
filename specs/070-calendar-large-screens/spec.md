# Feature Specification: Calendar on larger screens: month, week, day

**Feature Branch**: `070-calendar-large-screens` · **Status**: Ready · **Depends on**: 063, 064, 065, 036, 037, 038, 039, 058

Screen: `design/screens/OC-CalendarResponsive.dc.html` (pass `w`/`h`/`view`: month, week, day at 390, 820, 1180). UI spec: `design/ui/OC-LargeScreens.md` § Calendar.

> Use the app's existing calendar: `CalHeader`, month grid, chips and multi-day bars, day sheet rows, week time grid, day time-of-day sections, event rows, member colours, add flow. The header at ≥ 600, the inline day panel, the mini month and "Coming up" are new. The Agenda view isn't in this spec.

## Functional requirements
- **FR-001 Compact**: unchanged (view and people behind their buttons, day sheet, floating + button).
- **FR-002 Header (≥ 600)**, two rows:
  - Row 1: title (32 px, full formats: "October", "October 25 – 31", "Sunday, October 25"), then ‹ · Today · › and the olive "+ Event" button (replaces the floating + button).
  - Row 2: the views as a segmented control (Month · Week · Day · Agenda when it exists), then, right-aligned, the **people filter as chips**: one per member + Everyone + Others. Tapping a chip shows or hides that member. A hidden member shows a pale dot, muted struck label and outlined chip. The same filter state as the phone's people menu.
- **FR-003 Month, medium**: the grid fills the width (weekday labels "Sun…Sat"). Rows 124 px; chips 20 px tall, 12 px text, 6 px padding, as many as fit then "+N"; multi-day bars at the same size. Tapping a day **selects** it (2.5 px ink inset; today keeps its olive ring) and shows the **selected-day panel under the grid**: day title, count, the same rows as the phone day sheet in **2 columns read by column**, and a dashed "+ Add on {Sun 25}" button. No sheet.
- **FR-004 Month, expanded**: rail + grid + the selected-day panel **beside** the grid (320 px, one column). Row height fills the window: `(available height − 40) / weeks`, min 96 px, so more chips fit.
- **FR-005 Week (≥ 600)**: same grid, hour height 44 px (phone 36), 52 px hour gutter with 12 px labels, day headers "Sun 25" at 18 px, event cards with 12 px "who · time" and 14 px titles; overlapping events side by side (as phone). Tapping a day works as today (spec 058) and as in Month: it opens that day's rows, reminders and add button, never Day view. Week has no inline panel, so from 600 that's the day sheet as a centred card (065). Expanded adds only the rail.
- **FR-006 Day, medium**: the phone's "who's busy" chips and all-day rows, then the time-of-day sections (Early morning → Evening) in **2 columns read by column** (063 `splitColumns`, weight = 1 + events). Empty sections keep their dashed "+ Add in the {section}".
- **FR-007 Day, expanded**: as medium, plus a 300 px side column: a **mini month** (current month; selected day ink, today olive, a 5 px dot under days with events; tap to go to that day) and **Coming up** (the next 3 days, each with weekday, date and event titles joined by " · ", or "Nothing planned"; tap opens that day).
- **FR-008** Event detail and add / edit event use 065 (centred card at ≥ 600).

## Success criteria
- **SC-001** At 820, tapping a day in Month updates the panel below without opening a sheet or moving the grid.
- **SC-002** Hiding a member with a chip hides their events in every view and is remembered like the phone filter.

## Tracking (PostHog)
| Event | Properties |
| --- | --- |
| `calendar_day_selected` | view, source (grid, mini_month, coming_up) |
| `calendar_member_filter_changed` (existing) | + source (menu, chips) |
| `add_sheet_switched` (added 2026-11-20; `mode` 2026-11-25) | to (event, reminder), mode (new, edit) |
| `calendar_item_converted` (added 2026-11-25) | from, to (event, reminder) |

## Needs your attention
- The Agenda view isn't designed for large screens yet; at ≥ 600 it can reuse the medium Day layout per day. Not in this spec.

## Changelog
- 2026-11-19: Ready.
- 2026-11-19: FR-005 changed with Gabriel: tapping a day in Week keeps today's behaviour, the same as Month (the day sheet), instead of opening Day view.
- 2026-11-20: Built. Header from 600 with the views as a segmented control (`SegmentedControl` `hug`), people chips (`MemberFilterChip`) and "+ Event", which replaces the floating add button (032-later L160). Month from 600 shows the selected day in a panel instead of the day sheet (L161): under the grid at medium (rows 124, two columns read by column), 320 beside it at expanded (rows share the height, at least 96). Week from 600: 44 px hours, "Sun 25" heads, "who · time" kept on side-by-side cards. Day from 600: bands in two columns read by column; from 960 a 300 px side column with `MiniMonth` and "Coming up" (`ComingUpRow`). New token `layout-day-aside` (300). Events: `calendar_day_selected`; `calendar_member_filter_changed` gains `source` (the spec called it `calendar_filter_changed`; it's the existing event, and the phone's popover sends `menu`). Deviations:
  - Month from 600 shows one month at a time (‹ ›, Today and a swipe page it) instead of the continuous scroll, so the panel can sit under the grid and the rows can fill the height. Paging selects today in this month, else the 1st; switching to Week or Day opens on the selected day.
  - The 058 Reminders toggle isn't drawn from 600: it sits after the views in Day and Agenda, and beside the panel's title in Month.
  - Month's first-visit hint points at the floating add button, so it doesn't show from 600 (L167).
  - The title is the longest format that fits at 32 px beside the buttons: at 600–700 a long day reads "Wed, Sep. 30".
  - The mini month shows the month of the day Day view shows (FR-007's "current month"), so it follows you into the next month.
  - Agenda from 600 gets the new header only (L166).
- 2026-11-20: After a first look (Gabriel): Month from 600 scrolls vertically like the phone (`MonthGrid` `wide`: rows 124 at medium, `max(96, (height − 40) / 5)` at expanded; `MonthPage` and the month swipe are gone), the panel under the grid (3 : 2 of the height, each scrolling) at medium and beside it at expanded; scrolling changes the title, not the selected day; ‹ › and Today still select. With everyone shown, a people chip shows only that person; tapping the last one shown shows everyone again. The phone's people menu reads "Show none" while everyone shows. The add sheet's title is a "New event · New reminder" switch on every size (`AddSheet`): the title, day, start time (a slot's first hour) and who go across, and only what changed since the last switch, so a slot or several people survive a trip to the reminder and back. New event: `add_sheet_switched` (to). An update is enough (no native change).
- 2026-11-21 (Gabriel's ask): the header's add button reads "+ New" (read "Add event"), as on Recipes and Reminders.
- 2026-11-25 (Gabriel's feedback): one sheet for events and reminders everywhere. `/reminders/new` opens the add sheet on "New reminder" (shared `NewItemSheet` with `/calendar/new`; a new reminder now gets a toast with Undo, like an event). The edit routes (`/calendar/[id]/edit`, `/reminders/[id]/edit`) render `AddSheet` with `mode="edit"`: "Edit event · Edit reminder"; saving on the other side moves the item (`convertEventToReminder` takes the dates the edit covers, as Delete does; `convertReminderToEvent` the whole series; new first, then the old deleted; Undo reverses both, leaving nothing in Recently deleted), with a warn Callout naming what won't carry over. No switch for a surprise, or a series only its creator can split. The switch now carries the repeat (a plain every day/week/month as the reminder's pill, anything else as Custom) and the notes (cut to 1000 into a reminder); one date of a series goes without its repeat. The centred card from 600 drops "Cancel" next to its ✕ (event and reminder sheets). New event `calendar_item_converted`; `add_sheet_switched` gains `mode`.
