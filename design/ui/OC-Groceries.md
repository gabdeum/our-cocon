# OC-Groceries — Groceries

Source `screens/OC-Groceries.dc.html` · Route `/groceries` · Specs 020, 021, 031

## Layout
1. ScreenHeader "Groceries"; sub-line "{n} items to buy · shared with family" ("1 item"); right: presence "{name} is shopping" (when someone else ticked in the last 10 min; never yourself).
2. Add row: input (hidden label "Add an item", placeholder "Add an item, e.g. 2 lemons") + olive square "Add item" + soft square IconButton (settings icon, 54 px like "Add item") "Grocery settings", which opens the Grocery settings sheet. No hint under the input.
3. One soft card per linked recipe: thumb, "For {recipe}", "{n} items · serves {n}" (the servings it's on the list for, spec 022), then a vertical "…" soft IconButton (`more-vertical`, 44 × 44, the card's own fill until pressed; screen reader: "Options for {recipe}") that opens the recipe card menu. The card itself isn't tappable.
4. Aisle groups in catalog order (spec 031): overline aisle name; white list group; rows in alphabetical order of the name shown (ticked ones too, so nothing moves when ticked). One row per thing still to buy (spec 022): everything of the same catalog entry, or the same name for custom items, is one row whoever added it, its amounts added up in the unit of the item added first ("Apple: 15 pieces" from 11 pieces and 600 g, through the catalog's piece weights and densities; counts round up; "11 pieces + 600 g" when they don't convert). Ticked items make their own row. Rows:
   - checkbox · title line "{name}: {to buy}" (800) then " (need {amount})" (15/600 ink-muted) · source sub-line ("For {recipe}" / "Added by {name}" / "{name} via {assistant}"; "From a deleted recipe" once its recipe is in Recently deleted or gone, spec 018). A row from several sources names each once, recipes first, joined by " · ": "For Apple crumble + Leek & bacon quiche · Added by Mia"; when more than one person typed it in, "Added manually" instead of their names
   - the title line reads "Heavy cream: 1 pint carton (need 300 ml)"; "(need …)" is left out when what to buy is exactly what's needed ("Pumpkin: 1 kg loose", "Lemon: 2 pieces"); counts always say pieces ("1 piece", "2 pieces", "½ piece"). The name is the catalog's singular when it's the same word as typed ("2 lemons" → "Lemon"); a name the matcher only got close to stays as typed ("Meyer lemons"); "Heavy cream: 300 ml" when no pack is known or round-up is off; just "Salt" when there's no quantity. No leftover is shown.
   - trailing: a vertical "…" icon button (`more-vertical`, 44 × 44, ink-muted, vertically centred; screen reader: "Edit {name}"), beside the row rather than inside it; it opens the row menu.
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
| Recipe's items removed | StatusBanner "Removed {n} items for {recipe}." ("1 item") with "Undo" |
| Loading failed | Callout warn "Couldn't load the list. Check your connection and try again." · soft button "Try again" |
| Offline | the offline StatusBanner; adding, ticking, the "…" button, the row menu, "Clear done items" and "Clear all items" are off; the Grocery settings sheet opens but its choices are off; the recipe card menu opens and "Open recipe" works, but "Save for {n}" and "Remove its items" are off |

## Interactions
Tick: optimistic and realtime. A row's vertical "…" (or long-press, swipe, right-click) → the row menu. Add merges with an existing item, with StatusBanner "Already on the list. Updated to {total}." The amount can come first or last: "2 lemons", "Lemon 12", "Gruyere 120g", "heavy cream 240 ml" (a number inside a name, "Size 4 nappies", stays part of it).

## Row menu (spec 020, not drawn)
A BottomSheet "Edit item" (close label "Close") that opens straight on the edit field: TextField "Item" with hint "An amount and a name, e.g. 2 lemons or 100 g Gruyère", starting from "{amount} {name}". Below it, one ListGroup with "Move to…" (chevron, after the current aisle's name) and "Store size" (spec 021); then, apart from them, a red danger Button "Remove" (trash icon, full width). Footer "Cancel" · "Save". The row's screen-reader actions are "Edit" (opens this sheet), "Move to…" and "Remove"; right-click or the keyboard's menu key also opens it on the web.
- **Move to…:** sheet title "Move to…", lead "{name} will go here from now on, for your family."; one radio row per aisle in the fixed order, the current one selected. Tapping one moves it and closes.
- **A row of several items** ticks, unticks and is removed as one ("Removed {name}." with Undo brings them all back). Edit starts from the total ("15 Apples") and saves it as one item: the first one, keeping its source; the others are cleared. When the amounts don't add up to one ("11 pieces + 600 g"), Edit changes only the first item and the others stay. The header count and "Clear all {n} items" count rows.
- **Merging** only joins my own item (or, from a recipe, that recipe's), still to buy, whose amount adds up; anything else of the same thing keeps its own item and shows in the same row. Either way, typing something already on the list shows StatusBanner "Already on the list. Updated to {row total}." Merging only joins an item still to buy whose amount adds up (both weights, volumes or counts, or pinches with pinches); otherwise the new item gets its own row.

## Recipe card menu (spec 022, not drawn)
A BottomSheet titled "For {recipe}", lead "{n} items · serves {n}" (close label "Close"):
1. One ListGroup with "Open recipe" (chevron) → the recipe page.
2. A white Card: "Servings" (17/900) and a Stepper (screen reader "Fewer servings" / "More servings", 1 to 16, or the stored servings if more, at most 50); under it, muted 13/600: "Changes what is still to buy. Ticked items stay as they are."
3. Apart from them, a red danger Button "Remove its items" (trash icon, full width).
- Once the servings change, the footer shows "Cancel" · "Save for {n}". Saving multiplies the recipe's items still to buy by new ÷ old servings (counts round up, as when adding from a recipe), saves the servings for the family and closes. Ticked items are left as they are.
- "Remove its items" removes all the recipe's items, ticked or not, closes, and shows StatusBanner "Removed {n} items for {recipe}." with "Undo".
- The servings: "Add to groceries…" records them (8 after a scale by an ingredient to 7½). Adding the recipe again while it still has items on the list adds them up (4, then 2 more, is 6); once its items are gone, the next add starts again.

## Store sizes (spec 021)
- **What to buy:** one pack is its label ("1 pint carton", "20 cl"; "1 dozen" when the label has no number); several of one pack "2 × 20 cl"; mixed packs joined with " + " ("50 cl + 20 cl"); sold one by one, in pieces ("Lemon: 2 pieces", "Pumpkin: 1 piece (need 1 kg)"); sold by weight "1 kg loose" (in lb for US stores).
- **Same item from several rows** (two recipes): the first row still to buy carries what to buy for the total and "(need {total})"; the others show "{name}: {their amount}".
- **Grocery settings sheet:** BottomSheet "Grocery settings" (close label "Close"), laid out like the other sheets (Patterns.md › Bottom sheet, OC-Filters), with no card: a section heading "Where do you shop?" (16/900) with hint "So the list shows packs you can actually buy" (13/600 muted), a light SegmentedControl "US stores" | "European stores", and the example line "Recipe needs **300 ml cream** → **Buy 1 pint**" (EU "Buy 2 × 20 cl"; 14/700 muted, the result 14/900 olive-deep); then a boxed SettingRow "Round up to store sizes" / "Off: the list shows only what recipes need". Saved at once for the whole family; a failed change reverts with StatusBanner warn "Couldn't save. Try again." inside the sheet. These settings are only here (not in the Settings tab). Its button is a 54 px soft square IconButton (`--soft-square`, settings icon), the same size as "Add item".
- **Edit › "Store size" (not drawn):** in the Edit item sheet, a ListRow "Store size" (chevron, the first pack's label for the family's store) after "Move to…", for catalog items only. It opens a BottomSheet "Store size", lead "What {name} comes in where you shop. Saved for your family."; TextField "Pack size", hint "One pack, e.g. 250 g, 20 cl or 6", starting empty (or from the family's own size); footer "Cancel" · "Save". When the family has its own size, a link "Use the usual sizes" puts the catalog's back. Can't read it → TextField warning "Type one amount, like 250 g or 1 l.". The size replaces the catalog's packs for this family, for both stores (spec 031).
