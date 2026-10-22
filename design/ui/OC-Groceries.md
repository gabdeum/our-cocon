# OC-Groceries — Groceries

Source `screens/OC-Groceries.dc.html` · Route `/groceries` · Specs 020, 021, 031

## Layout
1. ScreenHeader "Groceries"; sub-line "{n} items to buy · shared with family" ("1 item"); right: presence "{name} is shopping" (when someone else ticked in the last 10 min; never yourself).
2. Add row: input (hidden label "Add an item", placeholder "Add an item, e.g. 2 lemons") + olive square "Add item"; hint below the input "Long-press an item to edit, move or remove it.".
3. Store row: "Store sizes:" + pill segmented "US" · "Europe" + link "Set in Settings" (hidden when "Round up to store sizes" is off).
4. One soft card per linked recipe: thumb, "For {recipe}", "{n} items · serves {n}", link "Open".
5. Aisle groups in catalog order (spec 031): overline aisle name; white list group; rows:
   - checkbox · name (800) · source sub-line ("For {recipe}" / "Added by {name}" / "{name} via {assistant}")
   - trailing: "Buy {pack}" (15/900) over "Need {amount} · {leftover}" (12/700); "Need {amount}" only when no pack is known or round-up is off; nothing when there's no quantity
6. Footnote "Buy is what to pick up at the store. Need is what your recipes call for." ("Buy" and "Need" bold)
7. TabBar (Groceries active).

## Aisles (fixed order)
Produce · Bakery · Dairy & eggs · Meat & fish · Dry goods · Spices & baking · Frozen · Drinks · Household · Other

## States not drawn
| State | Copy |
| --- | --- |
| Empty list | "Your list is empty." · "Add items above, or from any recipe with “Add to groceries…”." |
| One or more ticked | Soft button "Clear done items" at the end of the list. Pressing it removes ticked items and shows StatusBanner "Cleared {n} items" with "Undo". Nothing is cleared automatically. |
| Item in Other | row long-press menu "Move to…" with the aisle list; the choice is remembered for the family |
| Sync failed | the tick reverts; StatusBanner warn "Couldn't update. Try again." (also when Clear, Remove, Undo, Edit or Move to… fails) |
| Add failed | StatusBanner warn "Couldn't add this item. Try again." (the text stays in the field) |
| Merged, no amount | StatusBanner "Already on the list." |
| Removed | StatusBanner "Removed {name}." with "Undo" |
| Loading failed | Callout warn "Couldn't load the list. Check your connection and try again." · soft button "Try again" |
| Offline | the offline StatusBanner; adding, ticking, the row menu and "Clear done items" are off |

## Interactions
Tick: optimistic and realtime. Long-press or swipe a row → "Edit", "Move to…", "Remove". Add merges with an existing item, with StatusBanner "Already on the list. Updated to {total}."

## Row menu (spec 020, not drawn)
A BottomSheet "Edit item" (close label "Close") that opens straight on the edit field: TextField "Item" with hint "An amount and a name, e.g. 2 lemons or 100 g Gruyère", starting from "{amount} {name}". Below it, ListRows "Move to…" (chevron, after the current aisle's name) and "Remove". Footer "Cancel" · "Save". The row's screen-reader actions are "Edit" (opens this sheet), "Move to…" and "Remove"; right-click or the keyboard's menu key also opens it on the web.
- **Move to…:** sheet title "Move to…", lead "{name} will go here from now on, for your family."; one radio row per aisle in the fixed order, the current one selected. Tapping one moves it and closes.
- **Merging** only joins an item still to buy whose amount adds up (both weights, volumes or counts); otherwise the new item gets its own row.
- The recipe card is tappable as a whole (Card rule); "Open" is its olive label.
