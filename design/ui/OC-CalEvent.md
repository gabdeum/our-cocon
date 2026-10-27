# OC-CalEvent — Event detail

Sources `screens/OC-CalEvent.dc.html` (interactive: checklist, Edit, Delete) and `screens/OC-CalEventDelete.dc.html` · Route `/calendar/[id]` (stack) · Spec 042

## Layout
1. Back link "Calendar".
2. Type tag (soft) "Social"; title 30/900 "Baby music class"; member chips (40) "J James".
3. White card of icon rows (olive icons, 56–60 tall): "Saturday, Oct 31" / "Morning · about 09:00–12:00"; "Every Saturday"; "Little Notes studio, 4 Elm St" + link "Open in Maps"; "Gabriel takes James"; "1 hour before" / "Shows on Home for Gabriel". Rows without a value are hidden.
4. "Bring" checklist: rows (52) with 26 checkbox; ticked = olive box + strike-through; hint "Anyone in the family can tick these."
5. "Added by Eva · 2 days ago" ("Added via Claude · 1 h ago" for AI).
6. Buttons: olive "Edit" + soft "Duplicate" (2 columns), soft "Share a view-only link", danger link "Delete event".

## Dialogs
| Trigger | Copy |
| --- | --- |
| Edit a repeating event | sheet "This event repeats" · "Change only Saturday, Oct 31, or every Saturday from now on?" · ink "This event only" · outline "All future events" · "Cancel" |
| Delete repeating | Dialog "Delete “Baby music class”?" · "Eva added this. Delete only this one, or this and all future ones? It's removed for the whole family." · danger "Only this one" · danger outline "This and all future ones" · soft "Keep it" |
| Delete one-off | "Delete “{title}”?" · "This removes it for the whole family." · danger "Delete" · soft "Keep it" (adds "{Name} added this." for someone else's event) |
| Deleted | toast "Event deleted" · "Undo" (also in Recently deleted, 30 days) |
| Duplicate | date picker, then toast "Copied to {Sat, Nov 7}" · "Undo" |
| Share | reuses OC-Share layout: title "Share this event", lead "People with the link see the title, day, time and place. No notes or checklist.", "Copy link", "Stop sharing" |
