# 057 — Reminders screens: Home card, Reminders list, drawer, create/edit

**Status**: Ready · **Depends on**: 056, 028 (Home), 036 (tab bar v2)

Screens: `design/screens/OC-HomeReminders.dc.html` (card only), `OC-Reminders.dc.html`, `OC-ReminderDrawer.dc.html`, `OC-ReminderEdit.dc.html`. UI spec: `design/ui/OC-Reminders.md` (binding for structure and copy).

> The screen sources draw a placeholder tab bar, back button and Home. Use the app's existing `TabBar`, `ScreenHeader`, `BottomSheet`, `SegmentedControl`, `Pill`, `Switch`, `TextField` and member colours. Only the parts listed below are new.

## Functional requirements
- **FR-001 Home card** (`RemindersCard`). Inserted on Home directly under the greeting, above the calendar card. Nothing else on Home changes. Header "Reminders" + the green "+" (same as the calendar card) → create sheet. Shows `reminders_home` (top 3). Row: tick box · member dot · title + one detail line · late badge · vertical ⋮. Footer row "See all reminders" + "{n} more today · {n} snoozed" → Reminders screen. Ticking a row keeps it struck through until Home is left, then the next one moves up. Hidden when the household has no reminders at all (shows nothing, not an empty card).
- **FR-002 Home ⋮ menu**: Snooze until (In 1 hour when timed · Tomorrow · Next week · Next month) · Pick a date… (opens the drawer) · Edit · Delete reminder.
- **FR-003 Reminders screen** (`/reminders`, from the Home card and the calendar). Title, back. SegmentedControl "Mine" / "Everyone's" (Mine = assigned to me or Everyone; remembered per device). Sections Overdue · Today · Tomorrow · Later, each loading with `reminders_section` and a "Show more · {n} more" row when `next_cursor` exists. "Snoozed" collapsed row at the end with its count. Olive "+" floating button → create sheet. Empty state: "Nothing to remember. Nice." + "New reminder" button.
- **FR-004 Row** (list): tick box · member dot · title (1 line, ellipsis) · detail line with repeat icon and notes icon when present · late badge · vertical ⋮. Tapping the row or ⋮ opens the drawer.
- **FR-005 Drawer** (`ReminderDrawer`, BottomSheet): title, "Edit", member pill + when line ("Every Monday · was due Mon, Nov 9"); late callout when late (with the missed count, e.g. "Last week's (Mon, Nov 2) was missed too."); Notes card (text, or "+ Add a note"); Snooze until grid; "Mark as done"; "Delete reminder" (repeating: confirm "Delete all future reminders?"). After done/snooze: green confirmation with Undo and Close.
- **FR-006 Create / edit sheet**: "Remind us to…" (required), Due (Today / Tomorrow / Other day — always required), "Set a time" switch + time, "If it's not done" (Every hour only when a time is set · Next day · Next week · Leave it), Repeat (Never / Every day / Every week / Every month / Custom → the event repeat picker from 041), For (members + Everyone; default = me), Notes (optional), live notification summary line (059 copy), Save. Edit uses the same sheet with "Delete reminder" at the bottom.
- **FR-007** Every tick, snooze and save is optimistic and syncs live (056 FR-011).

## Success criteria
- **SC-001** With 200 reminders, the Reminders screen renders the first page in one request per visible section, and "Show more" loads 20 more without refetching earlier pages.
- **SC-002** Home card, list rows and drawer match the screen sources (spacing, copy, colours) on iPhone 15 and the web layout.

## Tracking (PostHog)
| Event | Properties |
| --- | --- |
| `reminder_created` | has_time, repeating, rollover, has_notes, assignee_is_self |
| `reminders_list_viewed` | filter (mine, everyone) |
| `reminders_show_more` | section |
| `reminder_drawer_opened` | source (home, list, calendar) |

## Warnings and errors
Copy in `design/ui/OC-Reminders.md`.

## Needs your attention
- The card goes above the calendar card on Home. Move it if you'd rather have it below.
- The sheet's notification line follows the screen's four sentences, which simplify 059's nudges: "Next day" or "Next week" with a time says nothing after the due time, and "Next week" without one says "each morning" (032-later L149, with 059).
- The Reminders screen has no tab bar: like every pushed screen (spec 002), so its "+" sits 28 from the bottom instead of above the tab bar.
- Reminders aren't in Home › Latest activity yet (032-later L144, with 060).

## Changelog
- 2026-11-15: Ready.
- 2026-11-16: Built. Home's Reminders card under the greeting (top 3, ⋮ menu: snooze times, Pick a date…, Edit, Delete reminder; hidden when the family has no open reminder), `/reminders` (Mine · Everyone's remembered per device, Overdue, Today, Tomorrow, Later with "Show more", Snoozed, the "+", the empty state; `?open={id}` opens a drawer), the drawer, and the new/edit sheet (`/reminders/new`, `/reminders/{id}/edit`, `?focus=notes` from "+ Add a note"). Ticks, snoozes and deletes are optimistic; ticked rows stay struck through until the screen is left. The four Tracking events; the app also sends 056's `reminder_completed` and `reminder_snoozed` (source home, list, drawer). New in the design system: ReminderRow (with MemberPill and ReminderMore), TimeField and the `note` icon; ActionMenu gained a heading, item details, separators and a ⋮ trigger, CalCard's footer a hint, DayChip a start-aligned look. Also 032-later L147: reminders in Recently deleted. Fixed a 056 gap: `reminders` wasn't in the app's live tables, so ticks didn't reach other phones. Deviations:
  - "Show more" has no "{n} more", and rows don't say "missed last week too" (the lists are pages without totals or missed counts; the drawer says it) (L150). "Every 3 months" can't be made (no repeat interval); Custom offers the event repeats, and a monthly repeat reads "Every month" (L151).
  - The summary line uses the viewer's clock and quiet hours 22:00–07:00 until 059 (L149). `?open={id}` finds only reminders on the loaded pages (L148).
  - Home's rows open nothing when tapped (the screen draws no button there); the drawer opens from ⋮ › Pick a date…. The calendar's way in, and `reminder_drawer_opened` with `calendar`, come with 058.
  - The drawer's 18 px cards use the 16 px radius token; a one-off's "Done" card has no second line (the screen's "The next one stays on schedule." is for repeats). Dates read "Back tomorrow, Thu, Nov 12", as dates do everywhere else. Copy written for the build is in OC-Reminders.md › "Written for the build".
- 2026-11-16 (058): Home's ⋮ menu and the list's ⋮ are gone; a row (right of its dot) opens the drawer, on Home too (FR-002 now lives in the drawer). Ticked reminders go to the bottom of Today and stay there until midnight, after a reload too; Home drops them once left or reloaded (FR-001). The drawer's who pill is no longer clipped, and the lists lost their extra padding. See 058's Changelog.
- 2026-11-16 (058): the collapsed Snoozed row is gone: snoozed reminders are in the section of the day they're back, with a "Snoozed" pill, and can be ticked.
- 2026-11-16 (with 059): Fix. The Reminders screen sometimes loaded forever: switching Mine ↔ Everyone's back to a list loaded in the last 30 s (or opening the screen again within 30 s) found it still fresh in the cache, so nothing was fetched and 058's "only once fetched again" never came. Lists shown that way (the screen's and Home's) are now fetched each time a screen opens or switches (`FETCH_ON_OPEN`, `staleTime: 0`).
