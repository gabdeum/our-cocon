# OC-Reminders — Home card, Reminders screen, drawer, create/edit, agenda rows, Lock Screen

Specs 056–060. Sources in `design/screens/`:

| Source | What it is | What's new |
| --- | --- | --- |
| `OC-HomeReminders.dc.html` | The Home card only (350 px wide) | All of it. Slot it into the existing Home under the greeting. |
| `OC-Reminders.dc.html` | Reminders screen (`/reminders`) | All of it, except the tab bar and back button (use `TabBar` v2 and `ScreenHeader`). |
| `OC-ReminderDrawer.dc.html` | The drawer (BottomSheet content) | All of it. |
| `OC-ReminderEdit.dc.html` | Create / edit sheet | All of it. Reuse `TextField`, `Switch`, `Pill`, person chips from 041. |
| `OC-CalAgendaReminders.dc.html` | Agenda with reminders | Only the reminder rows and the "Reminders" pill. Header, event rows, FAB and tab bar are placeholders for what you already have. |
| `OC-NotifLockTodo.dc.html` | Lock Screen notifications | Content and order only. |

Use the design-system tokens (Honey & Olive, Nunito, member colours). Values in the sources are the same tokens written out.

## Reminder row (Home card and Reminders screen)
Height ≥ 58, padding 4 px 0, divider `#F2E6C4` 1.5 px between rows. Left to right, no gaps beyond these:
1. Tick box: 24 × 24, radius 8, border 2.5 `#CDBF95` on white; done = olive fill + white check. Tap target 40 × 44.
2. Member dot: 28 px circle in the member colour, initial 13/900 ("All" 10/900). 50 % opacity when done.
3. 10 px, then title 16/800, one line, ellipsis (done: struck through, `#5A503A`); detail line 13/700 `#5A503A`, one line, ellipsis. On the Reminders screen the detail line starts with the repeat icon and/or notes icon (14 px) when they apply.
4. Late badge (only when late): 12/900, padding 3 × 8, `#FFE3C2` / `#8A4B00`, "2d late", "3h late".
5. No ⋮ (spec 058). Everything right of the dot (title, detail, late badge) opens the drawer, on Home and the Reminders screen.

## Home card
- Header: "Reminders" 20/900 + green "+" (44 px olive circle, white plus, same as the calendar card) → create sheet.
- Top 3 rows (056 `reminders_home`).
- Footer row (border-top): "See all reminders" 15/800 olive · right "{n} more today · {n} snoozed" 14/700 + chevron. Parts drop when zero; if both are zero it reads just "See all reminders".
- Spec 058: no ⋮ menu. Tapping a row (right of the dot) opens its drawer, where snooze, edit and delete are. (057 had a glass menu here: snooze times, Pick a date…, Edit, Delete reminder.)

## Reminders screen
- Title "Reminders" with back; SegmentedControl "Mine" · "Everyone's".
- Section titles 18/900: "Overdue" (`#8A4B00`), "Today · Wed, Nov 11", "Tomorrow · Thu, Nov 12", "Later". Each section is a white card, radius 22.
- Pagination row inside the card, after the last row: "Show more" 15/800 `#424D17` · right "{n} more" 14/700.
- Spec 058: no "Snoozed" row. A snoozed reminder is listed in the section of the day it's back (Today, Tomorrow, Later), by when it's back, with a "Snoozed" pill (12/900 ink-muted on surface-soft) where "2d late" goes and the detail "Back tomorrow, Thu, Nov 12" / "Back Sun, Nov 22" / "Back at 16:00"; it has a tick box like the others. (057 folded them into a collapsed "Snoozed" row.)
- Olive floating "+" 60 px, bottom right above the tab bar.
- Empty: "Nothing to remember. Nice." 17/900 + ink pill "New reminder".

## Drawer
BottomSheet, cream, radius 30 top. In order:
1. Title 24/900 + "Edit" link.
2. Member pill (member colour) + when line 15/700: "Every Monday · was due Mon, Nov 9" / "Today at 15:00 · nudges every hour until done" / "Today, any time".
3. Late callout (`#FFE3C2`, radius 16, info icon): "{n} days late." + " Last week's ({date}) was missed too." / " Missed {n} times since {date}." when > 1.
4. Notes card (white, radius 18): "Notes" 16/900 (no edit link: notes are edited through "Edit" at the top); text 15/600, line breaks kept. No notes: "+ Add a note" (`#424D17`).
5. "Snooze until" 16/900, 2-column grid of 60 px tiles (label 16/900, date 13/700); selected = olive.
6. "Mark as done" olive 56 px button with check. "Delete reminder" `#9A3412` text button.
7. After an action: green card (`#D9E3A8`) "Done. Nice one." + "Next one: Mon, Nov 16. The missed weeks stay in its history." / "Snoozed until {date}" + "It's hidden until then and comes back without a late badge." Then "Undo" (cream) · "Close" (olive).

## Create / edit sheet
Title "New reminder" / "Edit reminder", "Cancel". Fields in order: "Remind us to…" (placeholder "e.g. Pay the daycare") · "Due" (Today / Tomorrow / Other day) · "Set a time" switch + time field · "If it's not done" pills + hint line · "Repeat" pills · "For" person chips · "Notes · optional" textarea (placeholder "Details, a phone number, what to ask…", 1000 chars) · notification summary (bell, `#FFF0C9`) · "Save".

Hint lines under "If it's not done":
- Every hour: "Stays on Home and nudges every hour until someone ticks it."
- Next day: "Moves to the next day and shows how late it is. The due date doesn't change."
- Next week: "Moves to the same day next week, with a late badge."
- Leave it: "Stays on its due day in the calendar. No more nudges."

Notification summary: "Notifies {name} at {time − 1 h} and {time}, then every hour until done. Quiet from 22:00 to 07:00." / without time: "Notifies {name} at 09:00 on the day, then each morning while it's late." Uses the recipient's quiet hours and time format.

Errors: empty title → "Give your reminder a name." (`#8A4B00`, under the field). "Every hour" chosen then time switched off → rollover silently becomes "Next day".

Written for the build (spec 057, not drawn):
- A time typed on the web that isn't one → "Use a time like 15:00." under the "Set a time" row.
- "Custom" in Repeat shows the event sheet's repeats (Daily, Weekly, Every 2 weeks, Monthly, Yearly) and its On / Ends card (OC-CalAddMore).
- Deleting a repeating reminder (drawer, the edit sheet): Dialog "Delete all future reminders?" · "Every date of “{title}” goes. You can bring it back from Recently deleted for 30 days." · "Delete reminder" / "Keep it". A one-off is deleted at once, with the toast "Reminder deleted" and Undo.
- Late under a day, in the drawer: "{n} hours late." A repeat that isn't weekly, missed once: " The one on {date} was missed too."
- After "Mark as done" on a one-off reminder the green card has its title only; a repeat with no next date says "The next one stays on schedule."
- A reminder that was deleted or finished while its edit sheet opened: the toast "This reminder was deleted." and the sheet closes.
- (057) The Snoozed row counted the first page; gone with spec 058.
- Loading: "Loading reminders". A failed save: the toast "Couldn't save. Try again." (056).
- Recently deleted lists reminders too: restored → "“{title}” is back in your reminders."; its empty line reads "Recipes, events and reminders you delete stay here for 30 days." (OC-Menu.md).

## Agenda rows
Reminder row = tick box (26 px, radius 8) in place of stripe + avatar; title 17/800; detail "{time or Any time} · {name}"; late badge on the right. Toggle "Reminders": a round 44 alarm button, on = olive/white, off = white (see below).

Written for the build (spec 058, not drawn):
- The "Reminders" toggle is a round 44 icon button (`alarm`, named "Reminders"), olive when on and white when off. In Agenda and Day it sits after the people button in the header's second row, where ‹ › were (Day swipes; Agenda scrolls and has Today). Month and Week have no toggle in the header: days with reminders get a small `alarm` beside the date number (13 px in Month, 17 in Week: a little larger than the number). When there's no room beside the number: in Month that one day puts it on its first row (its chips start one row lower, and a multi-day bar in the top lane skips that day); in Week every day's clock goes under its number, so the week's heads stay even, and their day sheet lists the reminders with the same toggle beside its title. One setting, remembered per person on this device, for all of them.
- The day sheet (Month, and since 058 Week: a tap on a day opens it, not Day view) lists the day's reminders among its events in Agenda's order; its count reads "2 events · 1 reminder", or "1 reminder".
- A late reminder brought to today reads "{name} · was due {Mon}" ("was due yesterday", "was due Mon, Nov 2" from a week back), as on the screen.
- Day view: late and any-time reminders are under "All day", after the all-day events (late ones first); timed ones in the band of their time among the events. A band with only reminders has no "+ Add in the …" row.
- A later repeat's box, pressed before its day: the toast "Not yet: it's due Sat, Nov 14." Its screen-reader name is "Not yet: {title}".
- Screen readers read a row as "{title}, reminder, {detail}, {late badge}".
- Done today (spec 058): a ticked reminder goes to the bottom of Today, struck through ("Done just now"), and stays there until midnight, after a reload too ("Done at 15:20"), on the Reminders screen and in the calendar (Agenda's Today, Day view's "Done" group after the bands, the day sheet). Wherever it was ticked from (Overdue, Tomorrow…), it's listed under Today. A repeat's next date shows as usual. Ticking it again undoes it. Home drops it once it's left or reloaded. Month and Week marks count only what's still to do.
- The drawer's who pill and when line sit just under the title (057's −10 px pull made the list clip the pill). Sheet titles and their right button (✕, "Edit") are centred on each other (BottomSheet README).
- A late "Next week" reminder rests, snoozed, between its weekdays: listed on its next weekday (usually under Later) with the "Snoozed" pill and "Back Sun, Nov 22" (at its time), then Overdue again that day, on Home with its late badge (Gabriel, 2026-11-16: under Overdue all week but missing from Home looked like a bug). Nothing is written; a real snooze still wins. Home's footer counts it in "{n} snoozed".
- Online, reminders show once fetched since the screen opened (not the copy saved for offline, which can be hours old): Home's card appears when its list is in, the Reminders screen says "Loading reminders" until then. Offline, the saved copy shows, read-only.
- The Reminders screen's lists are plain white cards (radius 22, padding 0 14): no extra space above, below or between rows.

## Lock Screen
Order newest first. Titles: "In 1 hour: {title}", "Now: {title}", "Still to do: {title}". Long-press actions: "Done" · "In 1 hour" · "Tomorrow".
