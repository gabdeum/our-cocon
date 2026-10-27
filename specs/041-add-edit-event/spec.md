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
- **FR-002 Slots**: adjacent slots can be combined; a non-adjacent tap starts a new selection; All day and Custom are exclusive; switching to Custom pre-fills the slot's times. Default when nothing is picked: All day.
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
`seconds_to_save` and `time_type` show whether quick add works; review after two weeks of use.

## Changelog
- 2026-10-25: Ready. Written from the calendar brief and the reviewed canvas (page "Our Cocon · Calendar"). Renumbered on 2026-10-26: Home and Settings for all modules are 028 and 029.
