# Feature Specification: Add and edit an event

**Feature Branch**: `041-add-edit-event` · **Status**: Ready · **Depends on**: 033, 034, 035
**Input**: One bottom sheet to add an event in about three taps, with more options folded away.
**Design**: canvas `OC-CalAdd` (quick, conflict), `OC-CalAddMore` (more options, surprise); components BottomSheet, TextField, SlotChip, DayChip, MemberChip, Callout (warn), Pill, SegmentedControl, ChecklistRow, Toast.

## User Scenarios & Testing

### User Story 1 — Three taps (P1)
**Given** the sheet, **When** I type "Poker night", tap Today, tap Evening and Save, **Then** the sheet closes and the toast reads "Poker night added for tonight, 18:00–22:00." with Undo.

### User Story 2 — Details (P1)
**Given** "More options", **When** I pick Who = Gabriel + James, Repeat Weekly on Saturday, Where, and "Who takes James?" = Gabriel, **Then** every Saturday shows the event in both colors.

### User Story 3 — Soft conflict (P2)
**Given** I already have Movie night this evening, **When** I pick Evening, **Then** a warn callout says "You already have Movie night this evening. Add anyway?" and Save still works.

### Edge cases
- Save tapped with no title: field border turns warn and "Give your event a name." appears; nothing else is lost.
- Editing a repeating event asks first: "This event repeats — This event only / All future events / Cancel".

## Requirements

- **FR-001 Order**: title "New event" (or "Edit event"), "Cancel"; "What's happening?" field (keyboard opens immediately, max 60); "When": Today, Tomorrow, Other day (date picker), each with its date; "Time of day" hint "Pick a time of day — no need for exact hours." and a scrolling row of SlotChips (All day, five slots with hours, Custom "Pick times"); "Who"; conflict callout; "More options"; ink "Save".
- **FR-002 Slots**: adjacent slots can be combined; a non-adjacent tap starts a new selection; All day stands alone. Starts / Ends are always shown under the slots and show their hours; typing there makes a custom time (changed 2026-10-28, replacing the Custom chip). Default when nothing is picked: All day.
- **FR-003 Who**: MemberChips for every member, then Everyone and Others. The creator is preselected. Everyone replaces individual members; Others can be combined with anything and needs no names.
- **FR-004 More options** (collapsed, sub-label "Place, repeat, reminder…"): Type (Sport, School, Work, Health, Social, Travel, Home, Birthday, Other); Where (text, opens Maps from detail); **"Who takes {names}?"** shown only when Who includes a member without the app (spec 033), choices "Not decided yet" and each account member, hint "{names} was added by the family, so someone with the app handles this."; Repeat (Never, Daily, Weekly + weekday picker, Every 2 weeks, Monthly, Yearly; Ends Never / On a date / After a number of times); Reminder (None, Morning of, 1 hour before, 1 day before) with hint "Shows on Home for now. Phone alerts come later."; Who can see it (spec 043); Notes + checklist ("+ Add to checklist").
- **FR-005**: Save is enabled as soon as there's a title; without one it's styled disabled and shows the error on tap.
- **FR-006 Conflicts**: from `findConflict` (spec 034); never blocks; wording "{Name} already has {title} this {slot}." ("You already have …" for the creator).
- **FR-007 Pre-fill**: opened from a day, slot row or week cell, the sheet starts on that day and slot.
- **FR-008 Edit**: same sheet with values filled; repeating events ask for scope first (spec 042 dialog).
- **FR-009 Toast**: "{title} added for {tonight | tomorrow | Sat, Oct 31}, {time range}." with Undo (5 s), above the tab bar. Undo deletes it without a trace in Recently deleted.

## Tracking (PostHog)
| Event | Properties |
| --- | --- |
| `event_created` | source (app/assistant), time_type (slot/all_day/custom), slot, member_count, has_repeat, used_more_options, seconds_to_save |
| `event_updated` | fields_changed, scope |
| `event_conflict_shown` | proceeded (bool) |
| `event_create_undone` | — |

## Warnings and errors
All copy (labels, hints, error, conflict, toast) is in `design/ui/OC-CalAdd.md`. Save failed: "Couldn't save. Check your connection and try again." (sheet stays open).

## Needs your attention
- `seconds_to_save` and `time_type` show whether quick add works; review after two weeks of use.
- Choices made where the spec is silent (say if you want them changed):
  - "All future events" starts a new series from that date. Whoever does it becomes the new series' "Added by". Only the creator can do it for a private or surprise event; anyone else editing one of those changes that date only.
  - Choosing Birthday sets All day and Repeat Yearly (birthdays must be both, spec 035).
  - Choosing Weekly picks the start day, so you see which day it repeats on.
  - Offline, Save is greyed out like the rest of the app (decision 11).
- New copy, added to OC-CalAdd.md:
  - The toast says "today" for today before 18:00, and has no time for all-day events.
  - Custom time errors: "Use a time like 18:30." and "Pick an end time after the start."
  - Ends: "Last day", and "Times" with "Counts this one too.".
  - The scope question's wording for daily, every 2 weeks, monthly and yearly repeats.
  - "We couldn't open this event." when an edit link doesn't work.

## Changelog
- 2026-10-25: Ready. Written from the calendar brief and the reviewed canvas (page "Our Cocon · Calendar"). Renumbered on 2026-10-26: Home and Settings for all modules are 028 and 029.
- 2026-10-28: Built.
  - **The sheet:** `/calendar/new` and `/calendar/[id]/edit` are sheets over the calendar, in the order of FR-001 and OC-CalAdd, with every string in `strings.calendar.add`.
    - The keyboard opens on the title.
    - Save keeps the disabled look until there's a title and explains on tap (no `aria-disabled`: react-native-web would block the tap).
    - Slots combine as the screen does (FR-002). Who follows FR-003.
    - The day, slot or hour comes from the link, checked with the schemas (FR-007, 032-later L91).
  - **Conflicts:** worded from the engine's new `conflictWho` on the day's occurrences as you may see them (a private one reads "Busy"). They never block (FR-006).
  - **Toast and Undo:** the ink Undo toast lasts 5 s over any tab, and the calendar's "+" hides meanwhile (032-later L96). Undo deletes the event and removes it for good, so it never reaches Recently deleted (FR-009).
  - **Edit (FR-008):** a repeating event asks "This event repeats" first.
    - "This event only" saves that date's change (merged with any earlier one).
    - "All future events" ends the series the day before and starts a new one in one database call (`split_event`, engine `splitSeries`). Cancelled dates stay cancelled and a repeat's remaining count carries over.
  - **New components:** SlotChip, DayChip, MemberPickerChip, UndoToast, ChecklistRow (and ChecklistAdd), DateGrid, WeekdayPicker and DisclosureButton. Button gains `inactive`, TextField a `title` size, and BottomSheet `fieldFocus`.
  - **Events:** `event_created`, `event_updated` (field names only, and only when something changed), `event_conflict_shown`, `event_create_undone`.
  - **Deviations:**
    - "Who can see it?" comes with 043; an edit keeps the event's visibility and surprise.
    - The date sheet (DateGrid) for "Other day" and "Ends: On a date" isn't drawn.
    - Ends shows for every repeat, and "On" weekdays only for Weekly (Every 2 weeks repeats on the start day).
    - "This event only" hides Repeat, Reminder and the checklist: one date can't carry them (032-later L97).
  - **After the security review:**
    - Only the creator splits a private or surprise series or changes who sees it.
    - The old series must end before the new one.
    - Tests cover assistants, the hidden person and other events' exceptions.
    - A hidden person reaching the edit sheet by its link is left to 043 (032-later L101).
- 2026-10-28 (after review with Gabriel): no Custom chip. Starts / Ends always show under the slots (empty for All day, the slots' hours otherwise), and typing there makes a custom time. Who can be emptied; Save then says "Pick at least one person." Who already starts on the signed-in member. Copy added to OC-CalAdd.md.
- 2026-10-29: Who starts on Everyone (was the signed-in member) and lists Everyone first.
