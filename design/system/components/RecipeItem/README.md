# RecipeItem

A recipe in a list: thumbnail, name, one meta line and who added it.

## Specs

| Part | Spec |
| --- | --- |
| Container | surface-card, radius 22, padding 10, gap 14, whole item is a link |
| Thumbnail | 84 × 84, radius 16, photo cover (placeholder: peach / honey / sage) |
| Name | 17/900 ink, max 2 lines |
| Meta | 14/600 ink-muted: "1 h 10 · Serves 6 · French · 2 variants" |
| Source | 13/700 olive, 6 above: the recipe's source, "La Cuisine de Mamie · p. 48", or "ChatGPT" or "Mia" when it has none (spec 051) |

## States

| State | Spec |
| --- | --- |
| Pressed | fill `surface-card-pressed` |
| Focus | 3 px olive outline, offset 2 |
| Loading | same container; `surface-soft` blocks for the thumbnail (84, radius 16) and three lines (name 18 tall at 75 %, meta 14 at 50 %, author 13 at 33 %, `radius-xs`, gap 8). No spinner; hidden from screen readers. Lists show 3 while loading |

## Summary (`oc-recipe-item--summary`)

The recipe named at the top of a sheet (OC-Share, spec 019): not tappable, surface-card, radius 20, padding 10, gap 12; thumbnail 64, radius 14 (peach with the initial when there's no photo); name 17/900, then one 14/600 ink-muted line ("From the Our Cocon family").

## Grocery card (`GroceryRecipeCard`)

A recipe on the grocery list (OC-Groceries, spec 052 FR-006). Two hit areas side by side on one surface-soft card, radius 18:

| Part | Spec |
| --- | --- |
| Body | a link: padding 10 · 0 · 10 · 12, gap 10; thumbnail 40, radius 12 (peach placeholder); name 15/800; meta 13/600 ink-muted ("3 items on the list · serves 6"); no chevron (Gabriel, 052). Screen reader: "Open {recipe}" |
| "…" | 48 × 60, `more-vertical` 22 ink, at the card's right. Screen reader: "More for {recipe}" |
| Pressed | each part fills `surface-soft-pressed` on its own |
| Deleted recipe | the body isn't a link; the meta reads "From a deleted recipe" |



- Items stack with a 14 gap. The meta line shows only facts that help someone choose, in this order: time, servings, cuisine, variants. A fact with no value is left out with its separator.
- Show the source, never "{name} · via {assistant}" (spec 051 FR-015).
