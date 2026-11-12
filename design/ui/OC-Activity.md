# OC-Activity — Activity

No drawn screen: this spec is the source of truth (built from ActivityRow, SegmentedControl, PersonPill, Pill, TopBar). Route `/activity` (stack, from Home's "See all activity", `?show=ai` when Home was on AI only) · Specs 026, 028

## Layout (top → bottom)
1. TopBar (spec 050): back "Back to Home", title "Activity" (`titleMode="always"`).
2. Offline banner when offline (Undo and Restore are then off).
3. SegmentedControl (pill) "All" · "AI only", opened with Home's choice. Switching to All drops the assistant pill.
4. "People" overline, then a row of PersonPills: each member who has entries (in the filter's sense). Shown only with 2 or more. One at a time; tapping the selected one clears it.
5. Under AI only: "Assistants" overline, then a row of filter Pills: "Claude", "ChatGPT", "Gemini", "Other" (an assistant we can't name), only those that made changes. Shown only with 2 or more. One at a time; tapping the selected one clears it.
6. ActivityRows, newest first, in a list: every change by the family and their assistants (or AI ones only), 20 at a time, then a soft button "Show more" ("Loading…" and off while the next 20 load; hidden once a page has fewer than 20). Live changes add to the top without dropping the pages already loaded (spec 053 FR-018 to FR-020).

## Entries
One per AI tool call (spec 026 FR-001), or one action in the app (spec 028 FR-009: a recipe and its rows within 10 minutes, a burst of grocery adds or clears, ticks within 10 minutes). A private event's entries read "a private event" for the others, and a surprise's are never seen by the people it's kept from (spec 044). Titles, "{person} {verb} {thing}":

| Change | Title |
| --- | --- |
| Recipe added · changed · deleted · restored | "Eva added Pumpkin soup" · "Eva edited …" · "Eva deleted …" (AI: link "Restore" while it's in Recently deleted) · "Eva restored …" (app only) |
| Grocery items added | "Gabriel added 6 items" · "Gabriel added Onion"; sub-line detail "from {recipe}" when they came from one |
| Ticked | "Gabriel ticked 4 items" · "Gabriel ticked Onion" |
| Unticked (AI only) | "… put back 2 items" · "… put back Onion" |
| Removed (AI only) | "… removed 2 items" · "… removed Onion" |
| Done items cleared | "… cleared 4 done items" · "… cleared 1 done item" |
| Event added · changed · deleted | "Gabriel added Pediatrician" · "… edited …" · "… deleted …" (AI: "Restore" while in Recently deleted, 30 days); "a private event" when the reader can't see it, "an event" once it's gone for good |
| One date of a repeating event deleted (AI) | "… deleted one date of Swim" |
| Anything else | "… made 3 changes" · "… made 1 change" |

Badge: the person's avatar in their color; an AI change has "AI" in a rounded square in their color with an olive ring. Sub-line: "{module} · {detail} · via {assistant} · {timeAgo}" — module Recipes, Groceries or Calendar; detail the event's day and time ("Wed, 10:00") or "from {recipe}"; "via" only for AI changes ("an AI assistant" for one we can't name); time "just now", "12 min ago", "4 h ago", "2 days ago". "Former member" for someone who left. Undo and its states as on OC-Home (States); the family's own changes have no Undo.

## States
| State | Copy and behaviour |
| --- | --- |
| Loading | Skeleton row, screen reader "Loading activity". |
| Load failed | skeleton rows stay; warn toast "Couldn't load activity. Check your connection and try again." with round Try again and ✕ (spec 053 FR-015). |
| Show more failed | the loaded entries stay; warn toast "Couldn't load more activity. Check your connection and try again." with Try again and ✕. |
| No activity | Title "No activity yet", body "When anyone in the family adds or changes something, it shows up here." |
| AI only, none | Title "No AI changes yet", body "When an AI assistant changes something for your family, it shows up here. You can undo it for 7 days." |
| Filters match nothing | "Nothing matches these filters." |

## Changelog
- 2026-11-12 (spec 053): 20 entries a page (was 50); "Show more" pages by a stable cursor and survives live updates; failures are warn toasts with Try again.
