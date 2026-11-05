# OC-CalEvent — Event detail

Sources `screens/OC-CalEvent.dc.html` (interactive: checklist, Edit, Delete) and `screens/OC-CalEventDelete.dc.html` · Route `/calendar/[id]` (stack) · Spec 042

## Layout
Compact since spec 050 FR-006: a typical event fits one 390 × 844 screen without scrolling.
1. TopBar (`titleMode="onScroll"`): round "Back to Calendar"; on the right ✎ "Edit event" and ⋯ "More actions". ⋯ opens a menu (ActionMenu): "Duplicate" · "Share a view-only link" · "Delete event" (danger). The title fades into the bar once it has scrolled under it.
2. Meta row: type tag (soft) "Social" (and "Surprise", sage, for those in on one, spec 043), then the repeat 13/800 muted with the repeat icon, "Every Saturday". Title 28/900 "Baby music class". One line: "Sat, Oct 31" 16/800 · "Morning, about 09:00–12:00" 16/700 muted.
   - When: "Morning, about 09:00–12:00" for a time of day; a custom time shows its hours ("14:30–15:30"); "All day"; several days: "Sat, Oct 31 – Mon, Nov 2".
   - Repeat: "Every Saturday", "Every Tuesday and Thursday", "Every other Saturday", "Every day", "Every month", "Every year".
3. One white card of compact rows (52), each one line, its second part muted after " · ". Rows without a value are hidden.
   - Who: the member dots, "James · Gabriel takes James", car icon at the end. The names are joined ("James and Mia"); the responsible part is "{name} takes {members without the app}", or "{name} drives" when everyone on it has the app, and is left out (with the car) when nobody is responsible. Names, not pronouns: the app doesn't know anyone's.
   - Place: pin, "Little Notes studio, 4 Elm St", soft pills "Copy" (read as "Copy {place}") and "Maps" (read as "Open {place} in Google Maps"), 8 apart. "Copy" puts the place as typed on the clipboard, then the toast "Address copied" ("Couldn't copy the address." in warn if it fails). "Maps" opens Google Maps (the app on iPhone when installed), searching for the place as typed.
   - Reminder: bell, "1 hour before · reminds Gabriel · 08:00" (spec 049 FR-006): the people the phones remind (spec 049 FR-003) and when, in the home time zone and the member's clock; "1 day before" reads "· reminds Gabriel · 18:00 the day before". No names (a private event of someone without the app): "1 hour before" alone.
4. "Bring" card: heading 16/900 with "{ticked} of {total}" (13/700 muted) on the right; rows 44 with a 24 checkbox; ticked = olive box + strike-through.
5. "Added by Eva · 2 days ago · anyone can tick the list" 13/700 muted ("Added via Claude · 1 h ago" for AI; the last part only when there is a list).

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
| Share (from ⋯) | the link field, Message / Email / More and "Stop sharing this link" with OC-Share's states (Creating link…, Copied ✓, Not shared, Create a new link, the Stop sharing Dialog). Message, Email and More send "{title} — {link}". Not offered for a private or surprise event, or once that date is over |
| Can't open (deleted, not one of the event's dates, offline) | TopBar with "Back to Calendar" and no title, then "We couldn't open this event." / "It may have been deleted, or you're offline." |
| A tick failed | the box goes back; StatusBanner "Couldn't change that. Try again." |
| Delete failed | StatusBanner "Couldn't delete. Check your connection and try again."; the page stays |
| Duplicate failed | StatusBanner "Couldn't copy. Check your connection and try again." |
| Undo failed | toast "Couldn't undo. Check your connection and try again." (no button) |
| Offline | readable; the checklist, ✎ and ⋯ are off (Patterns.md › Offline) |
| "This and all future ones" | the dates from then on go to Recently deleted as one entry with the event's title; on the series' first date the whole event does |

## Shared event page (`/e/[token]`, not drawn)
Built like OC-SharedView: white header bar (mark, "Our Cocon", sage tag "View only"), then the title 30/900, "With James, Eva and others" ("With the whole family" for Everyone) 16/700 muted, and a white card with the When row (clock) and the place (pin). First names only; no notes, checklist, reminder or who drives.

| State | Copy |
| --- | --- |
| Link stopped, event over, deleted, made private, or that date cancelled | "This event is no longer shared." / "Ask the person who sent it for a new link." |
| Couldn't load | "We couldn't open this event." / "Check your connection and try again." · soft "Try again" |
| Loading | header bar, then skeleton blocks in surface-soft |

The page is `noindex` and sends no analytics. A link stops working once that date's event is over in the family's home time zone (a day later if the family has none yet).

## Changelog
- 2026-11-04 (spec 050 FR-006): compact layout. ✎ and ⋯ in the TopBar replace the Edit, Duplicate, Share and Delete buttons; the repeat moves beside the tag; date and time share one line; who, place and reminder are one-line 52 rows in one card; the Bring card shows its count and 44 rows; "anyone can tick the list" joins the Added line. Kept from spec 049: the reminder's time. The drawing's "takes him" reads "takes James".
- 2026-11-05 (Gabriel's ask): the place gets a "Copy" pill beside "Maps", and "Maps" opens Google Maps on the iPhone too (it was Apple Maps).
