# OC-CalAdd — Add / edit event

Sources `screens/OC-CalAdd.dc.html` (quick, interactive) and `screens/OC-CalAddMore.dc.html` (more options open, Gabriel + James + Others, Surprise) · Route `/calendar/new` (sheet) · `/calendar/[id]/edit` · Specs 041, 043, 033

## Layout (BottomSheet, scrolling body, fixed Save)
1. Handle; title "New event" (edit: "Edit event"); muted link "Cancel".
2. "What's happening?" — input 56, 18/800, placeholder "e.g. Poker night", max 60.
3. "When" — three tiles: "Today" / "Sun 25", "Tomorrow" / "Mon 26", "Other day" / "Pick a date". Selected olive.
4. "Time of day" + hint "Pick a time of day — no need for exact hours." — scrolling SlotChips (92×66): "All day" / "Whole day", "Early morning" / "06–09", "Morning" / "09–12", "Lunch" / "12–14", "Afternoon" / "14–18", "Evening" / "18–22". Under them, "Starts" / "Ends" time inputs, always shown (decided 2026-10-28, replacing the "Custom" chip): empty for All day, the picked slots' hours otherwise; typing a time makes it a custom time (no slot highlighted), and emptying both is All day.
5. "Who" — MemberChips (48): "Everyone", each member, "Others". Selected = 2.5 px ink border. Starts on Everyone (decided 2026-10-29, replacing the signed-in member); anyone can be unpicked, and Save with nobody shows "Pick at least one person." (warn, `role="alert"`) under the chips.
6. Conflict callout (warn-soft): "You already have Movie night this evening. Add anyway?"
7. "More options" (soft button; sub-label "Place, repeat, reminder…" / "Hide").
8. More options:
   - "Type": Sport · School · Work · Health · Social · Travel · Home · Birthday · Other (pills, one choice).
   - "Where": input, placeholder "Add a place".
   - "Who takes James?" (only when a member without the app is in Who) + hint "James was added by the family, so someone with the app handles this." — "Not decided yet" · "Gabriel" · "Eva".
   - "Repeat": Never · Daily · Weekly · Every 2 weeks · Monthly · Yearly. Weekly shows "On" weekday letters (S M T W T F S) and "Ends": Never · On a date · After a number of times.
   - "Reminder": None · Morning of · 1 hour before · 1 day before + hint "Shows on Home for now. Phone alerts come later."
   - "Who can see it?": Family · Private · Surprise (+ hints, see OC-CalSurprise.md).
   - "Notes": textarea, placeholder "Anything to remember"; checklist rows + "+ Add to checklist".
9. Ink "Save" 58 (disabled style until there's a title).

## States
| State | Copy |
| --- | --- |
| Save with no title | input border warn-border; "Give your event a name." (warn, `role="alert"`) |
| Saved | sheet closes; toast "{title} added for tonight, 18:00–22:00." (or "for tomorrow", "for Sat, Oct 31"; all-day: "for Sat, Oct 31") with "Undo" |
| Save failed | "Couldn't save. Check your connection and try again." (warn callout; sheet stays) |
| Undo failed (032-later L99, spec 042) | toast "Couldn't undo. Check your connection and try again." (no button); the event stays |
| Conflict | "{Name} already has {title} this {slot}. Add anyway?" ("You already have …" for yourself) |

## Copy not in the drawings (spec 041 build)
| Where | Copy |
| --- | --- |
| Saved today before 18:00 | toast "{title} added for today, {time range}." |
| Saved, all day | toast "{title} added for {Sat, Oct 31 · today · tomorrow}." (no range) |
| Typed time not a time | "Use a time like 18:30." |
| Typed end not after start | "Pick an end time after the start." |
| Save with nobody in Who | "Pick at least one person." |
| Ends: On a date | picker "Last day" (opens a date sheet "Ends on"); "Other day" opens "Pick a date" (DateGrid); the tile then shows the date ("Sat, Oct 31") |
| Ends: After a number of times | field "Times", hint "Counts this one too.", error "Use a number from 1 to 1000." |
| Checklist row | remove button "Remove {item}"; "+ Add to checklist" opens a field ("Checklist item") under the rows |
| Edit a repeating event | asks first (OC-CalEvent.md); "every day", "every other Saturday", "every month", "every year" for the other repeats |
| Event can't be opened | "We couldn't open this event." / "It may have been deleted, or you're offline." · "Cancel" |

## Rules
Adjacent slots combine (Afternoon + Evening = 14:00–22:00); a non-adjacent tap starts over; All day stands alone. Nothing picked (or the last slot unpicked) is All day. Type Birthday sets All day and Repeat Yearly (spec 035 FR-006). Ends shows for every repeat; "On" weekdays only for Weekly. "This event only" hides Repeat, Reminder and the checklist (they belong to the series). Everyone replaces members; Others adds to anything and needs no names. Member colors: `member-*` tokens; Everyone `member-everyone` (coral) with label "All"; Others `member-others` (light sand) with a person-outline icon and a `line-handle` outline. Two-member items split 50/50; initials always shown ("G·J").
