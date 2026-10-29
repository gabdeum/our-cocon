# OC-Activity — AI activity

No drawn screen: this spec is the source of truth (built from ActivityCard, PersonPill, Pill, BackHeader). Route `/activity` (stack, from Home's "See all") · Spec 026

## Layout (top → bottom)
1. BackHeader: back link "Home", title "AI activity".
2. Offline banner when offline (Undo and Restore are then off).
3. "People" overline, then a row of PersonPills: each member who has asked an AI for a change. Shown only with 2 or more. One at a time; tapping the selected one clears it.
4. "Assistants" overline, then a row of filter Pills: "Claude", "ChatGPT", "Gemini", "Other" (an assistant we can't name), only those that made changes. Shown only with 2 or more. One at a time; tapping the selected one clears it.
5. ActivityCards, newest first, gap 12: every AI change, 50 at a time, then a soft button "Show more".

## Entries
One per AI tool call (spec 026 FR-001). A private event's entries are seen only by its creator, and a surprise's never by the people it's kept from (spec 044). Titles:

| Change | Title | Sub-line verb |
| --- | --- | --- |
| Recipe added | "New: {recipe}" | Added |
| Recipe changed | "Edited: {recipe}" | Changed |
| Recipe deleted | "Deleted: {recipe}" (link "Restore" while it's in Recently deleted) | Deleted |
| Grocery items added | "{n} items added to Groceries" · "{item} added to Groceries" | Added |
| Ticked | "{n} items ticked" · "{item} ticked" | Ticked |
| Unticked | "{n} items put back on the list" · "{item} put back on the list" | Changed |
| Removed | "{n} items removed from Groceries" · "{item} removed from Groceries" | Removed |
| Done items cleared | "{n} done items cleared" · "1 done item cleared" | Cleared |
| Event added (spec 044) | "New event: {title}" | Added |
| Event changed | "Edited event: {title}" | Changed |
| Event deleted (one date, the dates after, or the whole event) | "Deleted event: {title}" (Undo for 7 days; a whole event also stays in Recently deleted for 30) | Deleted |
| Anything else | "{n} changes" · "1 change" | Changed |

Sub-line: "{verb} by {name} via {assistant} · {timeAgo}" ("just now", "12 min ago", "4 h ago", "2 days ago"); "Former member" for someone who left, "an AI assistant" for an assistant we can't name. Undo and its states as on OC-Home (States).

## States
| State | Copy and behaviour |
| --- | --- |
| Loading | Skeleton row, screen reader "Loading AI activity". |
| Load failed | Callout (warn) "Couldn't load AI activity. Check your connection and try again." and soft button "Try again". |
| No AI activity | Title "No AI changes yet", body "When an AI assistant changes something for your family, it shows up here. You can undo it for 7 days." |
| Filters match nothing | "Nothing matches these filters." |
