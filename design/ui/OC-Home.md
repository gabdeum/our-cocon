# OC-Home — Home

Source `screens/OC-Home.dc.html` · Route `/` · Spec 028

## Layout (top → bottom)
1. Brand row: logo mark + "Our Cocon"; right: avatar stack of family members (max 4, then "+N").
2. Date line (olive 15/700), e.g. "Monday, Oct 12", then greeting `display-xl` "Hi {firstName}" ("Good morning {firstName}" 5:00–11:59, "Good evening {firstName}" 18:00–4:59).
3. Hero card (latest recipe = most recently added): photo with white tag "Latest recipe"; title = recipe name; chips "{time}" (`total_minutes`, hidden when empty), "Serves {n}", warn chip "{k} to buy" (hidden when 0). The whole card opens the recipe.
4. Two StatTiles: honey "{count}" / "to buy" → Groceries; sage "{count}" / "family recipes" → Recipes.
5. Activity card (latest AI change): "AI" badge, title (e.g. "New: Pumpkin soup"), sub-line "Added by {name} via {assistant} · {timeAgo}", link "Undo".
6. TabBar (Home active) with TimerPill above it when timers exist.

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
| Avatar stack | → `/settings` (Family section) |
