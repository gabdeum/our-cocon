# OC-Home — Home (with calendar)

Source `screens/OC-Home.dc.html` · Route `/` · Spec 028

## Layout (top → bottom)
1. Brand row: logo mark + "Our Cocon"; right: avatar stack of all family members, account and without the app, in their member colors (max 4, then "+N"). Pinned under the status bar; the hairline and shadow show once content scrolls under it (spec 050 FR-007).
2. Date line (olive 15/700), e.g. "Sunday, Oct 25", then greeting `display-xl` "Hi {firstName}" ("Good morning {firstName}" 5:00–11:59, "Good evening {firstName}" 18:00–4:59).
3. **Calendar card** (CalCard.md).
4. Hero card (latest recipe = most recently added): photo with white tag "Latest recipe"; title; chips "{time}", "Serves {n}", warn chip "{k} to buy" (hidden when 0). Opens the recipe.
5. Two StatTiles: honey "{count}" / "to buy" → Groceries; sage "{count}" / "family recipes" → Recipes.
6. **Latest activity** (white card, radius 26): title 20/900 + small segmented "All" · "AI only" (36 tall, default All). 4 rows (56, dividers): badge 36 — person avatar in member color, or "AI" rounded square (radius 12) in the person's color with a 2 px olive ring; title 15/800 "Eva added Pumpkin soup" · "Gabriel ticked 4 items" · "Gabriel added Pediatrician" · "Eva edited Leek & bacon quiche"; sub 13/600 muted "Recipes · via ChatGPT · 1 h ago", "Groceries · 2 h ago", "Calendar · Wed, 10:00 · via Claude · 3 h ago"; AI rows end with "Undo" (or "Restore" for deletes). Link "See all activity".
7. TabBar (Home active) with TimerPill when timers exist.

## States not drawn
| State | Copy and behaviour |
| --- | --- |
| No recipes yet | Hero becomes a soft card: title "What's for dinner?", body "Save your first family recipe and it will show up here.", olive button "Add your first recipe" → `/recipes/new`, then the hint "Or ask your AI assistant to add one for you." |
| New family (only you) | A soft card after Latest activity: title "Invite your family", body "Share Our Cocon so everyone sees the same recipes, list and calendar.", olive button "Invite" → `/settings/family`. |
| No groceries | Tile reads "0" / "to buy". |
| No recipes | Tile reads "0" / "family recipes"; tapping opens Recipes empty state. |
| No activity | Card hidden. |
| AI only, none | "No AI changes yet." (15/700 muted), toggle stays. |
| AI deleted something | Title "{name} deleted {thing}", sub-line "… · via {assistant} · {timeAgo}"; link "Restore" instead of "Undo" (restores from Recently deleted, spec 026). |
| Undo done | Row sub-line becomes "Undone by {name}"; Undo link hidden. |

## Interactions
| Element | Result |
| --- | --- |
| Hero | → `/recipes/[id]` |
| Groceries tile | → `/groceries` |
| Recipes tile | → `/recipes` |
| Undo | reverts that activity (spec 026), StatusBanner "Undone" |
| Avatar stack | → `/settings/family` (screen readers: "Family: Gabriel, Eva, James") |
| All · AI only | filters the card (not remembered) |
| See all activity | → activity list (spec 026), same filter |

## Changelog
- 2026-11-05 (050 FR-007): the brand row is pinned.
