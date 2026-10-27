# OC-Home — Home (with calendar)

Source `screens/OC-Home.dc.html` · Route `/` · Spec 028

## Layout (top → bottom)
1. Brand row: logo mark + "Our Cocon"; right: avatar stack of all family members, account and without the app, in their member colors (max 4, then "+N").
2. Date line (olive 15/700), e.g. "Sunday, Oct 25", then greeting `display-xl` "Hi {firstName}" ("Good morning {firstName}" 5:00–11:59, "Good evening {firstName}" 18:00–4:59).
3. **Calendar card** (CalCard.md).
4. Hero card (latest recipe = most recently added): photo with white tag "Latest recipe"; title; chips "{time}", "Serves {n}", warn chip "{k} to buy" (hidden when 0). Opens the recipe.
5. Two StatTiles: honey "{count}" / "to buy" → Groceries; sage "{count}" / "family recipes" → Recipes.
6. Activity card (latest AI change, now including calendar changes): "AI" badge, title (e.g. "New: Pumpkin soup", "New event: Pediatrician"), sub-line "Added by {name} via {assistant} · {timeAgo}", link "Undo".
7. TabBar (Home active) with TimerPill when timers exist.

## States not drawn
| State | Copy and behaviour |
| --- | --- |
| No recipes yet | Hero becomes a soft card: title "What's for dinner?", body "Save your first family recipe and it will show up here.", olive button "Add your first recipe" → `/recipes/new`. |
| No groceries | Tile reads "0" / "to buy". |
| No recipes | Tile reads "0" / "family recipes"; tapping opens Recipes empty state. |
| No AI activity | Activity card hidden. |
| AI deleted something | Sub-line "Deleted by {name} via {assistant} · {timeAgo}"; link "Restore" instead of "Undo" (restores from Recently deleted, spec 026). |
| Undo done | Card sub-line becomes "Undone by {name}"; Undo link hidden. |

## Interactions
| Element | Result |
| --- | --- |
| Hero | → `/recipes/[id]` |
| Groceries tile | → `/groceries` |
| Recipes tile | → `/recipes` |
| Undo | reverts that activity (spec 026), StatusBanner "Undone" |
| Avatar stack | → `/settings/family` |
