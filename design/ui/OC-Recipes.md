# OC-Recipes — Recipes

Source `screens/OC-Recipes.dc.html` · Route `/recipes` · Specs 006, 007

## Layout
1. ScreenHeader: "Recipes"; right: olive sm Button with plus icon "New". It scrolls away (spec 050 FR-007).
2. Search field: hidden label "Search recipes", placeholder "Search recipes or ingredients"; no hint. Pinned: it sticks under the status bar once it reaches it, with the TopBar's hairline and shadow (spec 050 FR-007).
3. Pills row (horizontal scroll, pinned with the search): ink pill with filter icon "Filters · {activeCount}" (just "Filters" when 0), then quick pills "In season", "Under 30 min".
4. Overline "All recipes · {n}", then RecipeItems, most recently added first. No "In season in {Month}" group: the "In season" pill does it (spec 050 FR-007).
5. RecipeItem: thumb, name, meta "{time} · Serves {n} · {cuisine} · {k} variants" (each part left out when it has no value: no total time, cuisine Other, no variants; "1 variant" when one), author line "{name}" or "{name} · via {assistant}". Time is `total_minutes` ("40 min", "1 h 10").
6. TabBar (Recipes active).

## States not drawn
| State | Copy |
| --- | --- |
| No recipes yet | Title 18/900 "Your family's recipes will live here." · body "Add one yourself, or ask your AI assistant to save one." · ink button "New recipe" · AI Callout "Try: “Save my mum's ratatouille to Our Cocon”" |
| No search match | "No recipes match “{query}”." · "Try another word, or add it as a new recipe." · soft button "Clear search" |
| No filter match (no search) | Title 18/900 "No recipes match these filters." · body "Try removing a filter." · soft sm button "Clear filters" (spec 007) |
| No search match, filters on | As "No search match", with a second soft sm button "Clear filters" after "Clear search" (spec 007) |
| Loading | 3 RecipeItem skeletons; screen-reader label "Loading recipes" |
| Load failed (nothing cached) | warn Callout "Couldn't load your recipes. Check your connection and try again." · soft sm button "Try again" |
| Author left the family | author line "Former member" (with " · via {assistant}" when AI-made) |
| Unknown assistant | "{name} · via an AI assistant" |
| Offline | StatusBanner (Patterns.md); "New" and "New recipe" disabled, list readable |

## Interactions
| Element | Result |
| --- | --- |
| New | → `/recipes/new` |
| Filters pill | → `/recipes/filters` sheet |
| Quick pill | toggles that filter (honey when on) |
| RecipeItem | → `/recipes/[id]` |

## Screen readers (spec 030)
A search says what it found once it settles: "3 recipes", "1 recipe", or "No recipes match “{query}”.".

## Changelog
- 2026-11-05 (050 FR-007): the search (and the quick filters) pinned under the status bar; the "Try “leek” or “quick”" hint and the "In season in {Month}" group removed.
