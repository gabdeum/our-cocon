# OC-Home — Home

Source `screens/OC-Home.dc.html` · Route `/` · Spec 028

## Layout (top → bottom)
1. Brand row: logo mark + "Our Cocon"; right: avatar stack of family members (max 4, then "+N").
2. Date line (olive 15/700), e.g. "Monday, Oct 12", then greeting `display-xl` "Hi {firstName}" ("Good morning {firstName}" 5:00–11:59, "Good evening {firstName}" 18:00–4:59).
3. Hero card (latest recipe = most recently added): photo with white tag "Latest recipe"; title = recipe name; chips "{time}" (`total_minutes`, hidden when empty), "Serves {n}", warn chip "{k} to buy" (hidden when 0). The whole card opens the recipe.
4. Two StatTiles: honey "{count}" / "to buy" → Groceries; sage "{count}" / "family recipes" → Recipes.
5. Activity cards (the latest 2 AI changes, spec 026 FR-002), stacked, gap 12 (ActivityCard): "AI" badge, title (e.g. "New: Pumpkin soup"), sub-line "Added by {name} via {assistant} · {timeAgo}", link "Undo". Below them, link "See all" → `/activity` (OC-Activity.md). Titles and sub-lines per change: OC-Activity.md › Entries.
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
| Restore done | Card sub-line becomes "Restored by {name}"; Restore link hidden. |
| Over 7 days old | The entry stays, without Undo. |
| Changed since (spec 026) | Undo opens a Dialog (warning icon): title "Undo the rest?", body "{name} ticked {n} of these items. They'll stay as they are." (or "{name} cleared {n} of these items.", "{name} changed {n} of these things since.", "{n} of these are gone for good."), buttons "Undo the rest" and "Cancel". Only the unchanged part is undone. |
| Nothing left to undo | StatusBanner (warn) "All of this changed since, so there is nothing left to undo." |
| Undo no longer possible | StatusBanner (warn) "This can't be undone any more." |
| Undo failed | StatusBanner (warn) "Couldn't undo. Check your connection and try again." (Restore: "Couldn't restore it. Check your connection and try again.") |
| Offline | Undo and Restore are off. |

## Interactions
| Element | Result |
| --- | --- |
| Hero | → `/recipes/[id]` |
| Groceries tile | → `/groceries` |
| Recipes tile | → `/recipes` |
| Undo | reverts that activity (spec 026), StatusBanner "Undone" |
| Restore | puts the recipe back from Recently deleted (spec 026), StatusBanner "Restored" |
| See all | → `/activity` (OC-Activity.md) |
| Avatar stack | → `/settings` (Family section) |
