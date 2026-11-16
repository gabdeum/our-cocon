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

## Changelog
- 2026-11-15: Ready.
