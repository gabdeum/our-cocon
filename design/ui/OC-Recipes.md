# OC-Recipes — Recipes

Source `screens/OC-Recipes.dc.html` · Route `/recipes` · Specs 006, 007, 051

## Layout
1. ScreenHeader: "Recipes"; right: olive sm Button with plus icon "New". It scrolls away (spec 050 FR-007).
2. Search field: hidden label "Search recipes", placeholder "Search recipes or ingredients"; no hint. Pinned: it sticks under the status bar once it reaches it, with the TopBar's hairline and shadow (spec 050 FR-007).
3. Pills row (horizontal scroll, pinned with the search): ink pill with filter icon "Filters · {activeCount}" (just "Filters" when 0), then quick pills "In season", "Under 30 min".
4. "In progress · {n}" section (a region named "In progress", overline "In progress · {n}"), only when n > 0: one CookSessionCard (list variant) per recipe being cooked, newest first. See "In progress" below.
5. Overline "All recipes · {n}", then RecipeItems, most recently added first. No "In season in {Month}" group: the "In season" pill does it (spec 050 FR-007).
6. RecipeItem: thumb, name, meta "{time} · Serves {n} · {cuisine} · {k} variants" (each part left out when it has no value: no total time, cuisine Other, no variants; "1 variant" when one), then the Source line (spec 051 FR-015): the recipe's source ("La Cuisine de Mamie · p. 48"), else the assistant that made it ("ChatGPT"; "An AI assistant" when we don't know its name), else who added it ("Mia"). Never "via". Time is `total_minutes` ("40 min", "1 h 10").
7. TabBar (Recipes active).

## States not drawn
| State | Copy |
| --- | --- |
| No recipes yet | Title 18/900 "Your family's recipes will live here." · body "Add one yourself, or ask your AI assistant to save one." · ink button "New recipe" · AI Callout "Try: “Save my mum's ratatouille to Our Cocon”" |
| No search match | "No recipes match “{query}”." · "Try another word, or add it as a new recipe." · soft button "Clear search" |
| No filter match (no search) | Title 18/900 "No recipes match these filters." · body "Try removing a filter." · soft sm button "Clear filters" (spec 007) |
| No search match, filters on | As "No search match", with a second soft sm button "Clear filters" after "Clear search" (spec 007) |
| Loading | 3 RecipeItem skeletons; screen-reader label "Loading recipes" |
| Load failed (nothing cached) | warn Callout "Couldn't load your recipes. Check your connection and try again." · soft sm button "Try again" |
| Author left the family (no source) | Source line "Former member" |
| Offline | StatusBanner (Patterns.md); "New" and "New recipe" disabled, list readable; the In progress cards' Cancel, Done and Resume are off |

## In progress (spec 051 FR-003)
- Each card: photo 60, name, "Step {k} of {n} · {member} · since {HH:mm}" ("Step {k} of {n} · {member} · started yesterday" once it's been untouched for 24 h), a step bar (one 5 px segment per step: done, current, still to come), then Cancel · Done · Resume. Resume is ink with a play icon. The buttons are 44 tall (the design's 42, raised to the touch minimum).
- Live for everyone in the family: a cook started or left on another phone shows here within 2 s.
- Untouched for 72 h, a cook is cancelled by itself and leaves the section.

## Interactions
| Element | Result |
| --- | --- |
| New | → `/recipes/new` |
| Filters pill | → `/recipes/filters` sheet |
| Quick pill | toggles that filter (honey when on) |
| RecipeItem | → `/recipes/[id]` |
| Resume | → cooking mode at the cook's step, with its servings and version (`/recipes/[id]/cook`) |
| Cancel | ends the cook (not counted as cooked); it leaves the section and a toast "Cancelled" with "Undo" shows |
| Done | logs it as cooked, at any step, and opens the Done sheet (OC-CookDone) |

## Screen readers (spec 030)
A search says what it found once it settles: "3 recipes", "1 recipe", or "No recipes match “{query}”.".
In progress card buttons: "Resume {recipe}, step {k} of {n}", "Cancel cooking {recipe}", "Done cooking {recipe}".

## Changelog
- 2026-11-05 (050 FR-007): the search (and the quick filters) pinned under the status bar; the "Try “leek” or “quick”" hint and the "In season in {Month}" group removed.
- 2026-11-12 (051): "In progress · {n}" section with Cancel · Done · Resume; the author line is now the Source, never "via".
