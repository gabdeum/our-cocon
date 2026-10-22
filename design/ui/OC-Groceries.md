# OC-Groceries — Groceries

Source `screens/OC-Groceries.dc.html` · Route `/groceries` · Specs 020, 021, 031

## Layout
1. ScreenHeader "Groceries"; sub-line "{n} items to buy · shared with family" ("1 item"); right: presence "{name} is shopping" (when someone else ticked in the last 10 min; never yourself).
2. Add row: input (hidden label "Add an item", placeholder "Add an item, e.g. 2 lemons") + olive square "Add item" + square IconButton (settings icon) "Grocery settings", which opens the Grocery settings sheet. No hint under the input.
3. One soft card per linked recipe: thumb, "For {recipe}", "{n} items · serves {n}", link "Open".
4. Aisle groups in catalog order (spec 031): overline aisle name; white list group; rows:
   - checkbox · title line "{name}: {to buy}" (800) then " (need {amount})" (15/600 ink-muted) · source sub-line ("For {recipe}" / "Added by {name}" / "{name} via {assistant}")
   - the title line reads "Heavy cream: 1 pint carton (need 300 ml)"; "(need …)" is left out when what to buy is exactly what's needed ("Pumpkin: 1 kg loose", "Lemon: 2 pieces"); counts always say pieces ("1 piece", "2 pieces", "½ piece"). The name is the catalog's singular when it's the same word as typed ("2 lemons" → "Lemon"); a name the matcher only got close to stays as typed ("Meyer lemons"); "Heavy cream: 300 ml" when no pack is known or round-up is off; just "Salt" when there's no quantity. No leftover is shown.
   - trailing: olive text button "Edit" (screen reader: "Edit {name}"), beside the row rather than inside it; it opens the row menu.
5. Under the list: soft "Clear done items" (when something is ticked) and outline "Clear all items" (when the list isn't empty), side by side.
6. TabBar (Groceries active).

## Aisles (fixed order)
Produce · Bakery · Dairy & eggs · Meat & fish · Dry goods · Spices & baking · Frozen · Drinks · Household · Other

## States not drawn
| State | Copy |
| --- | --- |
| Empty list | "Your list is empty." · "Add items above, or from any recipe with “Add to groceries…”." |
| Clear all items | Dialog (warning icon): "Clear all {n} items on the list?" ("Clear the 1 item on the list?") / "This removes every item, ticked or not, for everyone in the family. You can undo it right after." · "Clear all items" · "Keep the list". Confirming clears them all and shows StatusBanner "Cleared {n} items" with "Undo". |
| One or more ticked | Soft button "Clear done items" at the end of the list. Pressing it removes ticked items and shows StatusBanner "Cleared {n} items" with "Undo". Nothing is cleared automatically. |
| Item in Other | row long-press menu "Move to…" with the aisle list; the choice is remembered for the family |
| Sync failed | the tick reverts; StatusBanner warn "Couldn't update. Try again." (also when Clear, Remove, Undo, Edit or Move to… fails) |
| Add failed | StatusBanner warn "Couldn't add this item. Try again." (the text stays in the field) |
| Merged, no amount | StatusBanner "Already on the list." |
| Removed | StatusBanner "Removed {name}." with "Undo" |
| Loading failed | Callout warn "Couldn't load the list. Check your connection and try again." · soft button "Try again" |
| Offline | the offline StatusBanner; adding, ticking, "Edit", the row menu, "Clear done items" and "Clear all items" are off; the Grocery settings sheet opens but its choices are off |

## Interactions
Tick: optimistic and realtime. "Edit" on a row (or long-press, swipe, right-click) → the row menu. Add merges with an existing item, with StatusBanner "Already on the list. Updated to {total}."

## Row menu (spec 020, not drawn)
A BottomSheet "Edit item" (close label "Close") that opens straight on the edit field: TextField "Item" with hint "An amount and a name, e.g. 2 lemons or 100 g Gruyère", starting from "{amount} {name}". Below it, one ListGroup with "Move to…" (chevron, after the current aisle's name) and "Store size" (spec 021); then, apart from them, a red danger Button "Remove" (trash icon, full width). Footer "Cancel" · "Save". The row's screen-reader actions are "Edit" (opens this sheet), "Move to…" and "Remove"; right-click or the keyboard's menu key also opens it on the web.
- **Move to…:** sheet title "Move to…", lead "{name} will go here from now on, for your family."; one radio row per aisle in the fixed order, the current one selected. Tapping one moves it and closes.
- **Merging** only joins an item still to buy whose amount adds up (both weights, volumes or counts); otherwise the new item gets its own row.
- The recipe card is tappable as a whole (Card rule); "Open" is its olive label.

## Store sizes (spec 021)
- **What to buy:** one pack is its label ("1 pint carton", "20 cl"; "1 dozen" when the label has no number); several of one pack "2 × 20 cl"; mixed packs joined with " + " ("50 cl + 20 cl"); sold one by one, in pieces ("Lemon: 2 pieces", "Pumpkin: 1 piece (need 1 kg)"); sold by weight "1 kg loose" (in lb for US stores).
- **Same item from several rows** (two recipes): the first row still to buy carries what to buy for the total and "(need {total})"; the others show "{name}: {their amount}".
- **Grocery settings sheet:** BottomSheet "Grocery settings" (close label "Close"), its settings in an inset ListGroup (white card, padding 4 16, as in Settings): SettingChoice "Where do you shop?" / "So the list shows packs you can actually buy" with "US stores" | "European stores" and the example "Recipe needs **300 ml cream**" → "Buy 1 pint" (EU "Buy 2 × 20 cl"); SettingRow "Round up to store sizes" / "Off: the list shows only what recipes need". Saved at once for the whole family; a failed change reverts with StatusBanner warn "Couldn't save. Try again." inside the sheet. These settings are only here (not in the Settings tab).
- **Edit › "Store size" (not drawn):** in the Edit item sheet, a ListRow "Store size" (chevron, the first pack's label for the family's store) after "Move to…", for catalog items only. It opens a BottomSheet "Store size", lead "What {name} comes in where you shop. Saved for your family."; TextField "Pack size", hint "One pack, e.g. 250 g, 20 cl or 6", starting empty (or from the family's own size); footer "Cancel" · "Save". When the family has its own size, a link "Use the usual sizes" puts the catalog's back. Can't read it → TextField warning "Type one amount, like 250 g or 1 l.". The size replaces the catalog's packs for this family, for both stores (spec 031).
