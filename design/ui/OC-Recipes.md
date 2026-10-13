# OC-Recipes — Recipes

Source `screens/OC-Recipes.dc.html` · Route `/recipes` · Specs 006, 007

## Layout
1. ScreenHeader: "Recipes"; right: olive sm Button with plus icon "New".
2. Search field: hidden label "Search recipes", placeholder "Search recipes or ingredients"; hint under it "Try “leek”, “quick” or “Mia's”" (hidden once typing).
3. Pills row (horizontal scroll): ink pill with filter icon "Filters · {activeCount}" (just "Filters" when 0), then quick pills "In season", "Under 30 min", "Vegetarian".
4. Overline "In season in {Month} · {n}", then RecipeItems; then overline "All recipes · {n}" and the rest. Within each group, most recently added first.
5. RecipeItem: thumb, name, meta "{time} · Serves {n}" + " · {k} variants" or " · Vegetarian", author line "{name}" or "{name} · via {assistant}".
6. TabBar (Recipes active).

## States not drawn
| State | Copy |
| --- | --- |
| No recipes yet | Title 18/900 "Your family's recipes will live here." · body "Add one yourself, or ask your AI assistant to save one." · ink button "New recipe" · AI Callout "Try: “Save my mum's ratatouille to Our Cocon”" |
| No search match | "No recipes match “{query}”." · "Try another word, or add it as a new recipe." · soft button "Clear search" |
| Loading | 3 RecipeItem skeletons |

## Interactions
| Element | Result |
| --- | --- |
| New | → `/recipes/new` |
| Filters pill | → `/recipes/filters` sheet |
| Quick pill | toggles that filter (honey when on) |
| RecipeItem | → `/recipes/[id]` |
