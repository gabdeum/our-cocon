# OC-CalEvent — Event detail

Sources `screens/OC-CalEvent.dc.html` (interactive: checklist, Edit, Delete) and `screens/OC-CalEventDelete.dc.html` · Route `/calendar/[id]` (stack) · Spec 042

## Layout
1. Back link "Calendar".
2. Type tag (soft) "Social"; title 30/900 "Baby music class"; member chips (40) "J James".
3. White card of icon rows (olive icons, 56–60 tall): "Saturday, Oct 31" / "Morning · about 09:00–12:00"; "Every Saturday"; "Little Notes studio, 4 Elm St" + link "Open in Maps"; "Gabriel takes James"; "1 hour before" / "Shows on Home for Gabriel". Rows without a value are hidden.
   - When: "Morning · about 09:00–12:00" for a time of day; a custom time shows its hours ("14:30–15:30"); "All day"; several days: "Sat, Oct 31 – Mon, Nov 2".
   - Repeat: "Every Saturday", "Every Tuesday and Thursday", "Every other Saturday", "Every day", "Every month", "Every year".
   - Responsible: "{name} takes {members without the app}", or "{name} drives" when everyone on it has the app.
   - Reminder sub-line: the members with the app on the event (Everyone: all of them) and whoever takes the ones without it.
   - "Open in Maps" opens Apple Maps on iPhone, Google Maps on the web, searching for the place as typed.
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

## States not drawn (written for spec 042)
| Case | Copy |
| --- | --- |
| Duplicate's date sheet | title "Pick a date" (DateGrid); picking a day copies that date of the event there as a one-off, checklist unticked |
| Share | the link field, Message / Email / More and "Stop sharing this link" with OC-Share's states (Creating link…, Copied ✓, Not shared, Create a new link, the Stop sharing Dialog). Message, Email and More send "{title} — {link}". Not offered for a private or surprise event, or once that date is over |
| Can't open (deleted, not one of the event's dates, offline) | back link "Calendar", then "We couldn't open this event." / "It may have been deleted, or you're offline." |
| A tick failed | the box goes back; StatusBanner "Couldn't change that. Try again." |
| Delete failed | StatusBanner "Couldn't delete. Check your connection and try again."; the page stays |
| Duplicate failed | StatusBanner "Couldn't copy. Check your connection and try again." |
| Undo failed | toast "Couldn't undo. Check your connection and try again." (no button) |
| Offline | readable; the checklist, Edit, Duplicate, Share and Delete are off (Patterns.md › Offline) |
| "This and all future ones" | the dates from then on go to Recently deleted as one entry with the event's title; on the series' first date the whole event does |

## Shared event page (`/e/[token]`, not drawn)
Built like OC-SharedView: white header bar (mark, "Our Cocon", sage tag "View only"), then the title 30/900, "With James, Eva and others" ("With the whole family" for Everyone) 16/700 muted, and a white card with the When row (clock) and the place (pin). First names only; no notes, checklist, reminder or who drives.

| State | Copy |
| --- | --- |
| Link stopped, event over, deleted, made private, or that date cancelled | "This event is no longer shared." / "Ask the person who sent it for a new link." |
| Couldn't load | "We couldn't open this event." / "Check your connection and try again." · soft "Try again" |
| Loading | header bar, then skeleton blocks in surface-soft |

The page is `noindex` and sends no analytics. A link stops working once that date's event is over in the family's home time zone (a day later if the family has none yet).
