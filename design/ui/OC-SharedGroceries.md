# OC-SharedGroceries — Shared grocery list (public page)

Not drawn · Route `/g/[token]` (no account, no tab bar) · Spec 072 · Built like OC-SharedView and OC-Groceries

## Layout
1. White header bar as OC-SharedView: logo mark + "Our Cocon". The sage tag reads "Shared list", or "View only" with editing off.
2. Title "Groceries", sub-line "From the {family} family · ends today at 23:59" (or "ends Sunday at 23:59", nothing for Until I stop).
3. The aisles as on OC-Groceries: Overline per aisle, ListGroup of ListRows with the checkbox, name, amount and note. No source line, no recipe cards.
4. With editing on: an add field under the title, "Add an item, e.g. 2 lemons" + olive "+" (the page has no pinned bar). Tapping a row ticks it; its ✕ (screen reader "Remove {name}"), a long-press or a swipe removes it at once, with Undo in the toast.
5. Ink promo card at the end, as OC-SharedView: "Run your home from one place" · "Our Cocon keeps your family's recipes, groceries and calendar together." (no button).

## States
| State | Copy |
| --- | --- |
| Loading | header bar, then skeleton rows |
| Link stopped, ended or unknown | title "This list is no longer shared." and body "Ask the person who sent it for a new link." |
| Couldn't load | title "We couldn't open this list.", body "Check your connection and try again.", soft button "Try again" |
| Empty | "The list is empty." (with editing on, also "Add what you need above.") |
| Removed | toast "Removed {name}." with "Undo" |
| A write failed | warn toast "Couldn't update. Try again." |
| Editing turned off while open | the next write shows the warn toast "The list is view only now." and the page refetches |
| Too many adds (FR-004) | warn toast "Too many changes for now. Try again later." |

## Notes
The page is `noindex`. Family members see guest rows as "Added via the shared link".
