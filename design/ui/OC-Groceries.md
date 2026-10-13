# OC-Groceries — Groceries

Source `screens/OC-Groceries.dc.html` · Route `/groceries` · Specs 020, 021, 031

## Layout
1. ScreenHeader "Groceries"; sub-line "{n} items to buy · shared with family" ("1 item"); right: presence "{name} is shopping" (when someone ticked in the last 10 min).
2. Add row: input (hidden label "Add an item", placeholder "Add an item, e.g. 2 lemons") + olive square "Add item".
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
| Sync failed | the tick reverts; StatusBanner warn "Couldn't update. Try again." |

## Interactions
Tick: optimistic and realtime. Long-press or swipe a row → "Edit", "Move to…", "Remove". Add merges with an existing item, with StatusBanner "Already on the list. Updated to {total}."
